"""大模型API本地中转服务 - 主程序"""
import json
import os
import time
import asyncio
import aiosqlite
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
from fastapi import FastAPI, Request, Response, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse, HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

# Load .env file if it exists (simple parser, no extra dependencies)
def _load_env_file(env_path: Path):
    if not env_path.exists():
        return
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and value and key not in os.environ:
                    os.environ[key] = value
    except Exception:
        pass  # Ignore errors in .env file

_env_file = Path(__file__).parent / ".env"
_load_env_file(_env_file)

from src.database import init_database
from src.models import (
    AdminLogin, APIKeyCreate, APIKeyResponse, APIKeyInfo,
    ChatCompletionRequest, ConfigUpdate
)
from src.auth import (
    create_api_key, validate_api_key, list_api_keys,
    revoke_api_key, delete_api_key
)
from src.proxy import APIProxy
from src.rate_limiter import rate_limiter
from src.logger import RequestLogger, log_request, get_request_logs, get_statistics, clear_request_logs, clear_statistics
from src.stats import (
    get_user_stats, get_model_stats, get_dashboard_stats,
    get_top_users, get_top_models
)


def _load_config() -> dict:
    """加载配置文件，并支持环境变量覆盖"""
    config_path = Path(__file__).parent / "config.json"
    with open(config_path, 'r', encoding='utf-8') as f:
        cfg = json.load(f)

    # 环境变量覆盖敏感配置
    env_admin = os.environ.get("ADMIN_PASSWORD")
    if env_admin:
        cfg["admin_password"] = env_admin

    env_src_url = os.environ.get("SOURCE_API_URL")
    env_src_key = os.environ.get("SOURCE_API_KEY")
    env_src_model = os.environ.get("SOURCE_MODEL")
    if env_src_url or env_src_key or env_src_model:
        if "models" not in cfg:
            cfg["models"] = {}
        if "default" not in cfg["models"]:
            cfg["models"]["default"] = {}
        if env_src_url:
            cfg["models"]["default"]["source_base_url"] = env_src_url
        if env_src_key:
            cfg["models"]["default"]["source_api_key"] = env_src_key
        if env_src_model:
            cfg["models"]["default"]["source_model"] = env_src_model

    env_host = os.environ.get("SERVER_HOST")
    env_port = os.environ.get("SERVER_PORT")
    if env_host:
        cfg.setdefault("server", {})["host"] = env_host
    if env_port:
        cfg.setdefault("server", {})["port"] = int(env_port)

    env_log_level = os.environ.get("LOG_LEVEL")
    if env_log_level:
        cfg.setdefault("logging", {})["level"] = env_log_level

    return cfg


# 加载配置
CONFIG_PATH = Path(__file__).parent / "config.json"
config = _load_config()

# 创建FastAPI应用
app = FastAPI(title="API Relay Service", version="1.0.0")

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建代理实例
proxy = APIProxy(config)
logger = RequestLogger(config)

# 管理员会话存储（简化版，生产环境应使用Redis）
admin_sessions = {}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """限流中间件"""

    async def dispatch(self, request: Request, call_next):
        # 只对API请求限流，不对管理面板限流
        if request.url.path.startswith("/v1/") or request.url.path.startswith("/admin/api"):
            # 从Authorization头提取API Key
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                api_key = auth_header.replace("Bearer ", "")
                key_info = await validate_api_key(api_key)

                if key_info:
                    # 检查用户限流
                    rate_limit_config = config.get('rate_limit', {})
                    max_requests = key_info.get('rate_limit', rate_limit_config.get('default_key_rpm', 60))

                    is_allowed, remaining, reset_time = rate_limiter.is_allowed(
                        key_info['key_id'], max_requests
                    )

                    if not is_allowed:
                        return JSONResponse(
                            status_code=429,
                            content={
                                "error": {
                                    "message": "Rate limit exceeded",
                                    "type": "rate_limit_error"
                                }
                            },
                            headers={
                                "X-RateLimit-Limit": str(max_requests),
                                "X-RateLimit-Remaining": "0",
                                "X-RateLimit-Reset": str(reset_time)
                            }
                        )

                    # 添加限流头
                    response = await call_next(request)
                    response.headers["X-RateLimit-Limit"] = str(max_requests)
                    response.headers["X-RateLimit-Remaining"] = str(remaining)
                    response.headers["X-RateLimit-Reset"] = str(reset_time)
                    return response

        return await call_next(request)


