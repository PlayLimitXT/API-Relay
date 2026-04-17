# API Relay Service by PLXT

A powerful LLM API relay service with multi-key management, virtual model IDs, rate limiting, real-time monitoring, and a visual admin panel.

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-1.2.0-blue.svg)](CHANGELOG.md)
[![Open Source](https://img.shields.io/badge/Open%20Source-❤️-red.svg)](#contributing)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](docker-compose.yml)
[![i18n](https://img.shields.io/badge/i18n-Chinese/English-orange.svg)](#features)

**[中文文档](README.md) | [Changelog](CHANGELOG.md) | [Contributing](CONTRIBUTING.md)**

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Core Concepts](#core-concepts)
- [Deployment Guide](#deployment-guide)
- [API Reference](#api-reference)
- [Admin Scripts](#admin-scripts)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Virtual Model IDs**: Custom model ID mapping to hide source API details
- **Multi-Source API Management**: Support for multiple API providers (OpenRouter, OpenAI, etc.)
- **Three-Layer Architecture**: Source API → Virtual Model → Binding relationships for flexible routing
- **Fine-Grained Access Control**: Independent rate limiting and access control per API key
- **Real-Time Monitoring**: Request statistics, usage analysis, top users/models rankings
- **Web Admin Panel**: Complete visual interface for managing all features
- **OpenAI Compatible**: Seamless integration with existing applications
- **Rate Limiting Protection**: Global and per-key rate limiting for overload protection
- **Privacy Filtering**: Optional sensitive information filtering
- **Detailed Logging**: Complete request logs and statistical analysis
- **Internationalization**: Admin panel supports Chinese/English switching
- **OpenAI SDK Compatible**: Supports OpenAI-compatible services like OpenRouter

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure the Service

**Option 1: Using `config.json` (Recommended for local development)**

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

**Option 2: Using Environment Variables (Recommended for production)**

```bash
export ADMIN_PASSWORD="your-secure-password"
export SOURCE_API_KEY="your-source-api-key"
export SERVER_PORT=8080
export LOG_LEVEL=INFO
```

Or using a `.env` file:

```bash
cp .env.example .env
# Edit .env and fill in actual configuration
```

### 3. Initialize (First Run)

```bash
./init.sh
```

The initialization script will:
- Install Python dependencies
- Create required directories (database, backups, logs)
- Initialize the database
- Set up admin password and service port

### 4. Start the Service

**Option 1: Using admin scripts (Recommended)**
```bash
./start.sh
```

**Option 2: Run directly**
```bash
python3 main.py
```

The service will start at `http://localhost:8080`.

### 5. Stop the Service

```bash
./stop.sh
```

### 6. Access the Admin Panel

Open your browser and visit: `http://localhost:8080/admin`

Default admin account: Password is set during initialization

## Architecture

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

## Core Concepts

### Three-Layer Architecture

1. **Source API**: Actual API provider configuration
   - Contains base_url, api_key, supported models list
   - Multiple source APIs can be added for load balancing

2. **Virtual Model**: Model identifier used by clients
   - Custom name and description
   - Externally exposed model ID

3. **Binding**: Connects virtual models to source APIs
   - Specifies which source API's model the virtual model maps to
   - Supports priority configuration

### API Keys

- Format: `sk-` prefix + Base64-encoded random string
- Each key can be independently configured with:
  - Rate limit (requests/minute)
  - Expiration time
  - Status (enabled/disabled)

## Deployment Guide

### Docker Deployment

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

### Systemd Service

Create `/etc/systemd/system/api-relay.service`:

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

### Nginx Reverse Proxy

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

## API Reference

### OpenAI-Compatible Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | Chat completions (streaming supported) |
| `/v1/models` | GET | List available models |
| `/health` | GET | Health check |

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/api/login` | POST | Admin login |
| `/admin/api/keys` | GET/POST | Key list/create |
| `/admin/api/keys/{id}` | PATCH/DELETE | Update/delete key |
| `/admin/api/source-apis` | GET/POST | Source API management |
| `/admin/api/virtual-models` | GET/POST | Virtual model management |
| `/admin/api/model-bindings` | GET/POST | Binding management |
| `/admin/api/dashboard` | GET | Dashboard statistics |
| `/admin/api/logs` | GET | Request logs |

## Project Structure

```
api-relay/
├── admin/                  # Web admin panel
│   ├── static/css/        # Stylesheets
│   ├── static/js/         # JavaScript files
│   └── templates/         # HTML templates
├── src/                   # Core modules
│   ├── auth.py           # Authentication system
│   ├── database.py       # Database management
│   ├── logger.py         # Logging system
│   ├── model_manager.py  # Model management
│   ├── models.py         # Data models
│   ├── proxy.py          # Proxy core
│   ├── rate_limiter.py   # Rate limiter
│   └── stats.py          # Statistics
├── database/             # SQLite database
├── logs/                 # Log files
├── main.py               # Main application
├── config.json           # Configuration file
├── docker-compose.yml    # Docker compose
├── Dockerfile
└── requirements.txt      # Dependencies
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_PASSWORD` | Admin password | Required |
| `SOURCE_API_KEY` | Default source API key | - |
| `SERVER_HOST` | Listen address | `0.0.0.0` |
| `SERVER_PORT` | Listen port | `8080` |
| `LOG_LEVEL` | Log level | `INFO` |

## Security Recommendations

1. Use a strong password for `ADMIN_PASSWORD`
2. Enable HTTPS in production
3. Rotate API keys regularly
4. Configure rate limiting based on actual needs
5. Do not commit `.env` files to version control

## Admin Scripts

Three management scripts are provided for daily operations:

| Script | Function | Usage |
|--------|----------|-------|
| `init.sh` | Initialize project (first run) | `./init.sh` |
| `start.sh` | Start service in background | `./start.sh` |
| `stop.sh` | Stop service | `./stop.sh` |

### Start/Stop Examples

```bash
# First initialization
./init.sh

# Start service
./start.sh

# Check running status
cat relay.pid

# Stop service
./stop.sh
```

### Log Viewing

```bash
# Real-time logs
tail -f logs/relay.log

# Last 100 lines
tail -n 100 logs/relay.log
```

## API Endpoint Details

### Client API (For application use)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/chat/completions` | POST | Chat completions (streaming supported) |
| `/v1/embeddings` | POST | Vector embeddings |
| `/v1/models` | GET | List available models |
| `/health` | GET | Health check |

**Usage Examples:**

```bash
# Chat completions
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "default",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Streaming chat
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "default",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

### Admin API (For backend management)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/api/login` | POST | Admin login |
| `/admin/api/keys` | GET | List all keys |
| `/admin/api/keys` | POST | Create new key |
| `/admin/api/keys/{id}` | PATCH | Update key |
| `/admin/api/keys/{id}` | DELETE | Delete key |
| `/admin/api/source-apis` | GET/POST | Source API management |
| `/admin/api/virtual-models` | GET/POST | Virtual model management |
| `/admin/api/model-bindings` | GET/POST | Binding management |
| `/admin/api/dashboard` | GET | Dashboard data |
| `/admin/api/logs` | GET | Request logs |
| `/admin/api/statistics` | GET | Statistics |
| `/admin/api/config` | GET/POST | Configuration management |
| `/admin/api/database/backup` | POST | Database backup |
| `/admin/api/database/export` | GET | Export database |
| `/admin/api/database/import` | POST | Import database |

## Troubleshooting

**Service fails to start**
```bash
# Check port usage
lsof -i :8080

# Check detailed error
python3 main.py

# Check logs
tail -n 50 logs/relay.log
```

**Request failures**
- Check source API configuration (URL, key, model name)
- Check `logs/relay.log`
- Verify network connectivity

**Admin panel inaccessible**
- Verify service is running: `ps aux | grep main.py`
- Check firewall settings

## Changelog

### v1.2.0

- Internationalization (i18n) support: Admin panel Chinese/English switching
- OpenAI SDK integration: Supports OpenAI API-compatible services
- Fixed privacy filtering feature errors
- Fixed data import/export functionality
- Fixed known issues with statistics functionality
- Added source API model retrieval feature
- Admin panel UI fully internationalized

### v1.1.0

- Enhanced statistics system
- Added privacy filtering: supports filtering metadata, usage details, provider info, etc.
- Improved display format
- Fixed multiple bugs and optimized performance
- Improved admin panel UI/UX

### v1.0.0

- Initial release
- Complete admin panel
- API key management
- Rate limiting control
- Statistics analysis

## Contributing

We welcome all forms of contributions!

### How to Contribute

1. Fork this repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add some amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Create a Pull Request

### Development Guide

See [CONTRIBUTING.md](CONTRIBUTING.md)

### Reporting Issues

If you find a bug or have a feature request, please submit it in [GitHub Issues](https://github.com/PlayLimitXT/API-Relay/issues).

## Acknowledgments

Thanks to all contributors for their contributions!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

---

**Copyright © 2026 PLXT**
