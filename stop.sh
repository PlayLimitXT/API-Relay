#!/bin/bash

# API Relay Service - 停止脚本
# 功能：使用 PID 文件停止服务

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PID_FILE="$SCRIPT_DIR/relay.pid"

# 检查 PID 文件
if [ ! -f "$PID_FILE" ]; then
    echo -e "${YELLOW}服务未运行 (找不到 PID 文件)${NC}"
    exit 0
fi

PID=$(cat "$PID_FILE")

# 检查进程是否存在
if ! ps -p "$PID" > /dev/null 2>&1; then
    echo -e "${YELLOW}服务未运行 (进程已退出)${NC}"
    rm -f "$PID_FILE"
    exit 0
fi

# 停止服务
echo -e "${YELLOW}停止服务 (PID: $PID)...${NC}"
kill "$PID"

# 等待进程退出
for i in {1..10}; do
    if ! ps -p "$PID" > /dev/null 2>&1; then
        break
    fi
    sleep 1
done

# 强制停止如果还没退出
if ps -p "$PID" > /dev/null 2>&1; then
    echo -e "${YELLOW}强制停止服务...${NC}"
    kill -9 "$PID"
    sleep 1
fi

# 清理
if ! ps -p "$PID" > /dev/null 2>&1; then
    rm -f "$PID_FILE"
    echo -e "${GREEN}服务已停止${NC}"
else
    echo -e "${RED}服务停止失败${NC}"
    exit 1
fi