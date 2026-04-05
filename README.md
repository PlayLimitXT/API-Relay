# API Relay Service

一个功能强大的大模型API转发服务，支持多密钥管理、虚拟模型ID、限流控制、实时监控和可视化管理面板

## 特性

- **虚拟模型ID**：支持自定义模型ID映射，隐藏源API信息
- **多源API管理**：支持配置多个源API提供商
- **细粒度权限控制**：每个密钥独立的限流和访问控制
- **实时监控**：请求统计、使用量分析、Top用户/模型排行
- **管理面板**：完整的Web界面，支持密钥、模型、源API管理
- **API转发**：兼容OpenAI API格式的请求转发
- **限流保护**：全局和单密钥限流，服务过载保护
- **日志系统**：完整的请求日志和统计分析

## 快速开始

### 1. 安装依赖

从 `requirements.txt` 安装：

```bash
pip install -r requirements.txt
```

### 2. 配置服务

**方式一：使用 `config.json`（推荐本地开发）**

```json
{
  "admin_password": "your-admin-password",
  "server": {
    "host": "0.0.0.0",
    "port": 8080
  },
  "rate_limit": {
    "global_rpm": 10000,
    "default_key_rpm": 60
  },
  "models": {
    "default": {
      "source_base_url": "https://openrouter.ai/api/v1",
      "source_model": "qwen/qwen3.6-plus:free",
      "source_api_key": "your-source-api-key",
      "enabled": true
    }
  },
  "logging": {
    "level": "INFO",
    "file": "logs/relay.log",
    "max_size_mb": 100,
    "retention_days": 30
  }
}
```

**方式二：使用环境变量（推荐生产环境）**

```bash
# 设置环境变量
export ADMIN_PASSWORD="your-secure-password"
export SOURCE_API_KEY="your-source-api-key"
export SERVER_PORT=8080
export LOG_LEVEL=INFO

# 或使用 .env 文件（推荐）
cp .env.example .env
# 编辑 .env 填入实际配置
```

### 3. 启动服务

```bash
# 开发模式
python3 main.py

# 生产模式（多进程）
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8080
```

### 4. 访问管理面板

打开浏览器访问：`http://localhost:8080/admin`

默认管理员密码：在 `config.json` 中设置的 `admin_password`

## 架构说明

```
客户端请求
    ↓
API密钥认证 ──→ 无效密钥 → 返回 401
    ↓ 有效密钥
虚拟模型解析
    ↓
模型绑定查找 ──→ 未找到 → 使用默认配置
    ↓ 找到
源API转发
    ↓
响应返回客户端
    ↓
记录日志和统计
```

### 核心组件

- **认证系统** (`src/auth.py`)：API密钥生成、验证和管理
- **数据库** (`src/database.py`)：SQLite数据库，连接池，WAL模式
- **代理核心** (`src/proxy.py`)：请求转发，模型配置解析
- **限流器** (`src/rate_limiter.py`)：滑动窗口限流算法
- **日志系统** (`src/logger.py`)：请求日志和统计分析
- **模型管理** (`src/model_manager.py`)：虚拟模型和源API管理
- **管理面板** (`admin/`)：Web界面管理所有功能

## 功能详解

### 1. API密钥管理

**创建密钥**
- 在管理面板点击"创建密钥"
- 设置密钥名称、过期时间、限流值
- 创建后立即复制明文密钥
- 管理员可随时在面板中查看和复制已有密钥（密钥以明文形式存储）

**密钥权限**
- 每个密钥独立的限流配置（请求/分钟）
- 可单独启用/禁用
- 支持元数据扩展

**密钥存储**
- 使用 Base64 编码存储
- 管理员面板可查看和复制所有已创建的密钥
- 方便管理和应急场景

**密钥格式**
- 前缀：`sk-`
- 示例：`sk-AbCdEf1234567890XyZ`

### 2. 虚拟模型ID

**概念**
- 虚拟模型ID是客户端使用的模型名称
- 通过绑定映射到实际的源API和模型

**管理流程**
1. 添加源API（源API提供商的配置）
2. 创建虚拟模型（自定义模型名称）
3. 绑定虚拟模型到源API的实际模型
4. 客户端使用虚拟模型ID发起请求

**示例**
```
虚拟模型: "my-chat-model"
  ↓ 绑定
源API: "OpenRouter" + 模型: "gpt-5"
```