app.add_middleware(RateLimitMiddleware)


# ==================== OpenAI兼容API端点 ====================

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    """聊天补全API"""
    start_time = time.time()

    # 验证API Key
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing API key")

    api_key = auth_header.replace("Bearer ", "")
    key_info = await validate_api_key(api_key)

    if not key_info:
        raise HTTPException(status_code=401, detail="Invalid API key")

    # 解析请求
    request_data = await request.json()
    model_name = request_data.get('model')

    # 检查模型配置
    model_config = await proxy.get_model_config(model_name)
    if not model_config:
        raise HTTPException(status_code=400, detail=f"Model {model_name} not available")

    # 是否流式请求
    stream = request_data.get('stream', False)
    client_ip = request.client.host if request.client else None
    
    # 记录请求来源
    logger.log_info(f"Request from client_ip={client_ip}, model={model_name}, stream={stream}")

    try:
        if stream:
            # 流式响应
            input_tokens = 0
            output_tokens = 0
            response_time_ms = 0

            async def stream_generator():
                nonlocal input_tokens, output_tokens, response_time_ms
                chunk_count = 0
                last_line_seen = ""
                try:
                    async for chunk in proxy.forward_chat_completion_stream(request_data, model_config):
                        chunk_count += 1
                        # chunk是SSE格式的文本，按行处理
                        # 每个chunk可能包含多行，用\n分割
                        lines = chunk.strip().split('\n')
                        for line in lines:
                            line = line.strip()
                            if line:
                                last_line_seen = line
                            if line.startswith("data: "):
                                try:
                                    chunk_text = line.replace("data: ", "").strip()
                                    if chunk_text == "[DONE]":
                                        logger.log_info(f"Received [DONE] after {chunk_count} chunks")
                                        continue
                                    if chunk_text:
                                        chunk_data = json.loads(chunk_text)
                                        if 'usage' in chunk_data and chunk_data.get('usage'):
                                            usage = chunk_data['usage']
                                            input_tokens = usage.get('prompt_tokens', 0)
                                            output_tokens = usage.get('completion_tokens', 0)
                                            response_time_ms = int((time.time() - start_time) * 1000)
                                            logger.log_info(
                                                f"Stream token usage extracted: input={input_tokens}, output={output_tokens}, time={response_time_ms}ms"
                                            )
                                except json.JSONDecodeError:
                                    pass  # 忽略解析错误，可能是不完整的chunk
                        yield chunk
                except Exception as e:
                    error_detail = str(e.detail) if hasattr(e, 'detail') else str(e)
                    logger.log_error(f"Stream error: {error_detail}")
                    yield f"data: {json.dumps({'error': {'message': error_detail}})}\n\n"
                finally:
                    response_time_ms = int((time.time() - start_time) * 1000)
                    logger.log_info(
                        f"Stream completed: key_id={key_info['key_id']}, model={model_name}, "
                        f"chunks={chunk_count}, input_tokens={input_tokens}, output_tokens={output_tokens}, time={response_time_ms}ms"
                    )
                    await log_request(
                        key_info['key_id'], client_ip, model_name,
                        model_config.source_model, 200,
                        input_tokens, output_tokens, response_time_ms
                    )

            return StreamingResponse(
                stream_generator(),
                media_type="text/event-stream"
            )
        else:
            # 非流式响应
            result = await proxy.forward_chat_completion(
                request_data, model_config, client_ip, key_info['key_id']
            )

            # 记录日志
            await log_request(
                key_info['key_id'], client_ip, model_name,
                model_config.source_model, result['status_code'],
                result['input_tokens'], result['output_tokens'],
                result['response_time_ms']
            )

            return result['response']

    except HTTPException as e:
        response_time_ms = int((time.time() - start_time) * 1000)
        await log_request(
            key_info['key_id'], client_ip, model_name,
            model_config.source_model, e.status_code,
            0, 0, response_time_ms, str(e.detail)
        )
        raise e
    except Exception as e:
        # 捕获所有其他异常
        response_time_ms = int((time.time() - start_time) * 1000)
        await log_request(
            key_info['key_id'], client_ip, model_name,
            model_config.source_model, 500,
            0, 0, response_time_ms, str(e)
        )
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/models")
async def list_models():
    """列出可用模型（优先从数据库）"""
    try:
        models = await proxy.list_available_models_db()
        return {
            "object": "list",
            "data": models
        }
    except Exception as e:
        # 回退到配置文件方式
        return {
            "object": "list",
            "data": proxy.list_available_models()
        }


