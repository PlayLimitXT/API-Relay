"""API代理核心逻辑"""
import httpx
import json
import time
from typing import Dict, Any, Optional, AsyncIterator
from fastapi import HTTPException
from .models import ModelConfig


class APIProxy:
    """API代理处理器"""

    # API 端点常量
    CHAT_COMPLETIONS_ENDPOINT = "/chat/completions"
    EMBEDDINGS_ENDPOINT = "/embeddings"

    def __init__(self, config: dict):
        self.config = config
        self.models_config: Dict[str, ModelConfig] = {}
        self.use_database_routing = True  # 默认启用数据库路由
        self.load_models_config()

    def _build_source_url(self, base_url: str, endpoint: str) -> str:
        """构建源API URL（避免重复路径）"""
        base = base_url.rstrip('/')
        if base.endswith(endpoint):
            return base
        elif base.endswith("/chat") or "/chat/" in base:
            # 处理 /chat -> /chat/completions 的情况
            chat_endpoint = self.CHAT_COMPLETIONS_ENDPOINT
            return base.rstrip('/') + chat_endpoint
        else:
            return base + endpoint

    def apply_privacy_filter(self, response_data: Dict[str, Any], status_code: int) -> Dict[str, Any]:
        """应用隐私过滤"""
        privacy_config = self.config.get('privacy_filter', {})

        if not privacy_config.get('enabled', False):
            return response_data

        filtered_data = response_data.copy()

        # 过滤元数据
        if privacy_config.get('filter_metadata', True):
            if 'id' in filtered_data:
                del filtered_data['id']
            if 'created' in filtered_data:
                del filtered_data['created']
            if 'system_fingerprint' in filtered_data:
                del filtered_data['system_fingerprint']

        # 过滤使用详情
        if privacy_config.get('filter_usage_details', True):
            if 'usage' in filtered_data:
                # 只保留基本的token统计
                usage = filtered_data['usage']
                filtered_data['usage'] = {
                    'prompt_tokens': usage.get('prompt_tokens', 0),
                    'completion_tokens': usage.get('completion_tokens', 0),
                    'total_tokens': usage.get('total_tokens', 0)
                }

        # 过滤模型信息
        if privacy_config.get('filter_model_info', True):
            if 'model' in filtered_data:
                # 保留模型名称，但可以替换为用户请求的模型名
                pass

        # 过滤提供商信息
        if privacy_config.get('filter_provider_info', True):
            if 'provider' in filtered_data:
                del filtered_data['provider']

        # 过滤错误详情
        if privacy_config.get('filter_error_details', True) and status_code >= 400:
            custom_messages = privacy_config.get('custom_error_messages', {})
            status_str = str(status_code)
            if status_str in custom_messages:
                filtered_data = {
                    'error': {
                        'message': custom_messages[status_str],
                        'type': 'api_error',
                        'code': status_code
                    }
                }

        return filtered_data

    def _filter_stream_chunk(self, chunk: str, privacy_config: dict) -> str:
        """过滤流式响应的SSE chunk"""
        if not chunk.strip():
            return chunk

        lines = chunk.strip().split('\n')
        filtered_lines = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            if line.startswith('data: '):
                data_str = line[6:]  # 去掉 "data: " 前缀

                if data_str == '[DONE]':
                    filtered_lines.append(line)
                    continue

                try:
                    data = json.loads(data_str)

                    # 过滤敏感字段
                    if privacy_config.get('filter_metadata', True):
                        data.pop('id', None)
                        data.pop('created', None)
                        data.pop('system_fingerprint', None)
                        data.pop('model', None)  # 可选：隐藏源模型名

                    if privacy_config.get('filter_provider_info', True):
                        data.pop('provider', None)

                    filtered_lines.append(f"data: {json.dumps(data)}")
                except json.JSONDecodeError:
                    # 如果解析失败，保持原样
                    filtered_lines.append(line)
            else:
                filtered_lines.append(line)

        return '\n'.join(filtered_lines) + '\n\n'

    def load_models_config(self):
        """加载模型配置（保留用于向后兼容）"""
        models_dict = self.config.get('models', {})
        for model_name, model_data in models_dict.items():
            self.models_config[model_name] = ModelConfig(**model_data)

    async def get_model_config_db(self, model_name: str) -> Optional[ModelConfig]:
        """从数据库获取模型配置（支持虚拟模型ID）"""
        if not self.use_database_routing:
            # 回退到配置文件方式
            config = self.models_config.get(model_name)
            if config and config.enabled:
                return config
            return None

        # 从数据库解析模型配置
        from .model_manager import resolve_model_config
        model_data = await resolve_model_config(model_name)
        if not model_data:
            return None

        return ModelConfig(**model_data)

    async def get_model_config(self, model_name: str) -> Optional[ModelConfig]:
        """获取指定模型配置（优先数据库）"""
        # 优先尝试从数据库获取
        try:
            config = await self.get_model_config_db(model_name)
            if config:
                return config
        except Exception as e:
            # 如果数据库获取失败，回退到配置文件
            pass

        # 回退到配置文件方式
        config = self.models_config.get(model_name)
        if config and config.enabled:
            return config
        return None

    def list_available_models(self) -> list:
        """列出可用的模型（仅配置文件）"""
        return [
            {
                "id": model_name,
                "object": "model",
                "created": int(time.time()),
                "owned_by": "relay-service"
            }
            for model_name, config in self.models_config.items()
            if config.enabled
        ]

    async def list_available_models_db(self) -> list:
        """列出可用的模型（从数据库）"""
        from .model_manager import list_available_models_with_bindings
        try:
            return await list_available_models_with_bindings()
        except Exception as e:
            pass  # Fallback to config.json models
            return self.list_available_models()

    async def forward_chat_completion(
        self,
        request_data: Dict[str, Any],
        model_config: ModelConfig,
        client_ip: Optional[str] = None,
        key_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        转发聊天补全请求（非流式）
        """
        # 构建转发请求
        forward_data = request_data.copy()
        forward_data['model'] = model_config.source_model

        # 记录开始时间
        start_time = time.time()

        # 智能处理Base URL（避免重复路径）
        url = self._build_source_url(
            model_config.source_base_url,
            self.CHAT_COMPLETIONS_ENDPOINT
        )

        try:
            # 发送请求到源API
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {model_config.source_api_key}",
                        "Content-Type": "application/json"
                    },
                    json=forward_data
                )

                response_time_ms = int((time.time() - start_time) * 1000)

                if response.status_code != 200:
                    error_detail = response.text
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"Source API error: {error_detail}"
                    )

                result = response.json()

                # 应用隐私过滤
                result = self.apply_privacy_filter(result, response.status_code)

                # 提取token使用信息
                usage = result.get('usage', {})
                input_tokens = usage.get('prompt_tokens', 0) if usage else 0
                output_tokens = usage.get('completion_tokens', 0) if usage else 0

                return {
                    "response": result,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "response_time_ms": response_time_ms,
                    "status_code": 200
                }

        except httpx.TimeoutException:
            response_time_ms = int((time.time() - start_time) * 1000)
            raise HTTPException(
                status_code=504,
                detail="Source API timeout"
            )
        except httpx.RequestError as e:
            response_time_ms = int((time.time() - start_time) * 1000)
            raise HTTPException(
                status_code=502,
                detail=f"Source API connection error: {str(e)}"
            )

    async def forward_chat_completion_stream(
        self,
        request_data: Dict[str, Any],
        model_config: ModelConfig
    ) -> AsyncIterator[str]:
        """
        转发聊天补全请求（流式）
        """
        # 构建转发请求
        forward_data = request_data.copy()
        forward_data['model'] = model_config.source_model
        forward_data['stream'] = True

        # 智能处理Base URL（避免重复路径）
        url = self._build_source_url(
            model_config.source_base_url,
            self.CHAT_COMPLETIONS_ENDPOINT
        )

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    url,
                    headers={
                        "Authorization": f"Bearer {model_config.source_api_key}",
                        "Content-Type": "application/json"
                    },
                    json=forward_data
                ) as response:
                    if response.status_code != 200:
                        error_detail = await response.aread()
                        raise HTTPException(
                            status_code=response.status_code,
                            detail=f"Source API error: {error_detail.decode()}"
                        )

                    # 流式转发响应（应用隐私过滤）
                    privacy_config = self.config.get('privacy_filter', {})
                    filter_enabled = privacy_config.get('enabled', False) and privacy_config.get('filter_metadata', True)

                    async for chunk in response.aiter_text():
                        if filter_enabled:
                            # 对SSE格式的chunk进行过滤
                            filtered_chunk = self._filter_stream_chunk(chunk, privacy_config)
                            yield filtered_chunk
                        else:
                            yield chunk

        except httpx.TimeoutException:
            raise HTTPException(
                status_code=504,
                detail="Source API timeout"
            )
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Source API connection error: {str(e)}"
            )

    async def forward_embeddings(
        self,
        request_data: Dict[str, Any],
        model_config: ModelConfig
    ) -> Dict[str, Any]:
        """转发向量嵌入请求"""
        forward_data = request_data.copy()
        forward_data['model'] = model_config.source_model

        # 智能处理Base URL（避免重复路径）
        base_url = model_config.source_base_url.rstrip('/')
        endpoint = "/embeddings"

        # 如果base_url已经包含/embeddings，则不再添加
        if base_url.endswith("/embeddings"):
            url = base_url
        else:
            url = base_url + endpoint

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {model_config.source_api_key}",
                    "Content-Type": "application/json"
                },
                json=forward_data
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Source API error: {response.text}"
                )

            return response.json()