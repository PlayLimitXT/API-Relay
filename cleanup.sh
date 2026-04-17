#!/bin/bash
# 项目清理脚本 - 删除所有运行时数据和临时文件

echo "清理运行时数据和临时文件..."

# 删除数据库文件
rm -rf database/*.db
rm -rf database/*.db-wal
rm -rf database/*.db-shm
rm -rf database/admin_sessions.json
rm -rf database/backups/*.db

# 删除日志文件
rm -rf logs/*.log

# 删除 PID 文件
rm -rf relay.pid

# 删除 Python 缓存
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find . -type f -name "*.pyc" -delete 2>/dev/null
find . -type f -name "*.pyo" -delete 2>/dev/null

# 删除可能的临时文件
rm -rf .env 2>/dev/null
rm -rf *.tmp 2>/dev/null

# 保留目录结构
mkdir -p database/backups logs

echo "清理完成！"
echo "保留的空目录："
echo "  - database/"
echo "  - database/backups/"
echo "  - logs/"