@app.post("/v1/embeddings")
async def embeddings(request: Request):
    """向量嵌入API"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing API key")

    api_key = auth_header.replace("Bearer ", "")
    key_info = await validate_api_key(api_key)

    if not key_info:
        raise HTTPException(status_code=401, detail="Invalid API key")

    request_data = await request.json()
    model_name = request_data.get('model')

    model_config = await proxy.get_model_config(model_name)
    if not model_config:
        raise HTTPException(status_code=400, detail=f"Model {model_name} not available")

    try:
        result = await proxy.forward_embeddings(request_data, model_config)
        return result
    except HTTPException:
        raise



# ==================== 管理员API - 模型管理 ====================

@app.post("/admin/api/source-apis")
async def create_source_api(request: Request):
    """创建源API配置"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.models import SourceAPICreate
    from src.model_manager import create_source_api

    body = await request.json()
    data = SourceAPICreate(**body)

    result = await create_source_api(data)
    return result


@app.get("/admin/api/source-apis")
async def list_source_apis(request: Request):
    """列出所有源API配置"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.model_manager import list_source_apis
    result = await list_source_apis()
    return {"source_apis": result}


@app.get("/admin/api/source-apis/{source_id}")
async def get_source_api(source_id: str, request: Request):
    """获取源API配置详情"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.model_manager import get_source_api
    result = await get_source_api(source_id)
    if not result:
        raise HTTPException(status_code=404, detail="Source API not found")
    return result


@app.patch("/admin/api/source-apis/{source_id}")
async def update_source_api(source_id: str, request: Request):
    """更新源API配置"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.models import SourceAPIUpdate
    from src.model_manager import update_source_api

    body = await request.json()
    data = SourceAPIUpdate(**body)

    success = await update_source_api(source_id, data)
    if not success:
        raise HTTPException(status_code=400, detail="Update failed")
    return {"message": "Source API updated"}


@app.delete("/admin/api/source-apis/{source_id}")
async def delete_source_api(source_id: str, request: Request):
    """删除源API配置"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.model_manager import delete_source_api
    await delete_source_api(source_id)
    return {"message": "Source API deleted"}


@app.post("/admin/api/virtual-models")
async def create_virtual_model(request: Request):
    """创建虚拟模型ID"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.models import VirtualModelCreate
    from src.model_manager import create_virtual_model

    body = await request.json()
    data = VirtualModelCreate(**body)

    try:
        result = await create_virtual_model(data)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/admin/api/virtual-models")
async def list_virtual_models(request: Request):
    """列出所有虚拟模型"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.model_manager import list_virtual_models
    result = await list_virtual_models()
    return {"virtual_models": result}


@app.get("/admin/api/virtual-models/{model_id}")
async def get_virtual_model(model_id: str, request: Request):
    """获取虚拟模型详情"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.model_manager import get_virtual_model
    result = await get_virtual_model(model_id)
    if not result:
        raise HTTPException(status_code=404, detail="Virtual model not found")
    return result


@app.patch("/admin/api/virtual-models/{model_id}")
async def update_virtual_model(model_id: str, request: Request):
    """更新虚拟模型"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.models import VirtualModelUpdate
    from src.model_manager import update_virtual_model

    body = await request.json()
    data = VirtualModelUpdate(**body)

    success = await update_virtual_model(model_id, data)
    if not success:
        raise HTTPException(status_code=400, detail="Update failed")
    return {"message": "Virtual model updated"}


