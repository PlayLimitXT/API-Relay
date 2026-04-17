"""模型管理核心逻辑 - 支持源API、虚拟模型ID、绑定关系三步分离"""
import uuid
import json
from typing import Optional, Dict, List, Any
from datetime import datetime
from .database import get_db
from .models import (
    SourceAPICreate, SourceAPIUpdate, SourceAPI,
    VirtualModelCreate, VirtualModelUpdate, VirtualModel,
    ModelBindingCreate, ModelBindingUpdate, ModelBinding,
    ModelConfig
)


# ==================== 源API管理 ====================

async def create_source_api(data: SourceAPICreate) -> Dict[str, Any]:
    """创建源API配置"""
    source_id = str(uuid.uuid4())
    created_at = datetime.now().isoformat()

    # 优先使用直接传入的 supported_models，其次从 metadata 中提取
    supported_models = data.supported_models
    if supported_models is None and data.metadata:
        meta = data.metadata.copy() if data.metadata else {}
        supported_models = meta.pop('supported_models', None) if meta else None
    else:
        meta = data.metadata.copy() if data.metadata else {}

    db = await get_db()
    await db.execute(
        """
        INSERT INTO source_apis (source_id, name, base_url, api_key, supported_models, is_active, created_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (source_id, data.name, data.base_url, data.api_key,
         json.dumps(supported_models) if supported_models else None,
         1, created_at,
         json.dumps(meta) if meta else None)
    )
    await db.commit()

    return {
        "source_id": source_id,
        "name": data.name,
        "base_url": data.base_url,
        "supported_models": supported_models or [],
        "is_active": True,
        "created_at": created_at,
        "metadata": meta if meta else None
    }


def _parse_source_row(row: dict) -> dict:
    """解析源API行的JSON字段"""
    if row.get('supported_models'):
        try:
            row['supported_models'] = json.loads(row['supported_models'])
        except Exception:
            row['supported_models'] = []
    else:
        row['supported_models'] = []
    if row.get('metadata'):
        try:
            row['metadata'] = json.loads(row['metadata'])
        except Exception:
            row['metadata'] = None
    return row


async def list_source_apis() -> List[Dict[str, Any]]:
    """列出所有源API配置"""
    import aiosqlite
    db = await get_db()
    db.row_factory = aiosqlite.Row
    cursor = await db.execute("SELECT * FROM source_apis ORDER BY created_at DESC")
    rows = await cursor.fetchall()
    return [_parse_source_row(dict(row)) for row in rows]


async def get_source_api(source_id: str) -> Optional[Dict[str, Any]]:
    """获取源API配置详情"""
    import aiosqlite
    db = await get_db()
    db.row_factory = aiosqlite.Row
    cursor = await db.execute("SELECT * FROM source_apis WHERE source_id = ?", (source_id,))
    row = await cursor.fetchone()
    return _parse_source_row(dict(row)) if row else None


async def update_source_api(source_id: str, data: SourceAPIUpdate) -> bool:
    """更新源API配置"""
    db = await get_db()
    updates = []
    params = []

    if data.name is not None:
        updates.append("name = ?")
        params.append(data.name)
    if data.base_url is not None:
        updates.append("base_url = ?")
        params.append(data.base_url)
    if data.api_key is not None:
        updates.append("api_key = ?")
        params.append(data.api_key)
    if data.supported_models is not None:
        updates.append("supported_models = ?")
        params.append(json.dumps(data.supported_models))
    if data.is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if data.is_active else 0)
    if data.metadata is not None:
        updates.append("metadata = ?")
        params.append(json.dumps(data.metadata))

    if not updates:
        return False

    params.append(source_id)
    query = f"UPDATE source_apis SET {', '.join(updates)} WHERE source_id = ?"
    await db.execute(query, params)
    await db.commit()
    return True


async def delete_source_api(source_id: str) -> bool:
    """删除源API配置"""
    db = await get_db()
    await db.execute("DELETE FROM model_bindings WHERE source_id = ?", (source_id,))
    await db.execute("DELETE FROM source_apis WHERE source_id = ?", (source_id,))
    await db.commit()
    return True


# ==================== 虚拟模型管理 ====================

async def create_virtual_model(data: VirtualModelCreate) -> Dict[str, Any]:
    """创建虚拟模型ID"""
    model_id = data.model_id or str(uuid.uuid4())
    created_at = datetime.now().isoformat()

    db = await get_db()
    await db.execute(
        """
        INSERT INTO virtual_models (model_id, name, description, is_active, created_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (model_id, data.name, data.description, 1, created_at,
         json.dumps(data.metadata) if data.metadata else None)
    )
    await db.commit()

    return {
        "model_id": model_id,
        "name": data.name,
        "description": data.description,
        "is_active": True,
        "created_at": created_at,
        "metadata": data.metadata
    }


def _parse_model_row(row: dict) -> dict:
    """解析模型行的JSON字段"""
    if row.get('metadata'):
        try:
            row['metadata'] = json.loads(row['metadata'])
        except Exception:
            row['metadata'] = None
    return row


async def list_virtual_models() -> List[Dict[str, Any]]:
    """列出所有虚拟模型"""
    import aiosqlite
    db = await get_db()
    db.row_factory = aiosqlite.Row
    cursor = await db.execute("SELECT * FROM virtual_models ORDER BY created_at DESC")
    rows = await cursor.fetchall()
    return [_parse_model_row(dict(row)) for row in rows]


async def get_virtual_model(model_id: str) -> Optional[Dict[str, Any]]:
    """获取虚拟模型详情"""
    import aiosqlite
    db = await get_db()
    db.row_factory = aiosqlite.Row
    cursor = await db.execute("SELECT * FROM virtual_models WHERE model_id = ?", (model_id,))
    row = await cursor.fetchone()
    return _parse_model_row(dict(row)) if row else None


async def update_virtual_model(model_id: str, data: VirtualModelUpdate) -> bool:
    """更新虚拟模型"""
    db = await get_db()
    updates = []
    params = []

    if data.name is not None:
        updates.append("name = ?")
        params.append(data.name)
    if data.description is not None:
        updates.append("description = ?")
        params.append(data.description)
    if data.is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if data.is_active else 0)
    if data.metadata is not None:
        updates.append("metadata = ?")
        params.append(json.dumps(data.metadata))

    if not updates:
        return False

    params.append(model_id)
    query = f"UPDATE virtual_models SET {', '.join(updates)} WHERE model_id = ?"
    await db.execute(query, params)
    await db.commit()
    return True


