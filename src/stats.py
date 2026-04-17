"""统计分析功能"""
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List
import aiosqlite
from .database import get_db


async def get_user_stats(key_id: str) -> dict:
    """获取单个用户的统计数据"""
    db = await get_db()
    db.row_factory = aiosqlite.Row
    today = datetime.now().strftime('%Y-%m-%d')

    cursor = await db.execute(
        "SELECT SUM(total_requests), SUM(total_input_tokens), SUM(total_output_tokens), SUM(total_errors), AVG(avg_response_time_ms) FROM statistics WHERE key_id = ?",
        (key_id,)
    )
    total_stats = await cursor.fetchone()

    cursor = await db.execute(
        "SELECT total_requests, total_input_tokens, total_output_tokens, total_errors, avg_response_time_ms FROM statistics WHERE key_id = ? AND date = ?",
        (key_id, today)
    )
    today_stats = await cursor.fetchone()

    cursor = await db.execute(
        "SELECT AVG(response_time_ms), AVG(input_tokens + output_tokens) FROM request_logs WHERE key_id = ? ORDER BY request_time DESC LIMIT 100",
        (key_id,)
    )
    avg_time = await cursor.fetchone()

    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
    cursor = await db.execute(
        "SELECT date, total_requests, total_input_tokens, total_output_tokens, total_errors, avg_response_time_ms FROM statistics WHERE key_id = ? AND date >= ? ORDER BY date DESC",
        (key_id, seven_days_ago)
    )
    recent_stats = await cursor.fetchall()

    return {
        "total_requests": total_stats[0] or 0 if total_stats else 0,
        "total_input_tokens": total_stats[1] or 0 if total_stats else 0,
        "total_output_tokens": total_stats[2] or 0 if total_stats else 0,
        "total_errors": total_stats[3] or 0 if total_stats else 0,
        "avg_response_time_ms": round(total_stats[4] or 0, 2) if total_stats else 0,
        "today_requests": today_stats[0] or 0 if today_stats else 0,
        "today_input_tokens": today_stats[1] or 0 if today_stats else 0,
        "today_output_tokens": today_stats[2] or 0 if today_stats else 0,
        "today_errors": today_stats[3] or 0 if today_stats else 0,
        "today_avg_response_time_ms": round(today_stats[4] or 0, 2) if today_stats else 0,
        "avg_response_time_recent": round(avg_time[0] or 0, 2),
        "avg_tokens_per_request": round(avg_time[1] or 0, 2),
        "recent_7_days": [dict(row) for row in recent_stats]
    }


