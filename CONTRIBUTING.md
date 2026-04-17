# Contributing to API Relay Service

感谢您考虑为 API Relay Service 项目做出贡献！

## 如何贡献

### 报告问题

如果您发现了 bug 或有功能建议，请：

1. 在 GitHub Issues 中搜索类似问题
2. 如果没有找到，创建新 Issue 并提供：
   - 清晰的问题描述
   - 重现步骤（如适用）
   - 预期行为与实际行为
   - 系统环境信息（Python 版本、操作系统等）

### 提交代码

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范

#### Python 代码
- 遵循 PEP 8 规范
- 使用类型提示（Type Hints）
- 添加必要的文档字符串
- 保持函数简洁，单一职责

#### JavaScript 代码
- 使用现代 ES6+ 语法
- 遵循一致的命名约定
- 添加必要的注释

#### 通用规范
- 提交前测试您的更改
- 更新相关文档
- 保持提交历史清晰

### 开发环境设置

```bash
# 克隆仓库
git clone https://github.com/yourusername/res-api-relay.git

# 安装依赖
pip install -r requirements.txt

# 初始化项目
./init.sh

# 启动开发服务器
python3 main.py
```

### 测试

在提交 PR 前，请确保：
- 服务可以正常启动
- 基本功能正常工作（API 转发、管理面板访问等）
- 新功能按预期工作

### 文档贡献

文档改进同样重要：
- 修正拼写错误
- 改进说明清晰度
- 补充缺失的文档
- 翻译文档到其他语言

## 许可证

通过贡献代码，您同意您的贡献将按照 MIT 许可证授权。

## 问题？

如有任何问题，请随时创建 Issue 或联系维护者。

再次感谢您的贡献！