@app.delete("/admin/api/virtual-models/{model_id}")
async def delete_virtual_model(model_id: str, request: Request):
    """删除虚拟模型"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.model_manager import delete_virtual_model
    await delete_virtual_model(model_id)
    return {"message": "Virtual model deleted"}


@app.post("/admin/api/model-bindings")
async def create_model_binding(request: Request):
    """创建模型绑定关系"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.models import ModelBindingCreate
    from src.model_manager import create_model_binding

    body = await request.json()
    data = ModelBindingCreate(**body)

    try:
        result = await create_model_binding(data)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/admin/api/model-bindings")
async def list_model_bindings(request: Request, virtual_model_id: Optional[str] = None, source_id: Optional[str] = None):
    """列出模型绑定关系"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.model_manager import list_model_bindings
    result = await list_model_bindings(virtual_model_id, source_id)
    return {"model_bindings": result}


@app.get("/admin/api/model-bindings/{binding_id}")
async def get_model_binding(binding_id: str, request: Request):
    """获取模型绑定详情"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.model_manager import get_model_binding
    result = await get_model_binding(binding_id)
    if not result:
        raise HTTPException(status_code=404, detail="Model binding not found")
    return result


@app.patch("/admin/api/model-bindings/{binding_id}")
async def update_model_binding(binding_id: str, request: Request):
    """更新模型绑定关系（支持换绑）"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.models import ModelBindingUpdate
    from src.model_manager import update_model_binding

    body = await request.json()
    data = ModelBindingUpdate(**body)

    try:
        success = await update_model_binding(binding_id, data)
        if not success:
            raise HTTPException(status_code=400, detail="Update failed")
        return {"message": "Model binding updated"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/admin/api/model-bindings/{binding_id}")
async def delete_model_binding(binding_id: str, request: Request):
    """删除模型绑定关系"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.model_manager import delete_model_binding
    await delete_model_binding(binding_id)
    return {"message": "Model binding deleted"}


# ==================== 管理员API端点 ====================

def verify_admin_session(session_token: str) -> bool:
    """验证管理员会话"""
    if session_token in admin_sessions:
        session = admin_sessions[session_token]
        # 检查会话是否过期（24小时）
        if datetime.now() < session['expires_at']:
            return True
        else:
            del admin_sessions[session_token]
    return False


@app.post("/admin/api/login")
async def admin_login(login_data: AdminLogin):
    """管理员登录"""
    if login_data.password != config['admin_password']:
        raise HTTPException(status_code=401, detail="Invalid password")

    # 创建会话
    import secrets
    session_token = secrets.token_urlsafe(32)
    admin_sessions[session_token] = {
        'created_at': datetime.now(),
        'expires_at': datetime.now() + timedelta(hours=24)
    }

    return {"session_token": session_token}


@app.get("/admin/api/dashboard")
async def admin_dashboard(request: Request):
    """仪表板数据"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    dashboard_stats = await get_dashboard_stats()
    top_users = await get_top_users(10)
    top_models = await get_top_models(10)

    return {
        "dashboard": dashboard_stats,
        "top_users": top_users,
        "top_models": top_models
    }


@app.get("/admin/api/keys")
async def admin_list_keys(request: Request):
    """列出所有API密钥"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    keys = await list_api_keys()
    return {"keys": keys}


