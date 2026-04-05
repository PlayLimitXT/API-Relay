"""统计分析功能"""
from datetime import datetime, timedelta
from typing import Optional
import aiosqlite
from .database import get_db


async def get_user_stats(key_id: str) -> dict:
    """获取单个用户的统计数据"""
    db = await get_db()
    db.row_factory = aiosqlite.Row
    today = datetime.now().strftime('%Y-%m-%d')

    # 总体统计
    cursor = await db.execute(
        """
        SELECT
            SUM(total_requests) as total_requests,
            SUM(total_input_tokens) as total_input_tokens,
            SUM(total_output_tokens) as total_output_tokens,
            SUM(total_errors) as total_errors
        FROM statistics
        WHERE key_id = ?
        """,
        (key_id,)
    )
    total_stats = await cursor.fetchone()

    # 今日统计
    cursor = await db.execute(
        """
        SELECT total_requests, total_input_tokens, total_output_tokens, total_errors
        FROM statistics
        WHERE key_id = ? AND date = ?
        """,
        (key_id, today)
    )
    today_stats = await cursor.fetchone()

    # 平均响应时间（最近100条）
    cursor = await db.execute(
        """
        SELECT AVG(response_time_ms) as avg_response_time,
               AVG(input_tokens + output_tokens) as avg_tokens_per_request
        FROM request_logs
        WHERE key_id = ?
        ORDER BY request_time DESC
        LIMIT 100
        """,
        (key_id,)
    )
    avg_time = await cursor.fetchone()

    # 最近 7 天统计
    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    cursor = await db.execute(
        """
        SELECT date, total_requests, total_input_tokens, total_output_tokens, total_errors
        FROM statistics
        WHERE key_id = ? AND date >= ?
        ORDER BY date DESC
        """,
        (key_id, seven_days_ago)
    )
    recent_stats = await cursor.fetchall()

    return {
        "total_requests": total_stats['total_requests'] if total_stats else 0,
        "total_input_tokens": total_stats['total_input_tokens'] if total_stats else 0,
        "total_output_tokens": total_stats['total_output_tokens'] if total_stats else 0,
        "total_errors": total_stats['total_errors'] if total_stats else 0,
        "today_requests": today_stats['total_requests'] if today_stats else 0,
        "today_input_tokens": today_stats['total_input_tokens'] if today_stats else 0,
        "today_output_tokens": today_stats['total_output_tokens'] if today_stats else 0,
        "today_errors": today_stats['total_errors'] if today_stats else 0,
        "avg_response_time_ms": round(avg_time['avg_response_time'] or 0, 2),
        "avg_tokens_per_request": round(avg_time['avg_tokens_per_request'] or 0, 2),
        "recent_7_days": [dict(row) for row in recent_stats]
    }


