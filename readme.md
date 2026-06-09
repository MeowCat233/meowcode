# 🐱 MeowCode — Agent 

## 📖 项目解读

**MeowCode** 是一个**能思考、能动手、能记事儿**的 Agent ！🧠✋

### 🤔 它到底是什么？

简单说：你在终端里跟它聊天，它能自动调用工具帮你做事。

- 你说 *"帮我看看项目里有啥"* → 它自动调用 `readLocalFile` 扫描目录
- 你说 *"把 README 改得更帅"* → 它调用 `readLocalFile` 读 + `writeLocalFile` 写
- 你说 *"跑一下构建命令"* → 它调用 `runTerminalCommand` 执行

**全程自动，无须你手动操作。** 它就是你的终端副驾驶！🚗💨

### 🧬 架构亮点

| 模块 | 说明 |
|------|------|
| 🎨 **Ink UI** | 基于 React + Ink 构建的终端交互界面，支持彩色输出、边框、Spinner |
| 🧠 **DS（DeepSeek）** | 接入大模型 API，负责理解意图、生成回复、决策工具调用 |
| 🛠️ **工具系统** | 内置 `readLocalFile` / `writeLocalFile` / `runTerminalCommand`，可扩展 |
| 💾 **记忆系统** | `MemoryManager` 维护对话上下文，支持**自动压缩**为长期记忆（"长脑子"） |
| 🤔 **思维链展示** | 展示 AI 的思考过程（reasoning_content），让你看到它“心里在想啥” |

### 🎯 技术栈

```
React 19 + Ink 7      → 终端 UI 渲染
TypeScript 6          → 类型安全
OpenAI SDK            → 大模型 API 调用
Commander             → CLI 命令管理（脚手架预留）
chalk                 → 终端彩色输出
MemoryManager         → 自定义上下文管理与压缩
```

### 🚀 快速开始

```bash
# 安装依赖
npm install

# 开发模式（热启动）
npm run dev

# 构建
npm run build

# 全局安装（可在任意目录使用 meowcode 命令）
npm link

# 使用meowcode
npx meowcode
```




