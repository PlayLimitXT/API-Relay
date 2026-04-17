"""API 密钥认证和管理 - 使用 Base64 编码存储"""
import base64
import secrets
from datetime import datetime
from typing import Optional, Dict, Any
import aiosqlite
from .database import get_db


def encode_api_key(api_key: str) -> str:
    """Base64 编码 API 密钥（可逆）"""
    return base64.b64encode(api_key.encode('utf-8')).decode('utf-8')


def decode_api_key(encoded: str) -> str:
    """Base64 解码 API 密钥"""
    return base64.b64decode(encoded.encode('utf-8')).decode('utf-8')


def hash_api_key(api_key: str) -> str:
    """兼容旧接口：Base64 编码（原SHA-256哈希已弃用）"""
    return encode_api_key(api_key)


def generate_api_key() -> str:
    """生成新的 API 密钥"""
    return f"sk-{secrets.token_urlsafe(32)}"


async def create_api_key(
    name: str,
    expires_at: Optional[datetime] = None,
    rate_limit: int = 60,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """创建新的 API 密钥"""
    import json
    import uuid

    key_id = str(uuid.uuid4())
    api_key = generate_api_key()
    api_key_hash = hash_api_key(api_key)
    created_at = datetime.now().isoformat()
    expires_at_str = expires_at.isoformat() if expires_at else None
    metadata_str = json.dumps(metadata) if metadata else None

    db = await get_db()
    await db.execute(
        """
        INSERT INTO api_keys
        (key_id, api_key_hash, name, created_at, expires_at, is_active, rate_limit, metadata)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        """,
        (key_id, api_key_hash, name, created_at, expires_at_str, rate_limit, metadata_str)
    )
    await db.commit()

    return {
        "key_id": key_id,
        "api_key": api_key,  # 明文密钥仅在创建时返回
        "name": name,
        "created_at": created_at,
        "expires_at": expires_at_str,
        "is_active": True,
        "rate_limit": rate_limit
    }


async def validate_api_key(api_key: str) -> Optional[Dict[str, Any]]:
    """验证 API 密钥并返回密钥信息"""
    import json

    db = await get_db()
    db.row_factory = aiosqlite.Row

    # 使用 Base64 编码
    key_encoded = encode_api_key(api_key)
    cursor = await db.execute(
        """
        SELECT key_id, api_key_hash, name, created_at, expires_at,
               is_active, rate_limit, metadata
        FROM api_keys
        WHERE api_key_hash = ? AND is_active = 1
        """,
        (key_encoded,)
    )
    row = await cursor.fetchone()

    if row:
        # 检查是否过期
        if row['expires_at']:
            expires_at = datetime.fromisoformat(row['expires_at'])
            if datetime.now() > expires_at:
                return None

        return {
            "key_id": row['key_id'],
            "name": row['name'],
            "rate_limit": row['rate_limit'],
            "metadata": json.loads(row['metadata']) if row['metadata'] else None
        }

    return None


async def list_api_keys() -> list:
    """列出所有 API 密钥（返回明文密钥，支持管理员查看和复制）"""
    import json

    db = await get_db()
    db.row_factory = aiosqlite.Row
    cursor = await db.execute(
        """
        SELECT key_id, api_key_hash, name, created_at, expires_at, is_active, rate_limit, metadata
        FROM api_keys
        ORDER BY created_at DESC
        """
    )
    rows = await cursor.fetchall()

    result = []
    for row in rows:
        key_encoded = row['api_key_hash']
        # 尝试解码 Base64 获取明文密钥
        try:
            api_key = decode_api_key(key_encoded)
        except Exception:
            # 如果解码失败，可能是旧格式或损坏的数据
            api_key = f"sk-invalid-{row['key_id'][:8]}"

        result.append({
            "key_id": row['key_id'],
            "name": row['name'],
            "created_at": row['created_at'],
            "expires_at": row['expires_at'],
            "is_active": bool(row['is_active']),
            "rate_limit": row['rate_limit'],
            "api_key": api_key,  # 返回明文密钥
            "metadata": json.loads(row['metadata']) if row['metadata'] else None
        })

    return result


async def get_api_key(key_id: str) -> Optional[Dict[str, Any]]:
    """获取单个 API 密钥（返回明文密钥，支持管理员查看和复制）"""
    import json

    db = await get_db()
    db.row_factory = aiosqlite.Row
    cursor = await db.execute(
        """
        SELECT key_id, api_key_hash, name, created_at, expires_at, is_active, rate_limit, metadata
        FROM api_keys
        WHERE key_id = ?
        """,
        (key_id,)
    )
    row = await cursor.fetchone()

    if not row:
        return None

    key_encoded = row['api_key_hash']
    # 尝试解码 Base64 获取明文密钥
    try:
        api_key = decode_api_key(key_encoded)
    except Exception:
        # 如果解码失败，可能是旧格式或损坏的数据
        api_key = f"sk-invalid-{row['key_id'][:8]}"

    return {
        "key_id": row['key_id'],
        "name": row['name'],
        "created_at": row['created_at'],
        "expires_at": row['expires_at'],
        "is_active": bool(row['is_active']),
        "rate_limit": row['rate_limit'],
        "api_key": api_key,  # 返回明文密钥
        "metadata": json.loads(row['metadata']) if row['metadata'] else None
    }


async def revoke_api_key(key_id: str) -> bool:
    """禁用 API 密钥"""
    db = await get_db()
    cursor = await db.execute(
        "UPDATE api_keys SET is_active = 0 WHERE key_id = ?",
        (key_id,)
    )
    await db.commit()
    return cursor.rowcount > 0


async def enable_api_key(key_id: str) -> bool:
    """启用 API 密钥"""
    db = await get_db()
    cursor = await db.execute(
        "UPDATE api_keys SET is_active = 1 WHERE key_id = ?",
        (key_id,)
    )
    await db.commit()
    return cursor.rowcount > 0


async def update_api_key(key_id: str, name: str = None, rate_limit: int = None,
                        is_active: bool = None, metadata: dict = None) -> bool:
    """更新 API 密钥配置"""
    import json

    db = await get_db()
    updates = []
    params = []

    if name is not None:
        updates.append("name = ?")
        params.append(name)
    if rate_limit is not None:
        updates.append("rate_limit = ?")
        params.append(rate_limit)
    if is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if is_active else 0)
    if metadata is not None:
        updates.append("metadata = ?")
        params.append(json.dumps(metadata))

    if not updates:
        return False

    params.append(key_id)
    query = f"UPDATE api_keys SET {', '.join(updates)} WHERE key_id = ?"

    cursor = await db.execute(query, params)
    await db.commit()
    return cursor.rowcount > 0


async def delete_api_key(key_id: str) -> bool:
    """删除 API 密钥"""
    db = await get_db()
    cursor = await db.execute(
        "DELETE FROM api_keys WHERE key_id = ?",
        (key_id,)
    )
    await db.commit()
    return cursor.rowcount > 0