async def get_model_stats(model: str) -> dict:
    """获取单个模型的统计数据"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        "SELECT COUNT(*), AVG(response_time_ms), SUM(input_tokens), SUM(output_tokens), SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) FROM request_logs WHERE model = ?",
        (model,)
    )
    stats = await cursor.fetchone()

    if not stats:
        return {}

    return {
        "total_requests": stats[0] or 0,
        "avg_response_time_ms": round(stats[1] or 0, 2),
        "total_input_tokens": stats[2] or 0,
        "total_output_tokens": stats[3] or 0,
        "total_errors": stats[4] or 0
    }


async def get_dashboard_stats() -> dict:
    """获取仪表板总体统计"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    today = datetime.now().strftime('%Y-%m-%d')
    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')

    # 并发执行所有查询以提高性能
    async def get_today_stats():
        cursor = await db.execute("""
            SELECT
                SUM(total_requests) as requests_today,
                SUM(total_input_tokens) as input_tokens_today,
                SUM(total_output_tokens) as output_tokens_today,
                SUM(total_input_tokens + total_output_tokens) as tokens_today,
                SUM(total_errors) as errors_today,
                AVG(avg_response_time_ms) as avg_response_time_today
            FROM statistics
            WHERE date = ?
        """, (today,))
        return await cursor.fetchone()

    async def get_all_time_stats():
        cursor = await db.execute("""
            SELECT
                SUM(total_requests) as requests_all_time,
                SUM(total_input_tokens) as input_tokens_all_time,
                SUM(total_output_tokens) as output_tokens_all_time,
                SUM(total_input_tokens + total_output_tokens) as tokens_all_time,
                SUM(total_errors) as errors_all_time,
                AVG(avg_response_time_ms) as avg_response_time_all_time
            FROM statistics
        """)
        return await cursor.fetchone()

    async def get_active_users():
        cursor = await db.execute("""
            SELECT COUNT(DISTINCT key_id) as active_users
            FROM request_logs
            WHERE datetime(request_time) >= datetime('now', '-24 hours')
        """)
        return await cursor.fetchone()

    async def get_active_users_today():
        cursor = await db.execute("""
            SELECT COUNT(DISTINCT key_id) as active_users_today
            FROM statistics
            WHERE date = ?
        """, (today,))
        return await cursor.fetchone()

    async def get_active_ips():
        cursor = await db.execute("""
            SELECT COUNT(DISTINCT client_ip) as active_ips
            FROM request_logs
            WHERE datetime(request_time) >= datetime('now', '-24 hours') AND client_ip IS NOT NULL
        """)
        return await cursor.fetchone()

    async def get_hourly_trend():
        cursor = await db.execute("""
            SELECT strftime('%H', request_time) as hour, COUNT(*) as requests, AVG(response_time_ms) as avg_response_time, SUM(input_tokens + output_tokens) as tokens
            FROM request_logs
            WHERE datetime(request_time) >= datetime('now', '-24 hours')
            GROUP BY hour
            ORDER BY hour
        """)
        return await cursor.fetchall()

    async def get_daily_trend():
        cursor = await db.execute("""
            SELECT date, SUM(total_requests) as requests, SUM(total_input_tokens + total_output_tokens) as tokens, SUM(total_errors) as errors, AVG(avg_response_time_ms) as avg_response_time
            FROM statistics
            WHERE date >= ?
            GROUP BY date
            ORDER BY date
        """, (seven_days_ago,))
        return await cursor.fetchall()

    async def get_error_stats():
        cursor = await db.execute("""
            SELECT COUNT(*) as total, SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
            FROM request_logs
            WHERE datetime(request_time) >= datetime('now', '-24 hours')
        """)
        return await cursor.fetchone()

    # 并发执行所有查询
    [
        today_stats,
        all_time_stats,
        active_users,
        active_users_today,
        active_ips,
        hourly_trend,
        daily_trend,
        error_stats
    ] = await asyncio.gather(
        get_today_stats(),
        get_all_time_stats(),
        get_active_users(),
        get_active_users_today(),
        get_active_ips(),
        get_hourly_trend(),
        get_daily_trend(),
        get_error_stats()
    )

    total_requests = error_stats[0] or 0 if error_stats else 0
    total_errors = error_stats[1] or 0 if error_stats else 0
    error_rate = (total_errors / total_requests * 100) if total_requests > 0 else 0

    total_input = today_stats[1] or 0 if today_stats else 0
    total_output = today_stats[2] or 0 if today_stats else 0
    input_output_ratio = round(total_output / total_input, 2) if total_input > 0 else 0

    return {
        "requests_today": today_stats[0] or 0 if today_stats else 0,
        "input_tokens_today": total_input,
        "output_tokens_today": total_output,
        "tokens_today": today_stats[3] or 0 if today_stats else 0,
        "errors_today": today_stats[4] or 0 if today_stats else 0,
        "avg_response_time_today": round(today_stats[5] or 0, 2) if today_stats else 0,
        "input_output_ratio": input_output_ratio,
        "requests_all_time": all_time_stats[0] or 0 if all_time_stats else 0,
        "input_tokens_all_time": all_time_stats[1] or 0 if all_time_stats else 0,
        "output_tokens_all_time": all_time_stats[2] or 0 if all_time_stats else 0,
        "tokens_all_time": all_time_stats[3] or 0 if all_time_stats else 0,
        "errors_all_time": all_time_stats[4] or 0 if all_time_stats else 0,
        "avg_response_time_all_time": round(all_time_stats[5] or 0, 2) if all_time_stats else 0,
        "active_users_24h": active_users[0] or 0 if active_users else 0,
        "active_users_today": active_users_today[0] or 0 if active_users_today else 0,
        "active_ips_24h": active_ips[0] or 0 if active_ips else 0,
        "error_rate_24h": round(error_rate, 2),
        "hourly_trend": [dict(row) for row in hourly_trend],
        "daily_trend": [dict(row) for row in daily_trend]
    }


async def get_top_users(limit: int = 10) -> list:
    """获取活跃用户排行（今日）"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    today = datetime.now().strftime('%Y-%m-%d')
    cursor = await db.execute("""
        SELECT rl.key_id, ak.name, COUNT(*) as request_count, SUM(input_tokens + output_tokens) as total_tokens, AVG(response_time_ms) as avg_response_time
        FROM request_logs rl
        LEFT JOIN api_keys ak ON rl.key_id = ak.key_id
        WHERE date(rl.request_time) >= ?
        GROUP BY rl.key_id
        ORDER BY request_count DESC
        LIMIT ?
    """, (today, limit))
    top_users = await cursor.fetchall()
    return [dict(row) for row in top_users]


async def get_top_models(limit: int = 10) -> list:
    """获取热门模型排行（今日）"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    today = datetime.now().strftime('%Y-%m-%d')
    cursor = await db.execute("""
        SELECT model, COUNT(*) as request_count, AVG(response_time_ms) as avg_response_time, SUM(input_tokens + output_tokens) as total_tokens
        FROM request_logs
        WHERE date(request_time) >= ?
        GROUP BY model
        ORDER BY request_count DESC
        LIMIT ?
    """, (today, limit))
    top_models = await cursor.fetchall()
    return [dict(row) for row in top_models]


