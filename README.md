# AINovel GUI

> AI Novel Writing Engine — 桌面 GUI 应用  
> 基于 [ainovel-cli](https://github.com/crazytreeChen/ainovel-cli) 的全功能可视化界面

AI 辅助长篇小说创作引擎的桌面图形界面。支持多智能体协作（Architect / Writer / Editor）、断点恢复、实时干预、分层长篇、上下文自适应压缩、七维质量评审等全部 TUI 功能。

---

## 功能特性

| 功能 | 对应 TUI | 说明 |
|------|----------|------|
| 顶栏状态 | `renderTopBar` | provider/model/小说名/运行状态 spinner |
| 状态侧栏 | `renderStateContent` | 运行态/阶段/流程/已完成章数/字数 |
| 角色监控 | `sidebarAgents` | 查看活跃 Agent（COORDINATOR/ARCHITECT/WRITER/EDITOR） |
| 事件流 | `renderEventContent` | DISPATCH/DONE/TOOL/ERROR/SYSTEM/USER 事件分类展示 |
| 实时输出 | `renderStreamContent` | AI 流式输出（思考/正文分块渲染） |
| 详情面板 | `renderDetailContent` | 大纲/角色/前提/最近提交与审阅 |
| 大纲展示 | `renderOutlineSection` | 完成(●)/进行中(▸)/未开始(○)，长篇多列网格 |
| 输入框 | 底部 textarea | 发送干预/继续指令 |
| 命令面板 | `/` 前缀 | /help /model /diag /import /export /cocreate /simulate |
| 快速启动 | quick mode | 一句话直接开始创作 |
| 共创规划 | cocreate mode | 多轮对话澄清需求，Ctrl+S 开始创作 |
| 模型切换 | `/model` | 选择 Provider + Model + 推理强度（按角色） |
| 诊断报告 | `/diag` | 四维度诊断（流程/质量/规划/上下文） |
| 导出 | `/export` | TXT/EPUB，支持章节区间 |

---

## 快速开始

### 前置条件

1. **Node.js** ≥ 18（已安装 v22.22.0）
2. **npm** ≥ 9（已安装 10.9.4）
3. **ainovel-cli** 命令行工具

```bash
# 安装 ainovel-cli（如未安装）
curl -fsSL https://raw.githubusercontent.com/voocel/ainovel-cli/main/scripts/install.sh | sh

# 或通过 Go 安装
go install github.com/voocel/ainovel-cli/cmd/ainovel-cli@latest
```

### 开发模式运行

```bash
# 安装依赖
npm install

# 启动前端 dev server + Electron
npm run electron:dev
```

### 生产构建

```bash
# macOS DMG
npm run dist:mac

# Windows NSIS 安装包
npm run dist:win

# 全部平台
npm run dist:all

# 使用构建脚本（自动处理图标 + 打包 ainovel-cli）
AINOVEL_BIN=/path/to/ainovel-cli node scripts/build.js mac
```

构建产物位于 `release/` 目录：

```
release/
├── AINovel-0.1.0-mac-arm64.dmg   # macOS 安装包
├── AINovel-0.1.0-mac-arm64.zip    # macOS 便携版
├── AINovel-0.1.0-win-x64.exe      # Windows 安装包
└── AINovel-0.1.0-win-x64.zip      # Windows 便携版
```

---

## 项目结构

```
ainovel-gui/
├── electron/                 # Electron 主进程
│   ├── main.ts               # 主进程：IPC、子进程管理、文件读取
│   ├── preload.ts            # Context Bridge（安全 API 暴露）
│   └── tsconfig.json
├── src/                      # React 前端
│   ├── main.tsx              # React 入口
│   ├── App.css               # 暖调书卷风格 CSS
│   ├── components/
│   │   ├── App.tsx           # 主布局 + Tab 焦点切换
│   │   ├── TopBar.tsx        # 顶栏
│   │   ├── StatusSidebar.tsx # 状态侧栏
│   │   ├── EventFlow.tsx     # 事件流
│   │   ├── StreamOutput.tsx  # 实时输出
│   │   ├── DetailPanel.tsx   # 详情面板
│   │   ├── InputBox.tsx      # 输入框 + 命令面板
│   │   ├── Welcome.tsx       # 欢迎页
│   │   └── *.tsx             # 模态框
│   ├── stores/useAppStore.ts # Zustand 状态管理
│   └── types/index.ts        # TypeScript 类型定义
├── build/                    # 构建资源
│   ├── icon.svg              # 应用图标 SVG
│   └── icons/                # 多尺寸 PNG
├── scripts/
│   ├── build.js              # 构建脚本
│   └── generate-icons.js     # 图标生成
├── package.json              # 依赖 + electron-builder 配置
├── vite.config.ts
└── tsconfig.json
```

---

## 开发指南

### 常用命令

```bash
npm run dev              # 仅前端开发（热更新）
npm run typecheck        # TypeScript 类型检查
npm run build:renderer   # 构建前端
npm run build:electron   # 构建主进程
npm run build            # 全量构建
npm run electron:dev     # 开发模式（热更新 + Electron）
npm run electron:start   # 生产模式启动
```

### 架构说明

```
┌─────────────────────────────────────────────────┐
│                 AINovel GUI (Electron)            │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Status   │  │ Center   │  │   Detail     │  │
│  │  Sidebar  │  │ Events+  │  │   Panel      │  │
│  │           │  │ Stream   │  │              │  │
│  └───────────┘  └──────────┘  └──────────────┘  │
│  ┌─────────────────────────────────────────────┐ │
│  │               Input Box + Cmds              │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │ IPC
┌──────────────────────▼──────────────────────────┐
│           Electron Main Process                  │
│  子进程管理 / 文件读取 / 系统对话框 / 事件转发    │
└──────────────────────┬──────────────────────────┘
                       │ spawn + stdin/stdout
┌──────────────────────▼──────────────────────────┐
│              ainovel-cli (headless)               │
│         AI Novel Writing Engine (Go)              │
└─────────────────────────────────────────────────┘
```

GUI 通过 IPC 与 Electron 主进程通信，主进程以子进程方式启动 `ainovel-cli --headless`，读取其 `output/` 目录中的 JSON/Markdown 产物来获取进度，通过 stdin 发送用户干预指令。

---

## 跨平台构建说明

### macOS

```bash
# 在 macOS 上构建 DMG
npm run dist:mac
# 产物: release/AINovel-0.1.0-mac-arm64.dmg
#      release/AINovel-0.1.0-mac-arm64.zip
```

支持 Apple Silicon (arm64) 和 Intel (x64) 双架构。

### Windows

```bash
# 在 Windows 上构建 NSIS 安装包
npm run dist:win
# 产物: release/AINovel-0.1.0-win-x64.exe
#      release/AINovel-0.1.0-win-x64.zip
```

NSIS 安装包支持自定义安装目录、桌面快捷方式、开始菜单快捷方式。

### 打包 ainovel-cli

通过在 `build/ainovel-cli/bin/` 目录放置 `ainovel-cli` 二进制文件，打包时自动集成：

```bash
# 事先将 ainovel-cli 二进制放到构建资源目录
cp /path/to/ainovel-cli build/ainovel-cli/bin/
npm run dist:mac

# 或通过环境变量指定
AINOVEL_BIN=/path/to/ainovel-cli node scripts/build.js mac
```

---

## 许可证

MIT
