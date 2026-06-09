# 🐱 MeowCode — 自治 Agent 

> **Autonomous Agent Terminal Engine**  
> 让 AI 在终端里“长出爪子”，帮你干活！⚡

---

## 📖 项目解读

**MeowCode** 不是一个普通的 CLI 工具——它是一个**能思考、能动手、能记事儿**的 AI Agent 终端引擎！🧠✋

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

### 📁 项目结构

```
MeowCode/
├── src/
│   ├── index.tsx          # 入口：Agent CLI 主循环
│   ├── ds.ts              # DeepSeek / OpenAI API 封装
│   ├── context/
│   │   └── memory.ts      # 记忆管理器（长期记忆 + 压缩）
│   ├── tools/
│   │   ├── index.ts              # 工具调度中心
│   │   ├── readLocalFile.ts      # 读取本地文件/目录
│   │   ├── writeLocalFile.ts     # 写入本地文件
│   │   └── runTerminalCommand.ts # 执行终端命令
│   └── skills/            # 🚧 预留：技能扩展目录
├── build/                 # 编译输出
├── package.json           # 包配置（全局安装：npm link）
└── tsconfig.json
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

### 🧠 记忆系统特色

MeowCode 的记忆管理就像**真正的猫猫大脑**：

- 🐱 **短期记忆**：保留最近 N 轮对话
- 🧠 **长期记忆**：当对话太长时，自动压缩为“记忆大纲”
- 🔄 压缩时你会看到提示：**"喵要长脑子了..."** 🐱💡

### 🎮 终端交互

启动后你会看到一个酷炫的猫猫 Logo + 输入框，输入你的问题，AI 会：

1. 🧠 思考你的意图（展示思考过程）
2. 🛠️ 决定是否需要调用工具
3. 💬 回复最终结果
4. 🔄 如果需要，自动压缩记忆

输入 `/exit` 即可退出。

### 📌 命令

| 命令 | 作用 |
|------|------|
| `npm run dev` | 开发模式运行 |
| `npm run build` | TypeScript 编译构建 |
| `npm link` | 全局安装为 `meowcode` 命令 |
| `npm unlink -g meowcode` | 卸载全局链接 |

---

> **喵喵出品，必属精品！** 🐱🍪  