@app.post("/admin/api/keys")
async def admin_create_key(request: Request, key_data: APIKeyCreate):
    """创建新API密钥"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    new_key = await create_api_key(
        name=key_data.name,
        expires_at=key_data.expires_at,
        rate_limit=key_data.rate_limit,
        metadata=key_data.metadata
    )

    logger.log_info(f"Created new API key: {new_key['key_id']} for {key_data.name}")
    return new_key


@app.patch("/admin/api/keys/{key_id}")
async def admin_update_key(request: Request, key_id: str):
    """更新密钥配置（名称、限流、状态等）"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.auth import update_api_key, enable_api_key, revoke_api_key
    from src.models import APIKeyUpdate

    body = await request.json()
    update_data = APIKeyUpdate(**body)

    # 如果只更新is_active，使用专门的函数
    if update_data.is_active is not None and update_data.name is None and update_data.rate_limit is None:
        if update_data.is_active:
            success = await enable_api_key(key_id)
            action = "enabled"
        else:
            success = await revoke_api_key(key_id)
            action = "disabled"

        if success:
            logger.log_info(f"Key {key_id} {action}")
            return {"message": f"Key {action}", "is_active": update_data.is_active}
        else:
            raise HTTPException(status_code=404, detail="Key not found")

    # 更新其他字段
    success = await update_api_key(
        key_id=key_id,
        name=update_data.name,
        rate_limit=update_data.rate_limit,
        is_active=update_data.is_active,
        metadata=update_data.metadata
    )

    if success:
        logger.log_info(f"Updated API key: {key_id}")
        return {"message": "Key updated"}
    else:
        raise HTTPException(status_code=404, detail="Key not found")


@app.delete("/admin/api/keys/{key_id}")
async def admin_delete_key(request: Request, key_id: str):
    """删除 API 密钥"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    success = await delete_api_key(key_id)
    if success:
        logger.log_info(f"Deleted API key: {key_id}")
        return {"message": "Key deleted"}
    else:
        raise HTTPException(status_code=404, detail="Key not found")


@app.get("/admin/api/keys/{key_id}")
async def admin_get_key(request: Request, key_id: str):
    """获取单个密钥详情"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    keys = await list_api_keys()
    key = next((k for k in keys if k['key_id'] == key_id), None)

    if not key:
        raise HTTPException(status_code=404, detail="Key not found")

    # 获取该密钥的统计信息
    stats = await get_user_stats(key_id)

    return {
        **key,
        "stats": stats
    }