async def get_model_stats(model: str) -> dict:
    """获取单个模型的统计数据"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        """
        SELECT
            COUNT(*) as total_requests,
            AVG(response_time_ms) as avg_response_time,
            SUM(input_tokens) as total_input_tokens,
            SUM(output_tokens) as total_output_tokens,
            SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as total_errors
        FROM request_logs
        WHERE model = ?
        """,
        (model,)
    )
    stats = await cursor.fetchone()
    return dict(stats) if stats else {}


async def get_dashboard_stats() -> dict:
    """获取仪表板总体统计"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    # 今日统计
    today = datetime.now().strftime('%Y-%m-%d')
    cursor = await db.execute(
        """
        SELECT
            SUM(total_requests) as requests_today,
            SUM(total_input_tokens) as input_tokens_today,
            SUM(total_output_tokens) as output_tokens_today,
            SUM(total_input_tokens + total_output_tokens) as tokens_today,
            SUM(total_errors) as errors_today
        FROM statistics
        WHERE date = ?
        """,
        (today,)
    )
    today_stats = await cursor.fetchone()

    # 所有时间统计
    cursor = await db.execute(
        """
        SELECT
            SUM(total_requests) as requests_all_time,
            SUM(total_input_tokens) as input_tokens_all_time,
            SUM(total_output_tokens) as output_tokens_all_time,
            SUM(total_input_tokens + total_output_tokens) as tokens_all_time,
            SUM(total_errors) as errors_all_time
        FROM statistics
        """
    )
    all_time_stats = await cursor.fetchone()

    # 活跃用户数（24小时）
    twenty_four_hours_ago = (datetime.now() - timedelta(hours=24)).isoformat()
    cursor = await db.execute(
        """
        SELECT COUNT(DISTINCT key_id) as active_users
        FROM request_logs
        WHERE request_time >= ?
        """,
        (twenty_four_hours_ago,)
    )
    active_users = await cursor.fetchone()

    # 活跃用户数（今日）
    cursor = await db.execute(
        """
        SELECT COUNT(DISTINCT key_id) as active_users_today
        FROM statistics
        WHERE date = ?
        """,
        (today,)
    )
    active_users_today = await cursor.fetchone()

    # 最近 24 小时请求趋势（按小时）
    cursor = await db.execute(
        """
        SELECT
            strftime('%H', request_time) as hour,
            COUNT(*) as requests,
            AVG(response_time_ms) as avg_response_time
        FROM request_logs
        WHERE request_time >= ?
        GROUP BY hour
        ORDER BY hour
        """,
        (twenty_four_hours_ago,)
    )
    hourly_trend = await cursor.fetchall()

    # 最近 7 天请求趋势
    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    cursor = await db.execute(
        """
        SELECT
            date,
            SUM(total_requests) as requests,
            SUM(total_input_tokens + total_output_tokens) as tokens,
            SUM(total_errors) as errors
        FROM statistics
        WHERE date >= ?
        GROUP BY date
        ORDER BY date
        """,
        (seven_days_ago,)
    )
    daily_trend = await cursor.fetchall()

    # 错误率
    cursor = await db.execute(
        """
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
        FROM request_logs
        WHERE request_time >= ?
        """,
        (twenty_four_hours_ago,)
    )
    error_stats = await cursor.fetchone()

    total_requests = error_stats['total'] if error_stats else 0
    total_errors = error_stats['errors'] if error_stats else 0
    error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0

    # 输入/输出 token 比例
    total_input = today_stats['input_tokens_today'] if today_stats and today_stats['input_tokens_today'] else 0
    total_output = today_stats['output_tokens_today'] if today_stats and today_stats['output_tokens_today'] else 0
    input_output_ratio = round(total_output / total_input, 2) if total_input > 0 else 0

    return {
        "requests_today": today_stats['requests_today'] if today_stats else 0,
        "input_tokens_today": total_input,
        "output_tokens_today": total_output,
        "tokens_today": today_stats['tokens_today'] if today_stats else 0,
        "errors_today": today_stats['errors_today'] if today_stats else 0,
        "input_output_ratio": input_output_ratio,
        "requests_all_time": all_time_stats['requests_all_time'] if all_time_stats else 0,
        "tokens_all_time": all_time_stats['tokens_all_time'] if all_time_stats else 0,
        "active_users_24h": active_users['active_users'] if active_users else 0,
        "active_users_today": active_users_today['active_users_today'] if active_users_today else 0,
        "error_rate_24h": round(error_rate, 2),
        "hourly_trend": [dict(row) for row in hourly_trend],
        "daily_trend": [dict(row) for row in daily_trend]
    }


async def get_top_users(limit: int = 10) -> list:
    """获取活跃用户排行"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
    cursor = await db.execute(
        """
        SELECT
            rl.key_id,
            ak.name,
            COUNT(*) as request_count,
            SUM(input_tokens + output_tokens) as total_tokens
        FROM request_logs rl
        LEFT JOIN api_keys ak ON rl.key_id = ak.key_id
        WHERE rl.request_time >= ?
        GROUP BY rl.key_id
        ORDER BY request_count DESC
        LIMIT ?
        """,
        (seven_days_ago, limit)
    )
    top_users = await cursor.fetchall()
    return [dict(row) for row in top_users]


async def get_top_models(limit: int = 10) -> list:
    """获取热门模型排行"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    seven_days_ago = (datetime.now() - timedelta(days=7)).isoformat()
    cursor = await db.execute(
        """
        SELECT
            model,
            COUNT(*) as request_count,
            AVG(response_time_ms) as avg_response_time,
            SUM(input_tokens + output_tokens) as total_tokens
        FROM request_logs
        WHERE request_time >= ?
        GROUP BY model
        ORDER BY request_count DESC
        LIMIT ?
        """,
        (seven_days_ago, limit)
    )
    top_models = await cursor.fetchall()
    return [dict(row) for row in top_models]
