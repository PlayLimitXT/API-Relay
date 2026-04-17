#!/bin/bash

# API Relay Service - 启动脚本
# 功能：后台启动服务，记录 PID

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PID_FILE="$SCRIPT_DIR/relay.pid"
LOG_FILE="$SCRIPT_DIR/logs/relay.log"

# 检查是否已运行
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${RED}服务已在运行中 (PID: $PID)${NC}"
        exit 1
    else
        rm -f "$PID_FILE"
    fi
fi

# 检查端口是否被占用
PORT=$(python3 -c "import json; print(json.load(open('config.json'))['server'].get('port', 8080))" 2>/dev/null || echo "8080")
if lsof -i:$PORT > /dev/null 2>&1; then
    echo -e "${RED}端口 $PORT 已被占用${NC}"
    exit 1
fi

# 启动服务
echo -e "${GREEN}启动 API Relay Service...${NC}"
nohup python3 main.py > "$LOG_FILE" 2>&1 &
PID=$!
echo $PID > "$PID_FILE"

# 等待服务启动
sleep 2

# 检查是否启动成功
if ps -p $PID > /dev/null 2>&1; then
    echo -e "${GREEN}服务启动成功!${NC}"
    echo "PID: $PID"
    echo "日志: $LOG_FILE"
    echo "管理面板: http://localhost:$PORT/admin"
else
    echo -e "${RED}服务启动失败，请查看日志: $LOG_FILE${NC}"
    rm -f "$PID_FILE"
    exit 1
fi