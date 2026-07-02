# AGENTS.md — ainovel-gui 项目约束

本文件约束自动化代理在本工作区中的默认行为。

---

## 指令优先级

1. 当前会话用户的明确要求
2. 仓库自身规则、文档与约定
3. 本文件
4. 相关 Superpowers / skill 流程定义

- 默认以 Superpowers 作为主工作流体系，但不默认启用 full Superpowers。
- 本文件保留个人硬门禁、环境约束、交付偏好与沟通方式。
- 只读分析任务可不进入完整实现流程，但结论必须清晰、可追溯。
- 若用户明确要求 `continue nonstop`，默认持续推进，直到满足验收标准或出现真实阻塞。

---

## 仓库专有信息

### Repository purpose

ainovel-gui 是 **独立桌面创作管理平台**，基于 [ainovel-cli](https://github.com/crazytreeChen/ainovel-cli) 的 AI 长篇小说创作引擎提供可视化 GUI。
**不是 CLI 的包装外壳**——GUI 直接管理全部数据，`ainovel-cli` 仅作为 AI 推理引擎被调度。

技术栈：Electron（主进程）+ Vite + React 18 + TypeScript + Zustand（状态管理）+ React Router v7。
本地持久化：[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)（SQLite，主存储）+ JSON 文件（CLI 兼容导出）。
目标平台：macOS / Windows / Linux 桌面端。

**编辑平台**：macOS
**构建/运行平台**：macOS / Windows / Linux
**CI**：手动构建

### Build

```bash
# 安装依赖
npm install

# 开发模式（Vite dev server + Electron）
npm run electron:dev

# 仅前端开发
npm run dev

# 生产构建
npm run build

# macOS DMG
npm run dist:mac

# Windows NSIS
npm run dist:win
```

依赖项：Node.js ≥ 18，运行 AI 创作需要安装 `ainovel-cli`。

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                AINovel GUI (Electron)                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐ │
│  │ 书籍 │ │ 大纲 │ │ 章节 │ │ 角色 │ │ 时间线...│ │
│  │ 管理 │ │ 管理 │ │ 管理 │ │ 管理 │ │ 14模块   │ │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘ └────┬─────┘ │
│     └────────┴────────┴────────┴──────────┘        │
│                       ↕ IPC                         │
│  ┌──────────────────────────────────────────────┐   │
│  │         Electron 主进程                       │   │
│  │  SQLite / 子进程管理 / IPC 桥接                │   │
│  └─────┬───────────────┬───────────────────────┘   │
│        ↓               ↕ spawn                     │
│   SQLite (主存储)     ainovel-cli --headless        │
│   ~/.ainovel-gui/     (仅 AI 推理引擎)              │
│      ainovel.db                                   │
│        ↓                                           │
│   JSON 文件导出 (books/{uuid}/)                    │
│   [CLI 兼容 / 备份 / 交换]                         │
└─────────────────────────────────────────────────────┘
```

### 14 个功能模块

| # | 模块 | 数据源（主存储 / 导出） | 说明 |
|---|------|------------------------|------|
| M1 | **书籍管理** | `books` + `progress` / `book.json`, `progress.json` | 多本书列表 + CRUD |
| M2 | **创作工作台** | 全部 | 四面板布局 + 命令面板，对标 TUI 全部面板 |
| M3 | **创作控制** | host lifecycle | 开始/暂停/停止/干预/恢复 |
| M4 | **大纲管理** | `outline_entries` + `volumes` + `arcs` + `arc_chapters` + `compass` / `outline.json`, `compass.json` | 卷-弧-章树 + 指南针 |
| M5 | **章节管理** | `chapters` + `drafts` + `chapter_plans` / `chapters/*.md`, `drafts/*.plan.json` | Markdown 编辑器 + 元数据 |
| M6 | **角色管理** | `characters_t` + `cast_entries` + `character_snapshots` / `characters.json`, `cast_ledger.json` | 角色卡片 + 配角名册 |
| M7 | **时间线管理** | `timeline_events` + `foreshadow_entries` + `relationship_entries` + `state_changes` / `timeline.json`, `foreshadow_ledger.json`, `relationship_state.json`, `state_changes.json` | 事件线 + 伏笔 + 关系 |
| M8 | **评审管理** | `reviews` / `reviews/*.json` | 七维雷达图 + 问题清单 |
| M9 | **模型管理** | `config` (providers/roles) | Provider + 角色模型分配 |
| M10 | **系统设置** | `config` (全局) | 工作目录 / 主题 / 语言 |
| M11 | **用户规则** | `user_rules` / `user_rules.json` | 规则查看/编辑/检查 |
| M12 | **诊断报告** | diag engine | 四维度发现 + 建议导出 |
| M13 | **仿写画像** | `simulation_profiles` / `simulation_profile.json` | 风格分析可视化 |
| M14 | **导出管理** | exp engine | TXT/EPUB 导出面板 |

### 数据存储

**双层模型**：SQLite 为主存储，JSON 文件为 CLI 兼容导出。

- **主存储（SQLite）**：所有元数据写入 `~/.ainovel-gui/ainovel.db`（`better-sqlite3`，WAL 模式 + 外键约束）。
  Schema 定义见 `electron/database.ts`，表包括：`books`, `progress`, `outline_entries`, `volumes`, `arcs`, `arc_chapters`, `compass`, `chapters`, `drafts`, `chapter_plans`, `summaries`, `characters_t`, `character_snapshots`, `cast_entries`, `timeline_events`, `foreshadow_entries`, `relationship_entries`, `state_changes`, `world_rules`, `style_rules`, `reviews`, `run_meta`, `usage_stats`, `user_rules`, `simulation_profiles`, `user_directives`, `config`, `_meta`。
  GUI 写入时**先写 SQLite**，必要时再同步导出到 JSON。

- **导出 / 备份（JSON + Markdown）**：每本书可选导出到 `~/.ainovel-gui/books/{book-uuid}/`，
  数据格式与 [ainovel-cli](https://github.com/crazytreeChen/ainovel-cli) 完全兼容，可直接互换使用。
  此目录主要用途：CLI 互通、人工备份、跨工具迁移。

```
~/.ainovel-gui/
├── ainovel.db            # SQLite 主存储（GUI 写入）
├── config.json           # 兼容 ainovel-cli 风格的导出（与 config 表互相同步）
└── books/                # 导出 / 备份目录（CLI 兼容格式）
    └── {book-uuid}/
        ├── book.json             # 书籍元信息
        ├── premise.md            # 故事前提
        ├── outline.json          # 扁平大纲
        ├── layered_outline.json  # 分层大纲
        ├── compass.json          # 指南针
        ├── progress.json         # 进度状态
        ├── characters.json       # 角色档案
        ├── cast_ledger.json      # 配角名册
        ├── timeline.json         # 时间线
        ├── foreshadow_ledger.json # 伏笔台账
        ├── relationship_state.json # 关系
        ├── state_changes.json    # 状态变化
        ├── world_rules.json      # 世界观
        ├── style_rules.json      # 风格规则
        ├── run.json              # 运行元信息
        ├── usage.json            # 用量统计
        ├── user_rules.json       # 用户规则快照
        ├── simulation_profile.json # 仿写画像
        ├── checkpoints.jsonl     # checkpoint
        ├── chapters/*.md         # 章节终稿
        ├── drafts/*.{md,json}    # 草稿 + 计划
        ├── summaries/*.json      # 摘要
        ├── reviews/*.json        # 评审
        └── meta/                 # 内部数据
```

数据格式与 ainovel-cli 完全兼容（JSON + Markdown），可直接互换使用。

### Conventions

- Default branch: `master`.
- README, comments, commit messages in 中文; new code identifiers stay in English.
- `AGENTS.md` and `CLAUDE.md` in the repo root are the project's AI agent contract.
- React 组件使用函数组件 + Hooks，样式使用 CSS class（非 CSS-in-JS）。
- **模块实现顺序**：按 P0→P1→...→P7 顺序实施，每完成一个模块更新一次知识库。

### 版本管理

- 每次功能更新后必须同步更新 `package.json` 和 `download.json` 中的版本号。
- 版本号遵循 `主版本.次版本.修订号`（语义化版本）：
  - **主版本号**：重大架构变更、不兼容的 API 变更、全新大模块上线
  - **次版本号**：新增功能模块、新增页面、重要 UI 重构
  - **修订号**：Bug 修复、文案调整、小优化
- 发布 Release 时，tag 格式为 `v{版本号}`（如 `v0.2.0`）。
- `download.json` 中的 `release_notes` 需同步更新为本版本的变更摘要。

---

## 知识资产保存（Knowledge Base / Obsidian）

所有技术笔记、项目文档、经验日志等**知识资产统一写入 Obsidian vault**，路径：

```
/Users/qinglinchen/01-Code/98-Custom/obsdian/
```

**核心规则**：
- **代码文档**（README、AGENTS、CLAUDE、API doc）留在项目仓库内
- **知识笔记**（概念卡片、踩坑记录、问题排查、日报周报月报）全部写入 Obsidian vault
- 禁止在项目仓库中散落 `.md` 知识笔记（`CLAUDE.md` / `AGENTS.md` / 子模块 README 除外）

### Vault 目录映射

| 目录 | 写入内容 |
|------|----------|
| `01-技术学习/概念卡片/` | 技术概念卡片 |
| `01-技术学习/问题排查/` | Bug 排查、环境问题 |
| `02-工作项目/进行中/ainovel-gui/` | 项目主文档、子模块索引、经验日志、版本记录 |
| `02-工作项目/进行中/ainovel-gui/子模块/` | **每个子模块/子包的独立笔记**（架构、数据流、设计决策） |
| `10-工作记录/YYYY/第WW周/` | 日报 (`MM-DD.md`)、周报 (`周报.md`) |
| `10-工作记录/YYYY/MM月/` | 月报 (`月报.md`) |

### 子模块索引机制

每个子模块在 `子模块/` 目录下有独立 `.md` 笔记，`MOC-模块索引.md` 汇总所有模块的链接。

### 模块 ↔ 笔记名对照

| 模块/包 | 知识库笔记路径 |
|---------|--------------|
| 全局主文档 | `ainovel-gui.md` |
| 模块索引 | `MOC-模块索引.md` |
| 数据模型 | `子模块/数据模型.md` |
| 存储层 | `子模块/存储层.md` |
| Agent系统 | `子模块/Agent系统.md` |
| host运行时 | `子模块/host运行时.md` |
| 配置引导 | `子模块/配置引导.md` |
| 数据文件映射 | `子模块/数据文件映射.md` |
| M1 书籍管理 | `子模块/书籍管理.md` |
| M2 创作工作台 | `子模块/创作工作台.md` |
| M3 创作控制 | `子模块/创作控制.md` |
| M4 大纲管理 | `子模块/大纲管理.md` |
| M5 章节管理 | `子模块/章节管理.md` |
| M6 角色管理 | `子模块/角色管理.md` |
| M7 时间线管理 | `子模块/时间线管理.md` |
| M8 评审管理 | `子模块/评审管理.md` |
| M9 模型管理 | `子模块/模型管理.md` |
| M10 系统设置 | `子模块/系统设置.md` |
| M11 用户规则 | `子模块/用户规则.md` |
| M12 诊断报告 | `子模块/诊断报告.md` |
| M13 仿写画像 | `子模块/仿写画像.md` |
| M14 导出管理 | `子模块/导出管理.md` |

---

## 任务分流与流程选择

### 三类任务

| 类型 | 范围 | 默认流程 |
|------|------|----------|
| **轻量** | 单文件或小范围修改、明确 bug 修复、配置/文案调整、小测试补充、局部文档 | 跳过 brainstorming / writing-plans / review 链，直接实现+定向验证 |
| **中型** | 跨 2-4 文件、新功能、行为变更、重构 | `brainstorming → writing-plans → implementation → verification` |
| **重型** | 跨模块、涉及公共 API/schema/持久化/并发、需求模糊、影响面大 | 完整 Superpowers 流程 + review + 完整验证 |

### 流程升降级

- **升级触发**：影响边界超预期、涉及共享接口/数据/持久化/并发、需求不清晰、验证覆盖不足、任务演变为中大型重构
- **降级触发**：改动局部且边界清晰、不涉及共享核心逻辑、问题已收敛为单点修复、补长计划/测试的成本高于收益
- **总原则**：满足质量要求的最短路径；能走轻量不走重流程

---

## 执行与验证纪律

### 推进规则

1. 需求模糊时先澄清目标、约束、验收标准与边界条件
2. 多步任务维护可见任务列表，任意时刻仅保留一个 `in_progress`
3. 先缩小边界再扩展范围，优先局部修改与最小充分实现
4. 若复杂度上升及时升级流程，若已收敛及时降级
5. 遇到新信息应主动修正之前的判断

### 验证规则

- 不得虚构已运行命令、退出码或验证结果
- 关键验证无法执行时必须明确说明原因
- 没有验证证据不得声称"通过""完成""可提交""可合并"

### 授权边界

- **可默认执行**：当前分支内与任务直接相关的应用代码、测试、局部文档，可新增少量配套文件
- **必须确认**：删除文件、大规模重构、shared contract / schema / shared types、根配置 / CI / 依赖 / 环境模板、数据库 / 持久化变更、git 历史与远程操作、基础设施改动

---

## 质量门禁

### 交付前检查（Change Delivery Gate）

在声明完成、准备 commit/push/PR 之前必须满足：

1. 已完成与本次改动直接相关的验证，并如实报告结果
2. 已完成对应质量门禁
3. 若仓库要求更重验证则优先遵循仓库规则
4. 若关键验证无法执行则明确说明原因并降低完成度表述

### 项目特定质量要求

- Electron 主进程改动需同时验证：开发模式启动 → 窗口正常显示 → IPC 通信正常
- React 组件改动需确保 `npm run typecheck` 通过
- CSS 改动需在不同窗口尺寸下验证布局

---

## 代码规范

### 硬性上限

函数 ≤ 50 行、文件 ≤ 300 行、嵌套 ≤ 3、位置参数 ≤ 3、圈复杂度 ≤ 10、禁止魔法数字。

### 编码原则

遵循 SOLID、DRY、关注点分离、YAGNI；命名清晰，边界条件显式处理；优先局部修改与最小充分实现。

### Bug 修复

真实 bug 默认优先 `systematic-debugging`，先确认根因再修复。

### Commit 规范

格式 `<type>(scope): <summary>`，summary 中文动词开头、≤ 50 字、不加句号；常用 type：`feat` / `fix` / `refactor` / `docs` / `test` / `chore`，scope 可选。

---

## 沟通与输出

### 沟通风格

- 默认简体中文，可混用英文技术术语；代码标识符英文；注释优先中文
- 回答时优先给结论，再补背景、依据与权衡

### 输出模式

| 模式 | 场景 | 结构 |
|------|------|------|
| **执行进度式** | 代码修改、重构、bug 修复、多步任务 | 任务 → 执行计划(已/当前/待) → 当前进度 → 风险/阻塞 → 参考 |
| **分析回答式** | 问答、代码解释、方案对比、架构分析 | 结论 → 关键分析 → 深入剖析(可选) → 风险与权衡(可选) |

---

## 安全规则

- 不运行破坏性命令（如 `git reset`），除非用户明确要求
- 不操作用户未授权的危险删除，临时产物例外
- 不将密钥、凭证、API Key 硬编码进源码
- 不拼接不可信输入到 shell/SQL
- 除非用户明确要求，不终止非当前任务启动的进程
- **特别注意**：Electron 子进程 spawn 时必须验证二进制路径安全，避免命令注入

---

> **模板版本**：v2.1 | **最后更新**：2026-07-02 | 架构说明：补充 SQLite 主存储与 JSON 导出双层模型