### 3. 限流控制

**两级限流**
- 全局限流：保护服务总负载
- 单密钥限流：防止单个密钥滥用

**限流算法**
- 滑动窗口计数
- 每分钟请求数 (RPM)
- 响应头包含剩余配额

**响应头**
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1633024800
```

### 4. 统计分析

**实时统计**
- 当前QPS
- 每分钟请求数
- 活跃密钥数
- 错误率

**历史数据**
- 按日统计（总请求、Token数、错误数）
- Top用户排行（按请求量）
- Top模型排行（按使用量）

**日志查询**
- 按密钥ID、模型、IP筛选
- 支持时间范围过滤
- 包含详细的错误信息

## API参考

### 认证端点

#### `POST /v1/chat/completions`

聊天补全请求（兼容OpenAI API格式）

**请求头**
```
Authorization: Bearer sk-your-api-key
Content-Type: application/json
```

**请求体**
```json
{
  "model": "my-virtual-model",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "stream": false
}
```

**响应**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "my-virtual-model",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

**流式响应**
```
data: {"choices": [{"delta": {"content": "Hello"}, "index": 0}]}

data: {"choices": [{"delta": {"content": "!"}, "index": 0}]}

data: [DONE]
```

#### `GET /v1/models`

列出可用的模型

**响应**
```json
{
  "object": "list",
  "data": [
    {
      "id": "my-virtual-model",
      "name": "My Custom Model",
      "description": "自定义模型ID",
      "sources": "OpenRouter API -> gpt-4",
      "object": "model",
      "created": 1234567890
    }
  ]
}
```

### 管理端点

需要先登录管理面板获取Session Token。

#### `POST /admin/api/login`

管理员登录

**请求**
```json
{
  "password": "your-admin-password"
}
```

**响应**
```json
{
  "session_token": "session-token-here",
  "expires_in": 86400
}
```

#### `POST /admin/api/keys`

创建API密钥

**请求头**
```
X-Session-Token: your-session-token
```

**请求体**
```json
{
  "name": "production-key",
  "rate_limit": 60,
  "expires_in_days": 30
}
```

**响应**
```json
{
  "key_id": "uuid-here",
  "api_key": "sk-xxxxxxxxxxxxxxxx",
  "name": "production-key",
  "rate_limit": 60,
  "created_at": "2026-01-01T00:00:00",
  "expires_at": "2026-01-31T00:00:00"
}
```

**注意**：`api_key` 字段返回明文密钥，请立即保存。管理员可随时在面板中查看该密钥。

#### `GET /admin/api/keys`

列出所有密钥

**响应**
```json
{
  "keys": [
    {
      "key_id": "uuid",
      "name": "production-key",
      "api_key": "sk-xxx***xxx",
      "rate_limit": 60,
      "is_active": true,
      "created_at": "2024-01-01",
      "request_count_24h": 1234
    }
  ]
}
```

#### `PATCH /admin/api/keys/{key_id}`

更新密钥配置

**请求体**
```json
{
  "name": "new-name",
  "rate_limit": 100,
  "is_active": true
}
```

#### `DELETE /admin/api/keys/{key_id}`

删除密钥

#### `GET /admin/api/source-apis`

列出源API

#### `POST /admin/api/source-apis`

创建源API

**请求体**
```json
{
  "name": "OpenRouter",
  "base_url": "https://openrouter.ai/api/v1",
  "api_key": "sk-xxx",
  "metadata": {
    "provider": "openrouter"
  }
}
```

#### `GET /admin/api/models`

列出虚拟模型

#### `POST /admin/api/models`

创建虚拟模型

**请求体**
```json
{
  "model_id": "my-model",
  "name": "My Custom Model",
  "description": "Description here"
}
```

#### `POST /admin/api/bindings`

创建模型绑定

**请求体**
```json
{
  "virtual_model_id": "my-model",
  "source_id": "openrouter-uuid",
  "source_model_name": "gpt-4",
  "priority": 0
}
```

#### `GET /admin/api/dashboard`

获取仪表板统计数据

**响应**
```json
{
  "dashboard": {
    "total_requests": 10000,
    "requests_24h": 1234,
    "errors_24h": 10,
    "active_keys": 5,
    "avg_response_time": 450
  },
  "top_users": [
    {"key_id": "xxx", "name": "key-1", "requests": 5000}
  ],
  "top_models": [
    {"model": "gpt-4", "requests": 3000}
  ]
}
```

## 部署指南

### 使用 Docker（推荐）

Dockerfile：
```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY . /app

RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 8080

ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=8080

CMD ["python", "main.py"]
```

构建和运行：
```bash
docker build -t api-relay .
docker run -d \
  -p 8080:8080 \
  -v $(pwd)/data:/app/database \
  -v $(pwd)/logs:/app/logs \
  --env-file .env \
  --name api-relay \
  api-relay
```

### 使用 Systemd

创建服务文件 `/etc/systemd/system/api-relay.service`：

```ini
[Unit]
Description=API Relay Service
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/api-relay
EnvironmentFile=/etc/api-relay/.env
ExecStart=/opt/api-relay/venv/bin/python3 main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=api-relay

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable api-relay
sudo systemctl start api-relay
```

### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name api-relay.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `ADMIN_PASSWORD` | 管理员密码 | 必须设置 |
| `SOURCE_API_KEY` | 默认源API密钥 | - |
| `SOURCE_API_URL` | 默认源API URL | - |
| `SOURCE_MODEL` | 默认源模型 | - |
| `SERVER_HOST` | 服务监听地址 | `0.0.0.0` |
| `SERVER_PORT` | 服务端口 | `8080` |
| `LOG_LEVEL` | 日志级别 | `INFO` |

## 项目结构

```
api-relay/
├── admin/                  # 管理面板
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css
│   │   └── js/
│   │       └── app.js
│   └── templates/
│       └── index.html
├── src/                    # 源代码
│   ├── auth.py            # API密钥认证
│   ├── database.py        # 数据库连接
│   ├── logger.py          # 日志系统
│   ├── model_manager.py   # 模型管理
│   ├── models.py          # 数据模型
│   ├── proxy.py           # 代理核心
│   ├── rate_limiter.py    # 限流器
│   └── stats.py           # 统计分析
├── database/              # 数据库文件（运行时生成）
│   └── relay.db
├── logs/                  # 日志文件（运行时生成）
│   └── relay.log
├── main.py                # 主程序入口
├── config.json            # 配置文件
├── .env                   # 环境变量文件（Git忽略）
├── env.example            # 环境变量模板
├── .gitignore             # Git忽略配置
└── requirements.txt       # Python依赖
```

## 安全注意事项

1. **管理员密码**：使用强密码
2. **API密钥**：使用 Base64 编码存储，管理员可在面板中查看
3. **HTTPS**：生产环境必须使用HTTPS
4. **密钥轮换**：定期更换API密钥和管理员密码
5. **限流配置**：根据实际需求设置合理的限流值

## 故障排查

### 服务无法启动

```bash
# 检查端口占用
lsof -i :8080

# 查看详细启动日志
python3 main.py 2>&1 | tee startup.log
```

### 管理员登录失败

- 检查 `ADMIN_PASSWORD` 环境变量或 `config.json` 配置
- 确认大小写正确
- 尝试重置密码

### 请求转发失败

- 检查源API配置是否正确（URL、密钥、模型名）
- 查看日志文件 `logs/relay.log`
- 确认网络连接正常

### 限流不生效

- 确认在管理面板设置了密钥的限流值
- 检查全局限流配置
- 查看响应头中的 `X-RateLimit-*` 信息

## 生产环境检查清单

- [ ] 更新 `.env` 配置（务必设置 `ADMIN_PASSWORD`）
- [ ] 配置 HTTPS（建议使用 Nginx 反向代理）
- [ ] 部署 Docker 容器或 Systemd 服务
- [ ] 验证健康检查端点 `/health`
- [ ] 部署 验证 测试

## 许可证

MIT License

## 开发

**代码规范**：
- Python 代码遵循 PEP 8 规范
- 使用类型注解
- 添加适当的文档字符串
- 提交前请运行 `python3 -m py_compile main.py` 检查语法

## 后续

- [ ] 模型自动切换功能
- [ ] 更详细的日志与统计
- [ ] 精细化管理

## 更新日志

暂无

### v1.0.0 (2026-04-05)

- 初始版本发布
- 支持虚拟模型ID
- 完整的管理面板
- API密钥管理
- 限流控制
- 统计分析
- 日志系统
