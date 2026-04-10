"""日志记录"""
import logging
import json
import asyncio
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
import aiosqlite
from .database import get_db


# 通用统计更新SQL模板（用于减少重复代码）
_STATS_UPDATE_SQL = """
    INSERT INTO {table} ({id_cols}, date, request_count, input_tokens, output_tokens, error_count, avg_response_time_ms)
    VALUES ({placeholders}1, ?, ?, ?, ?, ?)
    ON CONFLICT({id_cols}, date) DO UPDATE SET
        request_count = request_count + 1,
        input_tokens = input_tokens + excluded.input_tokens,
        output_tokens = output_tokens + excluded.output_tokens,
        error_count = error_count + excluded.error_count,
        avg_response_time_ms = (avg_response_time_ms * request_count + excluded.avg_response_time_ms) / (request_count + 1)
"""


class RequestLogger:
    """请求日志记录器"""

    def __init__(self, config: dict):
        self.config = config
        log_config = config.get('logging', {})
        log_file = log_config.get('file', 'logs/relay.log')
        log_level_name = log_config.get('level', 'INFO')
        log_level = getattr(logging, log_level_name.upper(), logging.INFO)

        # 确保日志目录存在
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)

        # 配置 Python 日志
        self.logger = logging.getLogger('api_relay')
        self.logger.setLevel(log_level)

        # 避免重复添加处理器
        if not self.logger.handlers:
            # 文件处理器
            file_handler = logging.FileHandler(log_file)
            file_handler.setLevel(log_level)
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)

            # 控制台处理器
            console_handler = logging.StreamHandler()
            console_handler.setLevel(log_level)
            console_handler.setFormatter(formatter)
            self.logger.addHandler(console_handler)

    def log_info(self, message: str):
        """记录信息日志"""
        self.logger.info(message)

    def log_error(self, message: str):
        """记录错误日志"""
        self.logger.error(message)

    def log_warning(self, message: str):
        """记录警告日志"""
        self.logger.warning(message)


