"""API 代理核心逻辑"""
import copy
import httpx
import json
import re
import time
from typing import Dict, Any, Optional, AsyncIterator
from fastapi import HTTPException
from .models import ModelConfig


class APIProxy:
    """API 代理处理器"""

    # API 端点常量
    CHAT_COMPLETIONS_ENDPOINT = "/chat/completions"
    EMBEDDINGS_ENDPOINT = "/embeddings"

    # 共享的 HTTP 客户端（连接复用）
    _client: Optional[httpx.AsyncClient] = None

    def __init__(self, config: dict):
        self.config = config
        self.models_config: Dict[str, ModelConfig] = {}
        self.use_database_routing = True  # 默认启用数据库路由
        self.load_models_config()

    @classmethod
    async def get_client(cls) -> httpx.AsyncClient:
        """获取或创建共享的 HTTP 客户端"""
        if cls._client is None:
            cls._client = httpx.AsyncClient(timeout=120.0, follow_redirects=True)
        return cls._client

    @classmethod
    async def close_client(cls):
        """关闭 HTTP 客户端"""
        if cls._client:
            await cls._client.aclose()
            cls._client = None

    def _build_source_url(self, base_url: str, endpoint: str) -> str:
        """构建源 API URL（避免重复路径）"""
        base = base_url.rstrip('/')
        if base.endswith(endpoint):
            return base
        elif base.endswith("/chat") or "/chat/" in base:
            chat_endpoint = self.CHAT_COMPLETIONS_ENDPOINT
            return base.rstrip('/') + chat_endpoint
        else:
            return base + endpoint

    def _deep_filter(self, data: Any, privacy_config: dict, top_level: bool = True) -> Any:
        """递归过滤嵌套的字典和列表"""
        if isinstance(data, dict):
            result = {}
            for key, value in data.items():
                if key in ('id', 'created', 'system_fingerprint', 'provider'):
                    continue
                if key == 'model':
                    if top_level:
                        continue
                    else:
                        result[key] = self._deep_filter(value, privacy_config, top_level=False)
                        continue
                result[key] = self._deep_filter(value, privacy_config, top_level=False)
            return result
        elif isinstance(data, list):
            return [self._deep_filter(item, privacy_config, top_level=top_level) for item in data]
        return data

    def apply_privacy_filter(self, response_data: Dict[str, Any], status_code: int, request_model: str = None) -> Dict[str, Any]:
        """应用隐私过滤"""
        privacy_config = self.config.get('privacy_filter', {})

        if not privacy_config.get('enabled', False):
            return response_data

        filtered_data = copy.deepcopy(response_data)

        if privacy_config.get('filter_metadata', True):
            for key in ('id', 'created', 'system_fingerprint'):
                if key in filtered_data:
                    del filtered_data[key]

        if privacy_config.get('filter_usage_details', True):
            if 'usage' in filtered_data and isinstance(filtered_data['usage'], dict):
                usage = filtered_data['usage']
                allowed_keys = {'prompt_tokens', 'completion_tokens', 'total_tokens'}
                extra_keys = [k for k in usage.keys() if k not in allowed_keys]
                for k in extra_keys:
                    del usage[k]

        if privacy_config.get('filter_model_info', True):
            if 'model' in filtered_data:
                if request_model:
                    filtered_data['model'] = request_model
                else:
                    del filtered_data['model']
            if 'choices' in filtered_data:
                for choice in filtered_data.get('choices', []):
                    if isinstance(choice, dict) and 'model' in choice:
                        if request_model:
                            choice['model'] = request_model
                        else:
                            del choice['model']

        if privacy_config.get('filter_provider_info', True):
            if 'provider' in filtered_data:
                del filtered_data['provider']
            if 'choices' in filtered_data:
                for choice in filtered_data.get('choices', []):
                    if isinstance(choice, dict):
                        choice.pop('provider', None)
                        if 'message' in choice and isinstance(choice['message'], dict):
                            choice['message'].pop('provider', None)
                        if 'delta' in choice and isinstance(choice['delta'], dict):
                            choice['delta'].pop('provider', None)

        if privacy_config.get('custom_regex_filters'):
            for rule in privacy_config.get('custom_regex_filters'):
                pattern = rule.get('pattern', '')
                replacement = rule.get('replacement', '')
                target_field = rule.get('target_field')

                if target_field and target_field in filtered_data:
                    if isinstance(filtered_data[target_field], str):
                        filtered_data[target_field] = re.sub(pattern, replacement, filtered_data[target_field])
                else:
                    filtered_data = self._apply_regex_recursive(filtered_data, pattern, replacement)

        if privacy_config.get('filter_error_details', False) and status_code >= 400:
            custom_messages = privacy_config.get('custom_error_messages', {})
            status_str = str(status_code)

            if 'error' in filtered_data and isinstance(filtered_data['error'], dict):
                if status_str in custom_messages:
                    filtered_data['error']['message'] = custom_messages[status_str]
                else:
                    filtered_data['error']['message'] = 'Request failed'
                for key in ('param', 'inner_error', 'debug_info', 'stack_trace'):
                    filtered_data['error'].pop(key, None)
            elif status_str in custom_messages:
                filtered_data = {
                    'error': {
                        'message': custom_messages[status_str],
                        'type': 'api_error',
                        'code': status_code
                    }
                }
            else:
                filtered_data = {
                    'error': {
                        'message': 'Request failed',
                        'type': 'api_error',
                        'code': status_code
                    }
                }

        return filtered_data

    def _apply_regex_recursive(self, data: Any, pattern: str, replacement: str) -> Any:
        """递归应用正则替换"""
        if isinstance(data, dict):
            result = {}
            for key, value in data.items():
                result[key] = self._apply_regex_recursive(value, pattern, replacement)
            return result
        elif isinstance(data, list):
            return [self._apply_regex_recursive(item, pattern, replacement) for item in data]
        elif isinstance(data, str):
            return re.sub(pattern, replacement, data)
        return data

    def _filter_stream_chunk(self, chunk: str, privacy_config: dict, request_model: str = None) -> str:
        """过滤流式响应的 SSE chunk"""
        if not chunk.strip():
            return chunk

        lines = chunk.strip().split('\n')
        filtered_lines = []

        for line in lines:
            line = line.strip()
            if not line:
                continue

            if line.startswith('data: '):
                data_str = line[6:]

                if data_str == '[DONE]':
                    filtered_lines.append(line)
                    continue

                try:
                    data = json.loads(data_str)
                    data = self._deep_filter(data, privacy_config, top_level=True)

                    if privacy_config.get('filter_model_info', True) and isinstance(data, dict):
                        if 'model' in data:
                            if request_model:
                                data['model'] = request_model
                            else:
                                del data['model']

                    if privacy_config.get('custom_regex_filters'):
                        for rule in privacy_config['custom_regex_filters']:
                            pattern = rule.get('pattern', '')
                            replacement = rule.get('replacement', '')
                            data = self._apply_regex_recursive(data, pattern, replacement)

                    filtered_lines.append(f"data: {json.dumps(data, ensure_ascii=False)}")
                except json.JSONDecodeError:
                    filtered_lines.append(line)
            else:
                filtered_lines.append(line)

        return '\n'.join(filtered_lines) + '\n\n'

    def load_models_config(self):
        """加载模型配置"""
        models_dict = self.config.get('models', {})
        for model_name, model_data in models_dict.items():
            self.models_config[model_name] = ModelConfig(**model_data)

    async def get_model_config_db(self, model_name: str) -> Optional[ModelConfig]:
        """从数据库获取模型配置"""
        if not self.use_database_routing:
            config = self.models_config.get(model_name)
            if config and config.enabled:
                return config
            return None

        from .model_manager import resolve_model_config
        model_data = await resolve_model_config(model_name)
        if not model_data:
            return None

        return ModelConfig(**model_data)

    async def get_model_config(self, model_name: str) -> Optional[ModelConfig]:
        """获取指定模型配置"""
        try:
            config = await self.get_model_config_db(model_name)
            if config:
                return config
        except Exception:
            pass

        config = self.models_config.get(model_name)
        if config and config.enabled:
            return config
        return None

    def list_available_models(self) -> list:
        """列出可用的模型"""
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
        except Exception:
            return self.list_available_models()

    async def forward_chat_completion(
        self,
        request_data: Dict[str, Any],
        model_config: ModelConfig,
        client_ip: Optional[str] = None,
        key_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """转发聊天补全请求（非流式）"""
        forward_data = request_data.copy()
        forward_data['model'] = model_config.source_model
        start_time = time.time()

        url = self._build_source_url(
            model_config.source_base_url,
            self.CHAT_COMPLETIONS_ENDPOINT
        )

        try:
            client = await self.get_client()
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
            virtual_model = request_data.get('model')
            result = self.apply_privacy_filter(result, response.status_code, request_model=virtual_model)

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
        """转发聊天补全请求（流式）"""
        forward_data = request_data.copy()
        forward_data['model'] = model_config.source_model
        forward_data['stream'] = True

        url = self._build_source_url(
            model_config.source_base_url,
            self.CHAT_COMPLETIONS_ENDPOINT
        )

        try:
            client = await self.get_client()
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

                privacy_config = self.config.get('privacy_filter', {})
                filter_enabled = privacy_config.get('enabled', False)
                virtual_model = request_data.get('model')

                async for chunk in response.aiter_text():
                    if filter_enabled:
                        filtered_chunk = self._filter_stream_chunk(chunk, privacy_config, request_model=virtual_model)
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

        base_url = model_config.source_base_url.rstrip('/')
        if base_url.endswith("/embeddings"):
            url = base_url
        else:
            url = base_url + "/embeddings"

        client = await self.get_client()
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

        result = response.json()
        virtual_model = request_data.get('model')
        result = self.apply_privacy_filter(result, response.status_code, request_model=virtual_model)

        return result
