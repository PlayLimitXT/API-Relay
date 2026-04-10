"""数据库连接池和管理"""
import aiosqlite
import asyncio
import threading
from pathlib import Path
from typing import Optional

DATABASE_PATH = Path(__file__).parent.parent / "database" / "relay.db"

# 全局连接池
_db_pool: Optional[aiosqlite.Connection] = None
_pool_lock = asyncio.Lock()


async def _init_db_file():
    """确保数据库目录和文件存在"""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)


async def get_db() -> aiosqlite.Connection:
    """获取数据库连接（复用全局连接，SQLite 适合单连接场景）"""
    global _db_pool, _pool_lock

    if _db_pool is None:
        async with _pool_lock:
            if _db_pool is None:
                await _init_db_file()
                _db_pool = await aiosqlite.connect(DATABASE_PATH)
                await _db_pool.execute("PRAGMA journal_mode=WAL")
                await _db_pool.execute("PRAGMA foreign_keys=ON")
                await _db_pool.commit()

    return _db_pool


async def close_db():
    """关闭数据库连接池（优雅关闭时使用）"""
    global _db_pool
    if _db_pool:
        await _db_pool.close()
        _db_pool = None


async def init_database():
    """初始化数据库表"""
    db = await get_db()
    try:
        # 创建 API 密钥表
        await db.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                key_id TEXT PRIMARY KEY,
                api_key_hash TEXT UNIQUE NOT NULL,
                name TEXT,
                created_at TEXT NOT NULL,
                expires_at TEXT,
                is_active INTEGER DEFAULT 1,
                rate_limit INTEGER DEFAULT 60,
                metadata TEXT
            )
        """)

        # 创建源API配置表
        await db.execute("""
            CREATE TABLE IF NOT EXISTS source_apis (
                source_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                base_url TEXT NOT NULL,
                api_key TEXT NOT NULL,
                supported_models TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                metadata TEXT
            )
        """)

        # 创建虚拟模型ID表
        await db.execute("""
            CREATE TABLE IF NOT EXISTS virtual_models (
                model_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL,
                metadata TEXT
            )
        """)

        # 创建模型绑定关系表
        await db.execute("""
            CREATE TABLE IF NOT EXISTS model_bindings (
                binding_id TEXT PRIMARY KEY,
                virtual_model_id TEXT NOT NULL,
                source_id TEXT NOT NULL,
                source_model_name TEXT NOT NULL,
                priority INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (virtual_model_id) REFERENCES virtual_models(model_id),
                FOREIGN KEY (source_id) REFERENCES source_apis(source_id)
            )
        """)

        # 创建请求日志表（增强版）
        await db.execute("""
            CREATE TABLE IF NOT EXISTS request_logs (
                log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                key_id TEXT,
                request_time TEXT NOT NULL,
                client_ip TEXT,
                model TEXT NOT NULL,
                source_model TEXT,
                source_id TEXT,
                status_code INTEGER,
                input_tokens INTEGER,
                output_tokens INTEGER,
                response_time_ms INTEGER,
                error_message TEXT,
                error_type TEXT,
                FOREIGN KEY (key_id) REFERENCES api_keys(key_id)
            )
        """)

        # 创建统计表（按日，增强版）
        await db.execute("""
            CREATE TABLE IF NOT EXISTS statistics (
                stat_id INTEGER PRIMARY KEY AUTOINCREMENT,
                key_id TEXT,
                date TEXT NOT NULL,
                total_requests INTEGER DEFAULT 0,
                total_input_tokens INTEGER DEFAULT 0,
                total_output_tokens INTEGER DEFAULT 0,
                total_errors INTEGER DEFAULT 0,
                avg_response_time_ms REAL DEFAULT 0,
                UNIQUE(key_id, date),
                FOREIGN KEY (key_id) REFERENCES api_keys(key_id)
            )
        """)

        # 创建实时统计表（增强版）
        await db.execute("""
            CREATE TABLE IF NOT EXISTS realtime_stats (
                key_id TEXT,
                stat_type TEXT NOT NULL,
                period TEXT NOT NULL,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                request_count INTEGER DEFAULT 0,
                error_count INTEGER DEFAULT 0,
                avg_response_time_ms REAL DEFAULT 0,
                concurrent_count INTEGER DEFAULT 0,
                last_updated TEXT,
                PRIMARY KEY (key_id, stat_type, period)
            )
        """)

        # 创建IP统计表
        await db.execute("""
            CREATE TABLE IF NOT EXISTS ip_statistics (
                ip_address TEXT PRIMARY KEY,
                request_count INTEGER DEFAULT 0,
                last_request_time TEXT,
                first_request_time TEXT,
                unique_models TEXT,
                unique_keys TEXT
            )
        """)

        # 创建模型统计表（按模型维度）
        await db.execute("""
            CREATE TABLE IF NOT EXISTS model_statistics (
                model_id TEXT,
                date TEXT NOT NULL,
                request_count INTEGER DEFAULT 0,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                error_count INTEGER DEFAULT 0,
                avg_response_time_ms REAL DEFAULT 0,
                PRIMARY KEY (model_id, date)
            )
        """)

        # 创建源模型统计表（按源模型维度）
        await db.execute("""
            CREATE TABLE IF NOT EXISTS source_model_statistics (
                source_model TEXT,
                source_id TEXT,
                date TEXT NOT NULL,
                request_count INTEGER DEFAULT 0,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                error_count INTEGER DEFAULT 0,
                avg_response_time_ms REAL DEFAULT 0,
                PRIMARY KEY (source_model, source_id, date)
            )
        """)

        # 创建源提供商统计表（按源API维度）
        await db.execute("""
            CREATE TABLE IF NOT EXISTS source_api_statistics (
                source_id TEXT,
                date TEXT NOT NULL,
                request_count INTEGER DEFAULT 0,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                error_count INTEGER DEFAULT 0,
                avg_response_time_ms REAL DEFAULT 0,
                PRIMARY KEY (source_id, date)
            )
        """)

        # 创建错误统计表
        await db.execute("""
            CREATE TABLE IF NOT EXISTS error_statistics (
                error_type TEXT,
                status_code INTEGER,
                date TEXT NOT NULL,
                error_count INTEGER DEFAULT 0,
                PRIMARY KEY (error_type, status_code, date)
            )
        """)

        # 创建并发监控表
        await db.execute("""
            CREATE TABLE IF NOT EXISTS concurrent_monitor (
                timestamp TEXT PRIMARY KEY,
                active_requests INTEGER DEFAULT 0,
                active_sources TEXT
            )
        """)

        # 创建索引以提升查询性能
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_request_logs_key_id
            ON request_logs(key_id)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_request_logs_time
            ON request_logs(request_time)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_request_logs_model
            ON request_logs(model)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_statistics_key_date
            ON statistics(key_id, date)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_model_bindings_virtual
            ON model_bindings(virtual_model_id)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_model_bindings_source
            ON model_bindings(source_id)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_request_logs_client_ip
            ON request_logs(client_ip)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_request_logs_source_id
            ON request_logs(source_id)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_request_logs_source_model
            ON request_logs(source_model)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_request_logs_error_type
            ON request_logs(error_type)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_request_logs_status_code
            ON request_logs(status_code)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_model_statistics_date
            ON model_statistics(date)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_source_model_statistics_date
            ON source_model_statistics(date)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_source_api_statistics_date
            ON source_api_statistics(date)
        """)

        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_error_statistics_date
            ON error_statistics(date)
        """)

        await db.commit()
    except Exception as e:
        await db.rollback()
        raise
