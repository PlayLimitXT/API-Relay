# API Relay Service by PLXT

一个功能强大的大模型 API 转发服务，支持多密钥管理、虚拟模型 ID、限流控制、实时监控和可视化管理面板。

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.2.0-blue.svg)](CHANGELOG.md)
[![Open Source](https://img.shields.io/badge/Open%20Source-❤️-red.svg)](#contributing)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](docker-compose.yml)
[![i18n](https://img.shields.io/badge/i18n-中文/英文-orange.svg)](#特性)

**[English Documentation](README_EN.md) | [更新日志](CHANGELOG.md) | [贡献指南](CONTRIBUTING.md)**

## 目录

- [特性](#特性)
- [快速开始](#快速开始)
- [架构图](#架构图)
- [核心概念](#核心概念)
- [部署指南](#部署指南)
- [API 参考](#api-参考)
- [管理脚本](#管理脚本)
- [故障排查](#故障排查)
- [贡献](#贡献)
- [许可证](#许可证)

## 特性

- **虚拟模型 ID**：支持自定义模型 ID 映射，隐藏源 API 信息
- **多源 API 管理**：支持配置多个源 API 提供商（OpenRouter、OpenAI 等）
- **三层架构**：源 API → 虚拟模型 → 绑定关系，灵活路由
- **细粒度权限控制**：每个密钥独立的限流和访问控制
- **实时监控**：请求统计、使用量分析、Top 用户/模型排行
- **Web 管理面板**：完整的可视化界面，管理所有功能
- **OpenAI 兼容**：无缝集成现有应用
- **限流保护**：全局和单密钥限流，服务过载保护
- **隐私过滤**：可选的敏感信息过滤功能
- **详细日志**：完整的请求日志和统计分析
- **国际化支持**：管理面板支持中文/英文切换
- **OpenAI SDK 兼容**：支持 OpenRouter 等 OpenAI 兼容服务

## 快速开始

### 1. 安装依赖

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
export ADMIN_PASSWORD="your-secure-password"
export SOURCE_API_KEY="your-source-api-key"
export SERVER_PORT=8080
export LOG_LEVEL=INFO
```

或使用 `.env` 文件：

```bash
cp .env.example .env
# 编辑 .env 填入实际配置
```

### 3. 初始化（首次运行）

```bash
./init.sh
```

首次运行需要执行初始化脚本，它会：
- 安装 Python 依赖
- 创建必要的目录（database、backups、logs）
- 初始化数据库
- 设置管理员密码和服务端口

### 4. 启动服务

**方式一：使用管理脚本（推荐）**
```bash
./start.sh
```

**方式二：直接运行**
```bash
python3 main.py
```

服务将在 `http://localhost:8080` 启动。

### 5. 停止服务

```bash
./stop.sh
```

### 6. 访问管理面板

打开浏览器访问：`http://localhost:8080/admin`

默认管理员账号：密码在初始化时设置

## 架构图

```
[Client]
    |
    | HTTP Request
    | POST /v1/chat/completions
    | Authorization: Bearer sk-xxx
    |
    v
[API Relay Service]
    |
    |---> [1. Authentication]
    |      (API Key Validation)
    |
    |---> [2. Rate Limiting]
    |      (Global + Per-Key RPM)
    |
    |---> [3. Model Routing]
    |      (Virtual → Source)
    |
    v
[Source API]
```

## 核心概念

### 三层架构

1. **源 API (Source API)**：实际的 API 提供商配置
   - 包含 base_url、api_key、支持的模型列表
   - 可添加多个源 API 实现负载均衡

2. **虚拟模型 (Virtual Model)**：客户端使用的模型标识符
   - 自定义名称和描述
   - 对外暴露的模型 ID

3. **绑定关系 (Binding)**：连接虚拟模型和源 API
   - 指定虚拟模型对应哪个源 API 的具体模型
   - 支持优先级配置

### API 密钥

- 格式：`sk-` 前缀 + Base64 编码的随机字符串
- 每个密钥可独立配置：
  - 限流值（请求/分钟）
  - 过期时间
  - 状态（启用/禁用）

## 部署指南

### Docker 部署

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

### Systemd 服务

创建 `/etc/systemd/system/api-relay.service`:

```ini
[Unit]
Description=API Relay Service
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/api-relay
EnvironmentFile=/etc/api-relay/.env
ExecStart=/opt/api-relay/venv/bin/python3 main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable api-relay
sudo systemctl start api-relay
```

### Nginx 反向代理

```nginx
server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## API 参考

### OpenAI 兼容端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/chat/completions` | POST | 聊天补全（支持流式） |
| `/v1/models` | GET | 列出可用模型 |
| `/health` | GET | 健康检查 |

### 管理端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/api/login` | POST | 管理员登录 |
| `/admin/api/keys` | GET/POST | 密钥列表/创建 |
| `/admin/api/keys/{id}` | PATCH/DELETE | 更新/删除密钥 |
| `/admin/api/source-apis` | GET/POST | 源 API 管理 |
| `/admin/api/virtual-models` | GET/POST | 虚拟模型管理 |
| `/admin/api/model-bindings` | GET/POST | 绑定管理 |
| `/admin/api/dashboard` | GET | 仪表板统计 |
| `/admin/api/logs` | GET | 请求日志 |

## 项目结构

```
api-relay/
├── admin/                  # Web 管理面板
│   ├── static/css/        # 样式文件
│   ├── static/js/         # JavaScript
│   └── templates/         # HTML 模板
├── src/                   # 核心模块
│   ├── auth.py           # 认证系统
│   ├── database.py       # 数据库管理
│   ├── logger.py         # 日志系统
│   ├── model_manager.py  # 模型管理
│   ├── models.py         # 数据模型
│   ├── proxy.py          # 代理核心
│   ├── rate_limiter.py   # 限流器
│   └── stats.py          # 统计分析
├── database/             # SQLite 数据库
├── logs/                 # 日志文件
├── main.py               # 主程序
├── config.json           # 配置文件
├── docker-compose.yml    # Docker 编排
├── Dockerfile
└── requirements.txt      # 依赖
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `ADMIN_PASSWORD` | 管理员密码 | 必须设置 |
| `SOURCE_API_KEY` | 默认源 API 密钥 | - |
| `SERVER_HOST` | 监听地址 | `0.0.0.0` |
| `SERVER_PORT` | 监听端口 | `8080` |
| `LOG_LEVEL` | 日志级别 | `INFO` |

## 安全建议

1. 使用强密码作为 `ADMIN_PASSWORD`
2. 生产环境必须启用 HTTPS
3. 定期轮换 API 密钥
4. 根据实际需求配置限流
5. 不要将 `.env` 文件提交到版本控制

## 管理脚本

项目提供三个管理脚本，方便日常运维：

| 脚本 | 功能 | 用法 |
|------|------|------|
| `init.sh` | 初始化项目（首次运行） | `./init.sh` |
| `start.sh` | 后台启动服务 | `./start.sh` |
| `stop.sh` | 停止服务 | `./stop.sh` |

### 启动/停止示例

```bash
# 首次初始化
./init.sh

# 启动服务
./start.sh

# 查看运行状态
cat relay.pid

# 停止服务
./stop.sh
```

### 日志查看

```bash
# 实时查看日志
tail -f logs/relay.log

# 查看最近 100 行
tail -n 100 logs/relay.log
```

## API 端点详细说明

### 客户端 API（供应用程序使用）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/v1/chat/completions` | POST | 聊天补全（支持流式） |
| `/v1/embeddings` | POST | 向量嵌入 |
| `/v1/models` | GET | 列出可用模型 |
| `/health` | GET | 健康检查 |

**调用示例：**

```bash
# 聊天补全
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "default",
    "messages": [{"role": "user", "content": "你好"}]
  }'

# 流式聊天
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "default",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": true
  }'
```

### 管理 API（用于后台管理）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/api/login` | POST | 管理员登录 |
| `/admin/api/keys` | GET | 列出所有密钥 |
| `/admin/api/keys` | POST | 创建新密钥 |
| `/admin/api/keys/{id}` | PATCH | 更新密钥 |
| `/admin/api/keys/{id}` | DELETE | 删除密钥 |
| `/admin/api/source-apis` | GET/POST | 源 API 管理 |
| `/admin/api/virtual-models` | GET/POST | 虚拟模型管理 |
| `/admin/api/model-bindings` | GET/POST | 绑定管理 |
| `/admin/api/dashboard` | GET | 仪表板数据 |
| `/admin/api/logs` | GET | 请求日志 |
| `/admin/api/statistics` | GET | 统计数据 |
| `/admin/api/config` | GET/POST | 配置管理 |
| `/admin/api/database/backup` | POST | 数据库备份 |
| `/admin/api/database/export` | GET | 导出数据库 |
| `/admin/api/database/import` | POST | 导入数据库 |

## 故障排查

**服务无法启动**
```bash
# 检查端口占用
lsof -i :8080

# 查看详细错误
python3 main.py

# 检查日志
tail -n 50 logs/relay.log
```

**请求失败**
- 检查源 API 配置（URL、密钥、模型名）
- 查看 `logs/relay.log`
- 确认网络连接正常

**管理面板无法访问**
- 确认服务已启动：`ps aux | grep main.py`
- 检查防火墙设置

## 更新日志

### v1.2.0

- 国际化 (i18n) 支持：管理面板支持中文/英文切换
- OpenAI SDK 集成：支持 兼容 OpenAI API 的服务
- 修复隐私过滤功能导致的错误
- 修复数据导入导出功能
- 修复数据统计功能的已知问题
- 新增获取源 API 模型功能
- 管理面板 UI 全面国际化

### v1.1.0

- 更详尽的统计系统
- 新增隐私过滤功能，支持过滤元数据、使用详情、提供商信息等
- 改进显示格式
- 修复多个 bug 并优化性能
- 改进管理面板 UI/UX

### v1.0.0

- 初始版本发布
- 完整的管理面板
- API 密钥管理
- 限流控制
- 统计分析

## 贡献

我们欢迎所有形式的贡献！

### 如何贡献

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发指南

详见 [CONTRIBUTING.md](CONTRIBUTING.md)

### 报告问题

如果您发现了 bug 或有功能建议，请在 [GitHub Issues](https://github.com/PlayLimitXT/API-Relay/issues) 中提交。

## 致谢

感谢所有贡献者的付出！

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

**Copyright © 2026 PLXT**

