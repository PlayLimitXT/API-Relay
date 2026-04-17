#!/bin/bash

# API Relay Service - 初始化脚本
# 功能：安装依赖、设置配置、初始化数据库

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== API Relay Service 初始化脚本 ===${NC}"

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 检查 Python 版本
echo -e "\n${YELLOW}[1/6] 检查 Python 版本...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}错误: 未找到 Python 3，请先安装 Python 3.9+${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
echo "Python 版本: $PYTHON_VERSION"

# 安装依赖
echo -e "\n${YELLOW}[2/6] 安装依赖...${NC}"
pip3 install -r requirements.txt --quiet
echo -e "${GREEN}依赖安装完成${NC}"

# 创建必要目录
echo -e "\n${YELLOW}[3/6] 创建必要目录...${NC}"
mkdir -p database backups logs
echo -e "${GREEN}目录创建完成${NC}"

# 初始化数据库
echo -e "\n${YELLOW}[4/6] 初始化数据库...${NC}"
python3 -c "from src.database import init_database; import asyncio; asyncio.run(init_database())"
echo -e "${GREEN}数据库初始化完成${NC}"

# 设置配置文件
echo -e "\n${YELLOW}[5/6] 配置服务...${NC}"

# 检查是否已有配置文件
if [ -f "config.json" ]; then
    echo "配置文件已存在，跳过创建"
else
    if [ -f "config.json.example" ]; then
        cp config.json.example config.json
        echo -e "${GREEN}已从示例创建配置文件${NC}"
    fi
fi

# 提示设置管理员密码
echo -e "\n${YELLOW}请设置管理员密码:${NC}"
read -s -p "输入管理员密码: " ADMIN_PASS
echo ""

if [ -n "$ADMIN_PASS" ]; then
    # 使用 Python 更新密码
    python3 << EOF
import json
with open('config.json', 'r') as f:
    config = json.load(f)
config['admin_password'] = '$ADMIN_PASS'
with open('config.json', 'w') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)
print("密码已设置")
EOF
fi

# 设置端口（可选）
echo -e "\n${YELLOW}请设置服务端口 (默认 8080):${NC}"
read -p "端口: " PORT
if [ -n "$PORT" ]; then
    python3 << EOF
import json
with open('config.json', 'r') as f:
    config = json.load(f)
config.setdefault('server', {})['port'] = $PORT
with open('config.json', 'w') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)
print("端口已设置为: $PORT")
EOF
fi

echo -e "\n${GREEN}=== 初始化完成 ===${NC}"
echo ""
echo "启动服务命令: ./start.sh"
echo "停止服务命令: ./stop.sh"
echo "管理面板: http://localhost:8080/admin"