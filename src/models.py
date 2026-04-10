"""数据模型定义"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime


# 模型配置（运行时内部使用）
class ModelConfig(BaseModel):
    """模型运行时配置"""
    source_base_url: str
    source_model: str
    source_api_key: str
    enabled: bool = True
    source_id: Optional[str] = None


# ==================== 新版模型管理相关模型 ====================

class SourceAPICreate(BaseModel):
    """创建源API配置"""
    name: str
    base_url: str
    api_key: str
    supported_models: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class SourceAPIUpdate(BaseModel):
    """更新源API配置"""
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    supported_models: Optional[List[str]] = None
    is_active: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None


class SourceAPI(BaseModel):
    """源API信息"""
    source_id: str
    name: str
    base_url: str
    is_active: bool
    created_at: str
    metadata: Optional[Dict[str, Any]] = None


class VirtualModelCreate(BaseModel):
    """创建虚拟模型"""
    model_config = ConfigDict(protected_namespaces=())
    model_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class VirtualModelUpdate(BaseModel):
    """更新虚拟模型"""
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None


class VirtualModel(BaseModel):
    """虚拟模型信息"""
    model_config = ConfigDict(protected_namespaces=())
    model_id: str
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: str
    metadata: Optional[Dict[str, Any]] = None


class ModelBindingCreate(BaseModel):
    """创建模型绑定"""
    binding_id: Optional[str] = None
    virtual_model_id: str
    source_id: str
    source_model_name: str
    priority: int = 0


class ModelBindingUpdate(BaseModel):
    """更新模型绑定"""
    virtual_model_id: Optional[str] = None
    source_id: Optional[str] = None
    source_model_name: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class ModelBinding(BaseModel):
    """模型绑定信息"""
    binding_id: str
    virtual_model_id: str
    source_id: str
    source_model_name: str
    priority: int
    is_active: bool


# ==================== 管理员 API 相关模型 ====================

class APIKeyCreate(BaseModel):
    """创建API密钥请求"""
    name: str
    expires_at: Optional[datetime] = None
    rate_limit: int = Field(default=60, ge=1, le=10000)
    metadata: Optional[Dict[str, Any]] = None


class APIKeyResponse(BaseModel):
    """API密钥响应"""
    key_id: str
    api_key: str
    name: str
    created_at: datetime
    expires_at: Optional[datetime]
    is_active: bool
    rate_limit: int


class APIKeyInfo(BaseModel):
    """API密钥信息（不包含密钥本身）"""
    key_id: str
    name: str
    created_at: datetime
    expires_at: Optional[datetime]
    is_active: bool
    rate_limit: int
    metadata: Optional[Dict[str, Any]]


class APIKeyUpdate(BaseModel):
    """更新API密钥"""
    name: Optional[str] = None
    rate_limit: Optional[int] = Field(default=None, ge=1, le=10000)
    is_active: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None


class RequestLog(BaseModel):
    """请求日志"""
    log_id: int
    key_id: Optional[str]
    request_time: datetime
    client_ip: Optional[str]
    model: str
    source_model: Optional[str]
    status_code: Optional[int]
    input_tokens: Optional[int]
    output_tokens: Optional[int]
    response_time_ms: Optional[int]
    error_message: Optional[str]


class Statistics(BaseModel):
    """统计数据"""
    key_id: Optional[str]
    date: str
    total_requests: int
    total_input_tokens: int
    total_output_tokens: int
    total_errors: int


class AdminLogin(BaseModel):
    """管理员登录"""
    password: str


class ConfigUpdate(BaseModel):
    """配置更新"""
    admin_password: Optional[str] = None
    rate_limit: Optional[Dict[str, int]] = None
    models: Optional[Dict[str, Any]] = None


class ChatCompletionRequest(BaseModel):
    """聊天补全请求（OpenAI格式）"""
    model: str
    messages: List[Dict[str, str]]
    temperature: Optional[float] = 1.0
    top_p: Optional[float] = 1.0
    n: Optional[int] = 1
    stream: Optional[bool] = False
    stop: Optional[List[str]] = None
    max_tokens: Optional[int] = None
    presence_penalty: Optional[float] = 0
    frequency_penalty: Optional[float] = 0
    user: Optional[str] = None


class Usage(BaseModel):
    """Token使用量"""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    """聊天补全响应（OpenAI格式）"""
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[Dict[str, Any]]
    usage: Optional[Usage] = None