async def get_ip_stats(limit: int = 50) -> List[dict]:
    """获取 IP 统计"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    cursor = await db.execute(
        "SELECT ip_address, request_count, last_request_time, first_request_time FROM ip_statistics ORDER BY request_count DESC LIMIT ?",
        (limit,)
    )
    ip_stats = await cursor.fetchall()
    return [dict(row) for row in ip_stats]


async def get_model_statistics(limit_days: int = 30) -> List[dict]:
    """获取模型统计（按虚拟模型 ID）"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    date_limit = (datetime.now() - timedelta(days=limit_days)).strftime('%Y-%m-%d')
    cursor = await db.execute("""
        SELECT model_id, SUM(request_count) as total_requests, SUM(input_tokens) as total_input_tokens, SUM(output_tokens) as total_output_tokens, SUM(error_count) as total_errors, AVG(avg_response_time_ms) as avg_response_time
        FROM model_statistics
        WHERE date >= ?
        GROUP BY model_id
        ORDER BY total_requests DESC
    """, (date_limit,))
    stats = await cursor.fetchall()
    return [dict(row) for row in stats]


async def get_source_model_statistics(limit_days: int = 30) -> List[dict]:
    """获取源模型统计"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    date_limit = (datetime.now() - timedelta(days=limit_days)).strftime('%Y-%m-%d')
    cursor = await db.execute("""
        SELECT source_model, source_id, SUM(request_count) as total_requests, SUM(input_tokens) as total_input_tokens, SUM(output_tokens) as total_output_tokens, SUM(error_count) as total_errors, AVG(avg_response_time_ms) as avg_response_time
        FROM source_model_statistics
        WHERE date >= ?
        GROUP BY source_model, source_id
        ORDER BY total_requests DESC
    """, (date_limit,))
    stats = await cursor.fetchall()
    return [dict(row) for row in stats]


async def get_source_api_statistics(limit_days: int = 30) -> List[dict]:
    """获取源提供商统计"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    date_limit = (datetime.now() - timedelta(days=limit_days)).strftime('%Y-%m-%d')
    cursor = await db.execute("""
        SELECT source_id, SUM(request_count) as total_requests, SUM(input_tokens) as total_input_tokens, SUM(output_tokens) as total_output_tokens, SUM(error_count) as total_errors, AVG(avg_response_time_ms) as avg_response_time
        FROM source_api_statistics
        WHERE date >= ?
        GROUP BY source_id
        ORDER BY total_requests DESC
    """, (date_limit,))
    stats = await cursor.fetchall()
    return [dict(row) for row in stats]


async def get_error_statistics(limit_days: int = 30) -> List[dict]:
    """获取错误统计"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    date_limit = (datetime.now() - timedelta(days=limit_days)).strftime('%Y-%m-%d')
    cursor = await db.execute("""
        SELECT error_type, status_code, SUM(error_count) as total_errors
        FROM error_statistics
        WHERE date >= ?
        GROUP BY error_type, status_code
        ORDER BY total_errors DESC
    """, (date_limit,))
    stats = await cursor.fetchall()
    return [dict(row) for row in stats]


async def get_realtime_concurrent_stats() -> dict:
    """获取实时并发统计"""
    db = await get_db()
    db.row_factory = aiosqlite.Row

    cursor = await db.execute("""
        SELECT COUNT(*) as active_requests
        FROM request_logs
        WHERE datetime(request_time) >= datetime('now', '-1 minute')
    """)
    active_requests = await cursor.fetchone()

    cursor = await db.execute("""
        SELECT COUNT(*) as total_requests, AVG(response_time_ms) as avg_response_time
        FROM request_logs
        WHERE datetime(request_time) >= datetime('now', '-5 minutes')
    """)
    recent_stats = await cursor.fetchone()

    today = datetime.now().strftime('%Y-%m-%d')
    cursor = await db.execute("""
        SELECT SUM(request_count) as total_requests, SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens, AVG(avg_response_time_ms) as avg_response_time
        FROM realtime_stats
        WHERE period = ?
    """, (today,))
    realtime_stats = await cursor.fetchone()

    return {
        "active_requests_last_minute": active_requests[0] or 0 if active_requests else 0,
        "requests_last_5_minutes": recent_stats[0] or 0 if recent_stats else 0,
        "avg_response_time_last_5_minutes": round(recent_stats[1] or 0, 2) if recent_stats else 0,
        "requests_per_minute_recent": round((recent_stats[0] or 0) / 5, 2) if recent_stats else 0,
        "realtime_today": {
            "requests": realtime_stats[0] or 0 if realtime_stats else 0,
            "input_tokens": realtime_stats[1] or 0 if realtime_stats else 0,
            "output_tokens": realtime_stats[2] or 0 if realtime_stats else 0,
            "avg_response_time": round(realtime_stats[3] or 0, 2) if realtime_stats else 0
        }
    }