@app.get("/admin/api/logs")
async def admin_get_logs(
    request: Request,
    limit: int = 100,
    offset: int = 0,
    key_id: Optional[str] = None,
    model: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """获取请求日志"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    logs = await get_request_logs(limit, offset, key_id, model, start_date, end_date)
    return {"logs": logs}


@app.post("/admin/api/logs/clear")
async def admin_clear_logs(request: Request):
    """清空所有请求日志和统计数据（保留，兼容旧版）"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    logs_deleted = await clear_request_logs()
    stats_deleted = await clear_statistics()

    logger.log_info(f"Cleared {logs_deleted} log entries and {stats_deleted} statistics records")
    return {"message": "Logs cleared", "logs_deleted": logs_deleted, "statistics_deleted": stats_deleted}


@app.post("/admin/api/cleanup/logs")
async def admin_cleanup_logs(
    request: Request,
    key_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    model: Optional[str] = None,
    status_filter: Optional[str] = None
):
    """按条件清理请求日志"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    deleted = await clear_request_logs(key_id, start_date, end_date, model, status_filter)

    conditions = []
    if key_id: conditions.append(f"密钥={key_id}")
    if start_date: conditions.append(f"起始日期={start_date}")
    if end_date: conditions.append(f"结束日期={end_date}")
    if model: conditions.append(f"模型={model}")
    if status_filter: conditions.append(f"状态过滤={status_filter}")

    summary = f"按条件清理日志 ({', '.join(conditions)})" if conditions else "清理所有日志"

    logger.log_info(f"{summary}: 删除了 {deleted} 条记录")
    return {"message": summary, "deleted_count": deleted}


@app.post("/admin/api/cleanup/statistics")
async def admin_cleanup_statistics(
    request: Request,
    key_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """按条件清理统计数据"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    deleted = await clear_statistics(key_id, start_date, end_date)

    conditions = []
    if key_id: conditions.append(f"密钥={key_id}")
    if start_date: conditions.append(f"起始日期={start_date}")
    if end_date: conditions.append(f"结束日期={end_date}")

    summary = f"按条件清理统计 ({', '.join(conditions)})" if conditions else "清理所有统计"

    logger.log_info(f"{summary}: 删除了 {deleted} 条记录")
    return {"message": summary, "deleted_count": deleted}


@app.post("/admin/api/cleanup/inactive-keys")
async def admin_cleanup_inactive_keys(request: Request):
    """删除所有禁用的密钥"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.auth import list_api_keys, delete_api_key

    keys = await list_api_keys()
    inactive_keys = [k for k in keys if not k['is_active']]
    deleted_count = 0

    for key in inactive_keys:
        if await delete_api_key(key['key_id']):
            deleted_count += 1

    logger.log_info(f"清理禁用密钥: 删除了 {deleted_count} 个密钥")
    return {"message": f"清理完成，删除了 {deleted_count} 个禁用密钥", "deleted_count": deleted_count}


@app.post("/admin/api/cleanup/orphan-logs")
async def admin_cleanup_orphan_logs(request: Request):
    """清理孤立的日志记录（key_id不存在的日志）"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    from src.auth import list_api_keys

    keys = await list_api_keys()
    valid_key_ids = set(k['key_id'] for k in keys)

    db = await get_db()
    try:
        # 获取所有不同的key_id
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT DISTINCT key_id FROM request_logs WHERE key_id IS NOT NULL")
        rows = await cursor.fetchall()
        orphan_count = 0

        for row in rows:
            if row['key_id'] not in valid_key_ids:
                # 删除孤立日志
                del_cursor = await db.execute("DELETE FROM request_logs WHERE key_id = ?", (row['key_id'],))
                orphan_count += del_cursor.rowcount

        await db.commit()
        logger.log_info(f"清理孤立日志: 删除了 {orphan_count} 条记录")
        return {"message": f"清理完成，删除了 {orphan_count} 条孤立日志", "deleted_count": orphan_count}
    finally:
        await db.close()


@app.get("/admin/api/statistics")
async def admin_get_statistics(
    request: Request,
    key_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """获取统计数据"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    stats = await get_statistics(key_id, start_date, end_date)
    return stats


@app.get("/admin/api/usage-summary")
async def admin_usage_summary(
    request: Request,
    key_id: Optional[str] = None
):
    """获取使用量汇总（今日/总计/输入输出等）"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    dashboard = await get_dashboard_stats()

    # 按用户过滤
    summary = {
        "today": {
            "requests": dashboard['requests_today'],
            "input_tokens": dashboard['input_tokens_today'],
            "output_tokens": dashboard['output_tokens_today'],
            "total_tokens": dashboard['tokens_today'],
            "errors": dashboard['errors_today'],
            "input_output_ratio": dashboard['input_output_ratio'],
            "active_users": dashboard['active_users_today']
        },
        "all_time": {
            "requests": dashboard['requests_all_time'],
            "input_tokens": dashboard.get('input_tokens_all_time'),
            "output_tokens": dashboard.get('output_tokens_all_time'),
            "total_tokens": dashboard['tokens_all_time'],
            "errors": dashboard.get('errors_all_time')
        }
    }

    return summary


@app.get("/admin/api/trend-stats")
async def admin_trend_stats(
    request: Request,
    period: str = "24h"
):
    """获取趋势数据（24小时/7天）"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    dashboard = await get_dashboard_stats()

    return {
        "period": period,
        "hourly_trend": dashboard.get('hourly_trend', []),
        "daily_trend": dashboard.get('daily_trend', [])
    }


@app.get("/admin/api/config")
async def admin_get_config(request: Request):
    """获取配置"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    return config


@app.post("/admin/api/config")
async def admin_update_config(request: Request):
    """更新配置 - 支持增量更新和合并"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    global config

    # 获取请求体
    body = await request.json()

    # 更新配置
    if 'admin_password' in body:
        config['admin_password'] = body['admin_password']

    if 'rate_limit' in body:
        # 增量更新限流配置
        if 'rate_limit' not in config:
            config['rate_limit'] = {}
        config['rate_limit'].update(body['rate_limit'])

    if 'models' in body:
        # 合并模型配置（不是完全替换）
        if 'models' not in config:
            config['models'] = {}
        # 遍历新模型，逐个合并到现有配置
        for model_name, model_config in body['models'].items():
            # 如果配置值为None，表示删除该模型
            if model_config is None:
                config['models'].pop(model_name, None)
                continue

            # 如果模型已存在，执行深合并（保留原有字段）
            if model_name in config['models']:
                existing_model = config['models'][model_name]
                # 更新所有字段，None值不覆盖原有字段
                for key, value in model_config.items():
                    if value is not None:
                        existing_model[key] = value
            else:
                # 新模型直接添加
                config['models'][model_name] = model_config

    if 'logging' in body:
        # 增量更新日志配置
        if 'logging' not in config:
            config['logging'] = {}
        config['logging'].update(body['logging'])

    # 先保存到临时文件，成功后再替换
    temp_path = CONFIG_PATH.with_suffix('.json.tmp')
    backup_path = CONFIG_PATH.with_suffix('.json.bak')

    try:
        # 写入临时文件
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2)

        # 备份原文件
        if CONFIG_PATH.exists():
            CONFIG_PATH.rename(backup_path)

        # 替换为新文件
        temp_path.rename(CONFIG_PATH)

        # 删除备份
        if backup_path.exists():
            backup_path.unlink()

        # 重新加载配置
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
            config = json.load(f)

        # 更新代理配置
        proxy.config = config
        proxy.load_models_config()

        logger.log_info("Configuration updated")
        return {"message": "Configuration updated"}

    except Exception as e:
        # 恢复备份
        if backup_path.exists():
            backup_path.rename(CONFIG_PATH)
        logger.log_error(f"Config update failed: {e}")
        raise HTTPException(status_code=500, detail=f"Config update failed: {str(e)}")


@app.get("/admin/api/user-stats/{key_id}")
async def admin_user_stats(request: Request, key_id: str):
    """用户统计"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    stats = await get_user_stats(key_id)
    return stats


@app.get("/admin/api/model-stats/{model}")
async def admin_model_stats(request: Request, model: str):
    """模型统计"""
    session_token = request.headers.get("X-Session-Token", "")
    if not verify_admin_session(session_token):
        raise HTTPException(status_code=401, detail="Unauthorized")

    stats = await get_model_stats(model)
    return stats


# ==================== 管理面板静态文件 ====================

app.mount("/admin/static", StaticFiles(directory="admin/static"), name="admin_static")


@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.get("/admin/login")
async def admin_login_page():
    """管理员登录页面"""
    admin_html = Path(__file__).parent / "admin" / "templates" / "index.html"
    with open(admin_html, 'r', encoding='utf-8') as f:
        return HTMLResponse(content=f.read())
@app.get("/admin", response_class=HTMLResponse)
async def admin_panel():
    """管理面板页面"""
    html_path = Path(__file__).parent / "admin" / "templates" / "index.html"
    with open(html_path, 'r', encoding='utf-8') as f:
        return f.read()


# ==================== 启动事件 ====================

@app.on_event("startup")
async def startup_event():
    """启动时初始化"""
    await init_database()
    logger.log_info(f"API Relay Service started on port {config['server']['port']}")
    logger.log_info(f"Available models: {list(proxy.models_config.keys())}")


@app.on_event("shutdown")
async def shutdown_event():
    """关闭时清理数据库连接"""
    from src.database import close_db
    await close_db()
    logger.log_info("API Relay Service shut down")


# ==================== 主程序入口 ====================

if __name__ == "__main__":
    import uvicorn
    from datetime import timedelta

    uvicorn.run(
        app,
        host=config['server']['host'],
        port=config['server']['port'],
        log_level="info"
    )