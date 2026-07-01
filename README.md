# AINovel GUI

> AI 辅助长篇小说创作引擎的桌面图形界面  
> 基于 [ainovel-cli](https://github.com/crazytreeChen/ainovel-cli) 的全功能可视化客户端

---

## 功能特性

### 📖 作品管理
| 功能 | 说明 |
|------|------|
| 书架管理 | 创建、浏览、切换多部作品，每部独立存储 |
| 封面展示 | 作品封面卡片，书名/作者/进度一目了然 |
| SQLite 持久化 | 所有创作数据本地存储，离线可用 |

### ✍️ 创作工作台
| 功能 | 说明 |
|------|------|
| 工作区布局 | 左侧模块导航 + 中央主区域 + 实时状态监控 |
| 章节写作 | 支持快速模式（一句话开写）和共创模式（多轮规划） |
| 大纲管理 | 卷/章/节三层结构，拖拽排序，完成状态标记 |
| 角色编辑 | 姓名、设定、弧光、关系图管理 |
| 时间线 | 故事时间线编排 |
| 上下文摘要 | 自动生成故事摘要，辅助长篇连贯性 |
| 模拟推演 | AI 模拟剧情走向，提前预览分支 |

### 🔧 配置与定制
| 功能 | 说明 |
|------|------|
| 模型配置 | 按角色（Architect/Writer/Editor）独立设置 Provider/Model/推理强度 |
| 世界规则 | 自定义世界观设定（魔法体系、科技水平、社会结构等） |
| 用户规则 | 自定义写作约束（风格、禁忌、偏好） |
| 系统设置 | 主题切换（亮色/暗色/跟随系统）、数据目录、CLI 路径 |

### 🎮 创作控制
| 功能 | 说明 |
|------|------|
| 实时状态栏 | 运行态/阶段/流程/已完成章数/字数统计 |
| 事件流监控 | DISPATCH / DONE / TOOL / ERROR / SYSTEM / AGENT 事件分类展示 |
| 实时输出 | AI 流式输出（思考过程 + 正文分块渲染） |
| 输入干预 | 随时暂停，发送指令引导创作方向 |
| 开始/暂停/继续 | 完整的创作生命周期控制 |

### 🔍 诊断与质量
| 功能 | 说明 |
|------|------|
| 诊断报告 | 四维度诊断（流程/质量/规划/上下文） |
| 评审记录 | 逐章评审历史与改进建议 |
| 导出 | 支持 TXT / EPUB，可指定章节区间 |

---

## 快速开始

### 前置条件

- **Node.js** ≥ 18
- **npm** ≥ 9
- **ainovel-cli** 命令行工具

```bash
# 安装 ainovel-cli（如未安装）
curl -fsSL https://raw.githubusercontent.com/voocel/ainovel-cli/main/scripts/install.sh | sh

# 或通过 Go 安装
go install github.com/voocel/ainovel-cli/cmd/ainovel-cli@latest
```

### 开发模式

```bash
# 安装依赖
npm install

# 启动开发环境（前端热更新 + Electron）
npm run electron:dev
```

### 生产构建

```bash
# macOS DMG
npm run dist:mac

# Windows NSIS 安装包
npm run dist:win

# Linux
npm run dist:linux

# 全部平台
npm run dist:all
```

构建产物位于 `release/` 目录。

### 一键发布到 GitHub Release

```bash
# 完整发布流程（编译 mac + win → 计算 SHA256 → 创建 Release → 上传产物）
npm run release

# 仅编译，不上传
npm run release:build-only

# 跳过 macOS / Windows 编译
npm run release -- --skip-mac
npm run release -- --skip-win

# 草稿模式（Release 标记为 draft）
npm run release -- --draft

# 预览模式（不执行实际操作）
npm run release:dry-run
```

> **前置条件**：需要安装 [GitHub CLI](https://cli.github.com/) 并登录：
> ```bash
> brew install gh
> gh auth login
> ```

---

## 项目结构

```
ainovel-gui/
├── electron/                     # Electron 主进程
│   ├── main.ts                   # 主进程：IPC 通信、子进程管理、文件读写
│   ├── preload.ts                # Context Bridge（安全 API 暴露给渲染进程）
│   ├── database.ts               # SQLite 数据库（better-sqlite3）
│   └── tsconfig.json
├── src/                          # React 前端（渲染进程）
│   ├── main.tsx                  # React 入口
│   ├── App.css                   # 暖调书卷风格 CSS + 主题系统
│   ├── components/               # 通用组件
│   │   ├── App.tsx               # 根组件：HashRouter + 路由 + 主题
│   │   ├── TopBar.tsx            # 顶栏（状态徽章、快捷操作）
│   │   ├── StatusSidebar.tsx     # 状态侧栏（大纲、角色、用量）
│   │   ├── EventFlow.tsx         # 事件流面板
│   │   ├── StreamOutput.tsx      # AI 实时输出面板
│   │   ├── DetailPanel.tsx       # 详情面板（前提、提交、审阅）
│   │   ├── InputBox.tsx          # 输入框 + 命令面板
│   │   ├── Welcome.tsx           # 欢迎页（快速/共创模式选择）
│   │   ├── BookCover.tsx         # 书籍封面卡片
│   │   ├── BookNavSidebar.tsx    # 工作区左侧模块导航
│   │   ├── ErrorBoundary.tsx     # 全局错误边界
│   │   ├── Toast.tsx             # 全局提示组件
│   │   ├── CoCreateModal.tsx     # 共创规划模态框
│   │   ├── DiagnosticsModal.tsx   # 诊断报告模态框
│   │   ├── ExportModal.tsx       # 导出设置模态框
│   │   ├── HelpModal.tsx         # 帮助/快捷键
│   │   └── ModelSwitchModal.tsx  # 模型切换模态框
│   ├── pages/                    # 页面组件
│   │   ├── BookList.tsx          # 书架列表页（首页）
│   │   ├── BookIntroPage.tsx     # 作品详情页
│   │   ├── NewBook.tsx           # 新建/导入作品页
│   │   ├── Workspace.tsx         # 创作工作台（含子路由）
│   │   ├── OutlinePage.tsx       # 大纲管理页
│   │   ├── ChapterPage.tsx       # 章节写作页
│   │   ├── CharactersPage.tsx    # 角色管理页
│   │   ├── TimelinePage.tsx      # 时间线页
│   │   ├── ReviewsPage.tsx       # 评审记录页
│   │   ├── SummaryPage.tsx       # 上下文摘要页
│   │   ├── SimulationPage.tsx    # 剧情模拟页
│   │   ├── ModelsPage.tsx        # 模型配置页
│   │   ├── UserRulesPage.tsx     # 用户规则页
│   │   ├── WorldRulesPage.tsx    # 世界规则页
│   │   └── SettingsPage.tsx      # 系统设置页
│   ├── stores/useAppStore.ts     # Zustand 集中式状态管理
│   ├── types/index.ts            # TypeScript 类型定义
│   └── lib/                      # 工具模块
│       ├── store/                # SQLite 数据读写封装 (io.ts)
│       ├── models/               # 模型配置相关
│       ├── rules/                # 规则处理
│       └── host/                 # 宿主环境交互
├── scripts/
│   ├── build.js                  # 构建脚本
│   ├── build-cli.js              # ainovel-cli 子模块编译
│   └── generate-icons.js         # 图标生成
├── build/                        # 构建资源（图标等）
├── package.json                  # 依赖 + electron-builder 配置
├── vite.config.ts
├── tsconfig.json
├── AGENTS.md                     # AI Agent 项目约束
└── CLAUDE.md                     # 技术栈速览
```

---

## 架构说明

```
┌──────────────────────────────────────────────────────┐
│                 AINovel GUI (Electron)                 │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │ 书架首页  │  │   创作工作台   │  │  系统设置      │   │
│  │ BookList │  │  ┌──────────┐ │  │  Models/Rules  │   │
│  │          │  │  │ 侧栏导航  │ │  │  Settings      │   │
│  │          │  │  ├──────────┤ │  └────────────────┘   │
│  │          │  │  │ 主内容区  │ │                       │
│  │          │  │  └──────────┘ │                       │
│  └──────────┘  └──────────────┘                       │
│             HashRouter + Zustand Store                │
└──────────────────────┬───────────────────────────────┘
                       │ IPC (contextBridge)
┌──────────────────────▼───────────────────────────────┐
│              Electron Main Process                     │
│  子进程管理 / SQLite 数据库 / 文件系统 / 系统对话框     │
└──────────────────────┬───────────────────────────────┘
                       │ spawn + stdin/stdout
┌──────────────────────▼───────────────────────────────┐
│              ainovel-cli (headless)                    │
│          AI Novel Writing Engine (Go)                  │
└──────────────────────────────────────────────────────┘
```

GUI 通过 IPC 与 Electron 主进程通信，主进程通过子进程启动 `ainovel-cli --headless`，读取其 `output/` 目录中的 JSON/Markdown 产物获取进度，通过 stdin/stdout 发送用户交互指令。作品元数据通过 SQLite (`better-sqlite3`) 持久化存储于 `~/.ainovel-gui/` 目录。

---

## 常用命令

```bash
npm run dev              # 仅前端开发（Vite 热更新）
npm run typecheck        # TypeScript 类型检查
npm run build            # 全量构建（渲染进程 + 主进程 + CLI 子模块）
npm run build:renderer   # 仅构建前端
npm run build:electron   # 仅构建主进程
npm run electron:dev     # 开发模式（Vite + Electron 并行）
npm run electron:start   # 生产模式启动
npm run pack             # 打包到目录（不打包安装程序）
npm run dist:mac         # 构建 macOS DMG/ZIP
npm run dist:win         # 构建 Windows NSIS/ZIP
npm run dist:linux       # 构建 Linux AppImage/DEB
npm run dist:all         # 构建全部平台
npm run release          # 一键编译 + 发布 GitHub Release
npm run release:build-only  # 仅编译，不发布
npm run release:dry-run  # 预览模式
npm run generate-icons   # 从 SVG 生成多尺寸图标
```

---

## 技术栈

| 层次 | 技术 |
|------|------|
| 桌面框架 | Electron 31 |
| 前端框架 | React 18 + TypeScript 5 |
| 构建工具 | Vite 5 |
| 路由 | react-router-dom v7 (HashRouter) |
| 状态管理 | Zustand 4 |
| 数据持久化 | better-sqlite3 (SQLite) |
| 图标 | Lucide React |
| 样式 | 纯 CSS（暖调书卷色板 + CSS 变量主题） |
| 打包 | electron-builder |

---

## 跨平台支持

| 平台 | 分发格式 | 架构 |
|------|---------|------|
| macOS | DMG / ZIP | x64 + arm64 |
| Windows | NSIS 安装包 / ZIP | x64 |
| Linux | AppImage / DEB | x64 |

支持三平台自动构建，`ainovel-cli` 二进制通过 `extraResources` 随应用一起打包分发。

---

## 开发指南

详细开发规范见 [`AGENTS.md`](./AGENTS.md)，技术速览见 [`CLAUDE.md`](./CLAUDE.md)。

---

## 致敬

- [ainovel-cli](https://github.com/crazytreeChen/ainovel-cli) — AI 小说创作引擎核心，提供完整的多智能体协作写作能力
- [voocel/ainovel-cli](https://github.com/voocel/ainovel-cli) — 社区 fork，提供安装脚本与持续维护

## 致谢

感谢所有 AI 写作工具生态的贡献者，让技术辅助创作成为可能。

---

## 许可证

MIT