async def delete_virtual_model(model_id: str) -> bool:
    """删除虚拟模型"""
    db = await get_db()
    await db.execute("DELETE FROM model_bindings WHERE virtual_model_id = ?", (model_id,))
    await db.execute("DELETE FROM virtual_models WHERE model_id = ?", (model_id,))
    await db.commit()
    return True


# ==================== 模型绑定管理 ====================

async def create_model_binding(data: ModelBindingCreate) -> Dict[str, Any]:
    """创建模型绑定关系"""
    binding_id = data.binding_id or str(uuid.uuid4())

    db = await get_db()
    import aiosqlite
    db.row_factory = aiosqlite.Row

    cursor = await db.execute("SELECT model_id FROM virtual_models WHERE model_id = ?",
                              (data.virtual_model_id,))
    if not await cursor.fetchone():
        raise ValueError(f"Virtual model '{data.virtual_model_id}' does not exist")

    cursor = await db.execute("SELECT source_id FROM source_apis WHERE source_id = ? AND is_active = 1",
                              (data.source_id,))
    if not await cursor.fetchone():
        raise ValueError(f"Source API '{data.source_id}' does not exist or is inactive")

    await db.execute(
        """
        INSERT INTO model_bindings (binding_id, virtual_model_id, source_id, source_model_name, priority, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (binding_id, data.virtual_model_id, data.source_id, data.source_model_name,
         data.priority, 1)
    )
    await db.commit()

    return {
        "binding_id": binding_id,
        "virtual_model_id": data.virtual_model_id,
        "source_id": data.source_id,
        "source_model_name": data.source_model_name,
        "priority": data.priority,
        "is_active": True
    }


async def list_model_bindings(virtual_model_id: Optional[str] = None,
                             source_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """列出模型绑定关系"""
    import aiosqlite
    db = await get_db()
    db.row_factory = aiosqlite.Row

    query = """
        SELECT mb.*, vm.name as virtual_model_name, sa.name as source_name
        FROM model_bindings mb
        LEFT JOIN virtual_models vm ON mb.virtual_model_id = vm.model_id
        LEFT JOIN source_apis sa ON mb.source_id = sa.source_id
        WHERE 1=1
    """
    params = []

    if virtual_model_id:
        query += " AND mb.virtual_model_id = ?"
        params.append(virtual_model_id)
    if source_id:
        query += " AND mb.source_id = ?"
        params.append(source_id)

    query += " ORDER BY mb.priority DESC"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def get_model_binding(binding_id: str) -> Optional[Dict[str, Any]]:
    """获取模型绑定详情"""
    import aiosqlite
    db = await get_db()
    db.row_factory = aiosqlite.Row
    cursor = await db.execute("SELECT * FROM model_bindings WHERE binding_id = ?", (binding_id,))
    row = await cursor.fetchone()
    return dict(row) if row else None


async def update_model_binding(binding_id: str, data: ModelBindingUpdate) -> bool:
    """更新模型绑定关系（支持换绑）"""
    db = await get_db()
    updates = []
    params = []

    if data.virtual_model_id is not None:
        import aiosqlite
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT model_id FROM virtual_models WHERE model_id = ?",
                                  (data.virtual_model_id,))
        if not await cursor.fetchone():
            raise ValueError(f"Virtual model '{data.virtual_model_id}' does not exist")
        updates.append("virtual_model_id = ?")
        params.append(data.virtual_model_id)

    if data.source_id is not None:
        import aiosqlite
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT source_id FROM source_apis WHERE source_id = ? AND is_active = 1",
                                  (data.source_id,))
        if not await cursor.fetchone():
            raise ValueError(f"Source API '{data.source_id}' does not exist or is inactive")
        updates.append("source_id = ?")
        params.append(data.source_id)

    if data.source_model_name is not None:
        updates.append("source_model_name = ?")
        params.append(data.source_model_name)
    if data.priority is not None:
        updates.append("priority = ?")
        params.append(data.priority)
    if data.is_active is not None:
        updates.append("is_active = ?")
        params.append(1 if data.is_active else 0)

    if not updates:
        return False

    params.append(binding_id)
    query = f"UPDATE model_bindings SET {', '.join(updates)} WHERE binding_id = ?"
    await db.execute(query, params)
    await db.commit()
    return True


async def delete_model_binding(binding_id: str) -> bool:
    """删除模型绑定关系"""
    db = await get_db()
    await db.execute("DELETE FROM model_bindings WHERE binding_id = ?", (binding_id,))
    await db.commit()
    return True


# ==================== 运行时模型解析 ====================

async def resolve_model_config(virtual_model_id: str) -> Optional[Dict[str, Any]]:
    """根据虚拟模型ID解析出实际的源API配置"""
    import aiosqlite
    db = await get_db()
    db.row_factory = aiosqlite.Row

    cursor = await db.execute("""
        SELECT mb.source_model_name, sa.base_url, sa.api_key, sa.source_id
        FROM model_bindings mb
        JOIN source_apis sa ON mb.source_id = sa.source_id
        WHERE mb.virtual_model_id = ? AND mb.is_active = 1 AND sa.is_active = 1
        ORDER BY mb.priority DESC
        LIMIT 1
    """, (virtual_model_id,))

    binding = await cursor.fetchone()

    if binding:
        return {
            "source_base_url": binding['base_url'],
            "source_model": binding['source_model_name'],
            "source_api_key": binding['api_key'],
            "source_id": binding['source_id'],
            "enabled": True
        }
    return None


async def list_available_models_with_bindings() -> List[Dict[str, Any]]:
    """列出所有可用的模型（包含源API信息）"""
    import aiosqlite
    db = await get_db()
    db.row_factory = aiosqlite.Row

    cursor = await db.execute("""
        SELECT vm.model_id, vm.name, vm.description,
               GROUP_CONCAT(sa.name || ' -> ' || mb.source_model_name, '|') as sources
        FROM virtual_models vm
        LEFT JOIN model_bindings mb ON vm.model_id = mb.virtual_model_id AND mb.is_active = 1
        LEFT JOIN source_apis sa ON mb.source_id = sa.source_id AND sa.is_active = 1
        WHERE vm.is_active = 1
        GROUP BY vm.model_id
        ORDER BY vm.name
    """)

    rows = await cursor.fetchall()
    result = []
    for row in rows:
        result.append({
            "id": row['model_id'],
            "name": row['name'],
            "description": row['description'],
            "sources": row['sources'] if row['sources'] else "Unbound",
            "object": "model",
            "created": int(datetime.now().timestamp())
        })

    return result
