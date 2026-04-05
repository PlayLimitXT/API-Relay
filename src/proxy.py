"""API代理核心逻辑"""
import httpx
import json
import time
from typing import Dict, Any, Optional, AsyncIterator
from fastapi import HTTPException
from .models import ModelConfig


class APIProxy:
    """API代理处理器"""

    def __init__(self, config: dict):
        self.config = config
        self.models_config: Dict[str, ModelConfig] = {}
        self.use_database_routing = True  # 默认启用数据库路由
        self.load_models_config()

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

        try:
            # 发送请求到源API
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{model_config.source_base_url}/chat/completions",
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

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    f"{model_config.source_base_url}/chat/completions",
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

                    # 流式转发响应
                    async for chunk in response.aiter_text():
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

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{model_config.source_base_url}/embeddings",
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