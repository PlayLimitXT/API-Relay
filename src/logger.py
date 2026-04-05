"""日志记录"""
import logging
import json
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
import aiosqlite
from .database import get_db


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
    error_message: Optional[str] = None
):
    """记录请求到数据库"""
    request_time = datetime.now().isoformat()
    date_str = datetime.now().strftime('%Y-%m-%d')

    db = await get_db()
    await db.execute(
        """
        INSERT INTO request_logs
        (key_id, request_time, client_ip, model, source_model,
         status_code, input_tokens, output_tokens, response_time_ms, error_message)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (key_id, request_time, client_ip, model, source_model,
         status_code, input_tokens, output_tokens, response_time_ms, error_message)
    )

    # 更新每日统计（幂等）
    await update_daily_stats(
        db, key_id, date_str,
        input_tokens or 0,
        output_tokens or 0,
        1 if status_code >= 400 else 0
    )

    # 更新实时统计（今日）
    await update_realtime_stats(
        db, key_id, 'today', date_str,
        input_tokens or 0,
        output_tokens or 0,
        1,
        1 if status_code >= 400 else 0
    )

    await db.commit()


async def update_daily_stats(
    db: aiosqlite.Connection,
    key_id: Optional[str],
    date: str,
    input_tokens: int,
    output_tokens: int,
    errors: int
):
    """更新每日统计数据"""
    await db.execute(
        """
        INSERT INTO statistics (key_id, date, total_requests, total_input_tokens,
                                total_output_tokens, total_errors)
        VALUES (?, ?, 1, ?, ?, ?)
        ON CONFLICT(key_id, date) DO UPDATE SET
            total_requests = total_requests + 1,
            total_input_tokens = total_input_tokens + excluded.total_input_tokens,
            total_output_tokens = total_output_tokens + excluded.total_output_tokens,
            total_errors = total_errors + excluded.total_errors
        """,
        (key_id, date, input_tokens, output_tokens, errors)
    )


async def update_realtime_stats(
    db: aiosqlite.Connection,
    key_id: Optional[str],
    stat_type: str,
    period: str,
    input_tokens: int,
    output_tokens: int,
    request_count: int,
    error_count: int
):
    """更新实时统计数据"""
    now = datetime.now().isoformat()
    await db.execute(
        """
        INSERT INTO realtime_stats (key_id, stat_type, period, input_tokens, output_tokens,
                                   request_count, error_count, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(key_id, stat_type, period) DO UPDATE SET
            input_tokens = realtime_stats.input_tokens + excluded.input_tokens,
            output_tokens = realtime_stats.output_tokens + excluded.output_tokens,
            request_count = realtime_stats.request_count + excluded.request_count,
            error_count = realtime_stats.error_count + excluded.error_count,
            last_updated = excluded.last_updated
        """,
        (key_id, stat_type, period, input_tokens, output_tokens, request_count, error_count, now)
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
            COUNT(*) as total_requests,
            SUM(total_input_tokens) as total_input_tokens,
            SUM(total_output_tokens) as total_output_tokens,
            SUM(total_errors) as total_errors
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