async def log_request(
    key_id: Optional[str],
    client_ip: Optional[str],
    model: str,
    source_model: Optional[str],
    status_code: int,
    input_tokens: Optional[int],
    output_tokens: Optional[int],
    response_time_ms: int,
    error_message: Optional[str] = None,
    source_id: Optional[str] = None
):
    """记录请求到数据库"""
    request_time = datetime.now().isoformat()
    date_str = datetime.now().strftime('%Y-%m-%d')

    # 提取错误类型
    error_type = None
    if status_code >= 400:
        if error_message:
            # 从错误消息中提取类型
            error_type = extract_error_type(error_message, status_code)
        else:
            error_type = f"http_{status_code}"

    db = await get_db()
    await db.execute(
        """
        INSERT INTO request_logs
        (key_id, request_time, client_ip, model, source_model, source_id,
         status_code, input_tokens, output_tokens, response_time_ms, error_message, error_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (key_id, request_time, client_ip, model, source_model, source_id,
         status_code, input_tokens, output_tokens, response_time_ms, error_message, error_type)
    )

    # 并行更新所有统计（使用 asyncio.gather）
    tasks = []

    # 更新每日统计（幂等）
    tasks.append(update_daily_stats(
        db, key_id, date_str,
        input_tokens or 0,
        output_tokens or 0,
        1 if status_code >= 400 else 0,
        response_time_ms
    ))

    # 更新实时统计（今日）
    tasks.append(update_realtime_stats(
        db, key_id, 'today', date_str,
        input_tokens or 0,
        output_tokens or 0,
        1,
        1 if status_code >= 400 else 0,
        response_time_ms
    ))

    # 更新IP统计
    if client_ip:
        tasks.append(update_ip_stats(db, client_ip, request_time, model, key_id))

    # 更新模型统计（按虚拟模型ID）
    tasks.append(update_model_stats(
        db, model, date_str,
        input_tokens or 0,
        output_tokens or 0,
        1 if status_code >= 400 else 0,
        response_time_ms
    ))

    # 更新源模型统计
    if source_model:
        tasks.append(update_source_model_stats(
            db, source_model, source_id, date_str,
            input_tokens or 0,
            output_tokens or 0,
            1 if status_code >= 400 else 0,
            response_time_ms
        ))

    # 更新源提供商统计
    if source_id:
        tasks.append(update_source_api_stats(
            db, source_id, date_str,
            input_tokens or 0,
            output_tokens or 0,
            1 if status_code >= 400 else 0,
            response_time_ms
        ))

    # 更新错误统计
    if error_type and status_code >= 400:
        tasks.append(update_error_stats(db, error_type, status_code, date_str))

    # 并行执行所有统计更新
    if tasks:
        await asyncio.gather(*tasks)

    await db.commit()


def extract_error_type(error_message: str, status_code: int) -> str:
    """从错误消息中提取错误类型"""
    # 常见错误类型关键词
    error_keywords = {
        'rate_limit': ['rate limit', 'rate_limit', 'too many requests', '429'],
        'timeout': ['timeout', 'timed out', '504'],
        'connection': ['connection', 'network', 'socket', '502'],
        'auth': ['auth', 'authentication', 'unauthorized', 'invalid api key', '401'],
        'invalid': ['invalid', 'bad request', '400'],
        'not_found': ['not found', '404'],
        'server': ['server error', 'internal error', '500', '503'],
        'quota': ['quota', 'credits', 'balance', 'insufficient'],
        'model': ['model not available', 'model not found', 'unsupported model']
    }

    error_lower = error_message.lower()

    for error_type, keywords in error_keywords.items():
        for keyword in keywords:
            if keyword in error_lower:
                return error_type

    # 默认返回HTTP状态码类型
    return f"http_{status_code}"


async def update_daily_stats(
    db: aiosqlite.Connection,
    key_id: Optional[str],
    date: str,
    input_tokens: int,
    output_tokens: int,
    errors: int,
    response_time_ms: int
):
    """更新每日统计数据"""
    await db.execute(
        """
        INSERT INTO statistics (key_id, date, total_requests, total_input_tokens,
                                total_output_tokens, total_errors, avg_response_time_ms)
        VALUES (?, ?, 1, ?, ?, ?, ?)
        ON CONFLICT(key_id, date) DO UPDATE SET
            total_requests = total_requests + 1,
            total_input_tokens = total_input_tokens + excluded.total_input_tokens,
            total_output_tokens = total_output_tokens + excluded.total_output_tokens,
            total_errors = total_errors + excluded.total_errors,
            avg_response_time_ms = (avg_response_time_ms * total_requests + excluded.avg_response_time_ms) / (total_requests + 1)
        """,
        (key_id, date, input_tokens, output_tokens, errors, response_time_ms)
    )


async def update_realtime_stats(
    db: aiosqlite.Connection,
    key_id: Optional[str],
    stat_type: str,
    period: str,
    input_tokens: int,
    output_tokens: int,
    request_count: int,
    error_count: int,
    response_time_ms: int
):
    """更新实时统计数据（包含平均响应时间）"""
    now = datetime.now().isoformat()
    await db.execute(
        """
        INSERT INTO realtime_stats (key_id, stat_type, period, input_tokens, output_tokens,
                                   request_count, error_count, avg_response_time_ms, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(key_id, stat_type, period) DO UPDATE SET
            input_tokens = realtime_stats.input_tokens + excluded.input_tokens,
            output_tokens = realtime_stats.output_tokens + excluded.output_tokens,
            request_count = realtime_stats.request_count + excluded.request_count,
            error_count = realtime_stats.error_count + excluded.error_count,
            avg_response_time_ms = (avg_response_time_ms * request_count + excluded.avg_response_time_ms) / (request_count + 1),
            last_updated = excluded.last_updated
        """,
        (key_id, stat_type, period, input_tokens, output_tokens, request_count, error_count, response_time_ms, now)
    )


async def update_ip_stats(
    db: aiosqlite.Connection,
    client_ip: str,
    request_time: str,
    model: str,
    key_id: Optional[str]
):
    """更新IP统计（使用ON CONFLICT避免N+1查询）"""
    # 使用INSERT...ON CONFLICT合并为单条SQL
    await db.execute(
        """
        INSERT INTO ip_statistics (ip_address, request_count, last_request_time, first_request_time, unique_models, unique_keys)
        VALUES (?, 1, ?, ?, ?, ?)
        ON CONFLICT(ip_address) DO UPDATE SET
            request_count = request_count + 1,
            last_request_time = excluded.last_request_time,
            unique_models = CASE
                WHEN ip_statistics.unique_models IS NULL OR ip_statistics.unique_models = '' THEN excluded.unique_models
                WHEN excluded.unique_models IS NOT NULL AND excluded.unique_models != '' AND ',' || ip_statistics.unique_models || ',' NOT LIKE '%,' || excluded.unique_models || ',%' THEN ip_statistics.unique_models || ',' || excluded.unique_models
                ELSE ip_statistics.unique_models
            END,
            unique_keys = CASE
                WHEN ip_statistics.unique_keys IS NULL OR ip_statistics.unique_keys = '' THEN excluded.unique_keys
                WHEN excluded.unique_keys IS NOT NULL AND excluded.unique_keys != '' AND ',' || ip_statistics.unique_keys || ',' NOT LIKE '%,' || excluded.unique_keys || ',%' THEN ip_statistics.unique_keys || ',' || excluded.unique_keys
                ELSE ip_statistics.unique_keys
            END
        """,
        (client_ip, request_time, request_time, model, key_id or "")
    )


async def update_model_stats(
    db: aiosqlite.Connection,
    model: str,
    date: str,
    input_tokens: int,
    output_tokens: int,
    error_count: int,
    response_time_ms: int
):
    """更新模型统计（按虚拟模型ID）"""
    await db.execute(
        """
        INSERT INTO model_statistics (model_id, date, request_count, input_tokens, output_tokens, error_count, avg_response_time_ms)
        VALUES (?, ?, 1, ?, ?, ?, ?)
        ON CONFLICT(model_id, date) DO UPDATE SET
            request_count = request_count + 1,
            input_tokens = input_tokens + excluded.input_tokens,
            output_tokens = output_tokens + excluded.output_tokens,
            error_count = error_count + excluded.error_count,
            avg_response_time_ms = (avg_response_time_ms * request_count + excluded.avg_response_time_ms) / (request_count + 1)
        """,
        (model, date, input_tokens, output_tokens, error_count, response_time_ms)
    )


async def update_source_model_stats(
    db: aiosqlite.Connection,
    source_model: str,
    source_id: Optional[str],
    date: str,
    input_tokens: int,
    output_tokens: int,
    error_count: int,
    response_time_ms: int
):
    """更新源模型统计"""
    await db.execute(
        """
        INSERT INTO source_model_statistics (source_model, source_id, date, request_count, input_tokens, output_tokens, error_count, avg_response_time_ms)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?)
        ON CONFLICT(source_model, source_id, date) DO UPDATE SET
            request_count = request_count + 1,
            input_tokens = input_tokens + excluded.input_tokens,
            output_tokens = output_tokens + excluded.output_tokens,
            error_count = error_count + excluded.error_count,
            avg_response_time_ms = (avg_response_time_ms * request_count + excluded.avg_response_time_ms) / (request_count + 1)
        """,
        (source_model, source_id or "", date, input_tokens, output_tokens, error_count, response_time_ms)
    )


async def update_source_api_stats(
    db: aiosqlite.Connection,
    source_id: str,
    date: str,
    input_tokens: int,
    output_tokens: int,
    error_count: int,
    response_time_ms: int
):
    """更新源提供商统计"""
    await db.execute(
        """
        INSERT INTO source_api_statistics (source_id, date, request_count, input_tokens, output_tokens, error_count, avg_response_time_ms)
        VALUES (?, ?, 1, ?, ?, ?, ?)
        ON CONFLICT(source_id, date) DO UPDATE SET
            request_count = request_count + 1,
            input_tokens = input_tokens + excluded.input_tokens,
            output_tokens = output_tokens + excluded.output_tokens,
            error_count = error_count + excluded.error_count,
            avg_response_time_ms = (avg_response_time_ms * request_count + excluded.avg_response_time_ms) / (request_count + 1)
        """,
        (source_id, date, input_tokens, output_tokens, error_count, response_time_ms)
    )


async def update_error_stats(
    db: aiosqlite.Connection,
    error_type: str,
    status_code: int,
    date: str
):
    """更新错误统计"""
    await db.execute(
        """
        INSERT INTO error_statistics (error_type, status_code, date, error_count)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(error_type, status_code, date) DO UPDATE SET
            error_count = error_count + 1
        """,
        (error_type, status_code, date)
    )


async def clear_request_logs(
    key_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    model: Optional[str] = None,
    status_filter: Optional[str] = None
) -> int:
    """按条件删除请求日志"""
    db = await get_db()
    query = "DELETE FROM request_logs WHERE 1=1"
    params = []

    if key_id:
        query += " AND key_id = ?"
        params.append(key_id)

    if start_date:
        query += " AND request_time >= ?"
        params.append(start_date)

    if end_date:
        query += " AND request_time <= ?"
        params.append(end_date)

    if model:
        query += " AND model = ?"
        params.append(model)

    if status_filter:
        if status_filter == 'error':
            query += " AND status_code >= 400"
        elif status_filter == 'success':
            query += " AND status_code < 400"

    cursor = await db.execute(query, params)
    await db.commit()
    return cursor.rowcount


async def clear_statistics(
    key_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> int:
    """按条件删除统计数据"""
    db = await get_db()
    query = "DELETE FROM statistics WHERE 1=1"
    params = []

    if key_id:
        query += " AND key_id = ?"
        params.append(key_id)

    if start_date:
        query += " AND date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND date <= ?"
        params.append(end_date)

    cursor = await db.execute(query, params)
    await db.commit()
    return cursor.rowcount


async def get_request_logs(
    limit: int = 100,
    offset: int = 0,
    key_id: Optional[str] = None,
    model: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> list:
    """查询请求日志"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    query = "SELECT * FROM request_logs WHERE 1=1"
    params = []

    if key_id:
        query += " AND key_id = ?"
        params.append(key_id)

    if model:
        query += " AND model = ?"
        params.append(model)

    if start_date:
        query += " AND request_time >= ?"
        params.append(start_date)

    if end_date:
        query += " AND request_time <= ?"
        params.append(end_date)

    query += " ORDER BY request_time DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def get_statistics(
    key_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> dict:
    """获取统计数据"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    # 总体统计
    query = """
        SELECT
            COALESCE(SUM(total_requests), 0) as total_requests,
            COALESCE(SUM(total_input_tokens), 0) as total_input_tokens,
            COALESCE(SUM(total_output_tokens), 0) as total_output_tokens,
            COALESCE(SUM(total_errors), 0) as total_errors
        FROM statistics
        WHERE 1=1
    """
    params = []

    if key_id:
        query += " AND key_id = ?"
        params.append(key_id)

    if start_date:
        query += " AND date >= ?"
        params.append(start_date)

    if end_date:
        query += " AND date <= ?"
        params.append(end_date)

    cursor = await db.execute(query, params)
    total_stats = await cursor.fetchone()

    # 按用户统计
    if not key_id:
        cursor = await db.execute(
            """
            SELECT
                key_id,
                SUM(total_requests) as total_requests,
                SUM(total_input_tokens) as total_input_tokens,
                SUM(total_output_tokens) as total_output_tokens,
                SUM(total_errors) as total_errors
            FROM statistics
            WHERE key_id IS NOT NULL
            GROUP BY key_id
            ORDER BY total_requests DESC
            """
        )
        user_stats = await cursor.fetchall()
    else:
        user_stats = []

    # 按日期统计
    date_query = """
        SELECT
            date,
            SUM(total_requests) as total_requests,
            SUM(total_input_tokens) as total_input_tokens,
            SUM(total_output_tokens) as total_output_tokens,
            SUM(total_errors) as total_errors
        FROM statistics
    """
    date_params = []
    if key_id:
        date_query += " WHERE key_id = ?"
        date_params.append(key_id)
    date_query += " GROUP BY date ORDER BY date DESC LIMIT 30"

    cursor = await db.execute(date_query, date_params)
    daily_stats = await cursor.fetchall()

    return {
        "total": dict(total_stats) if total_stats else {},
        "by_user": [dict(row) for row in user_stats],
        "by_date": [dict(row) for row in daily_stats]
    }
