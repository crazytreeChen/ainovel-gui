# CLAUDE.md — ainovel-gui

> 本文件是 AI 代理的项目级配置文件，提供项目速览和常用命令。
> 详细的项目规范、约束条件和知识库位置请阅读 `AGENTS.md`。

## 项目定位

ainovel-gui 是 **独立桌面创作管理平台**，不是 CLI 的 GUI 外壳。
- 数据由 GUI 直接管理（JSON 文件，与 ainovel-cli 完全兼容）
- `ainovel-cli` 仅作为 **AI 推理引擎** 被 GUI 调度
- 支持多本书并行管理、章节/大纲/角色/时间线完整 CRUD

## 技术栈

- **语言**: TypeScript
- **运行时**: Electron 41 + Node.js
- **前端框架**: React 18
- **构建工具**: Vite 8 + tsc
- **包管理**: npm
- **状态管理**: Zustand 4
- **图标库**: Lucide React
- **路由**: React Router v7
- **样式**: 纯 CSS（暖调书卷色板）
- **图表**: Recharts（评分雷达图、趋势图）
- **打包**: electron-builder (DMG / NSIS)

## 项目文件结构

```
ainovel-gui/
├── electron/              # Electron 主进程
│   ├── main.ts            # 窗口管理、IPC、子进程调度、文件系统集成
│   └── preload.ts         # contextBridge 安全 API
├── src/
│   ├── main.tsx           # React 入口
│   ├── App.css            # 全局样式
│   ├── components/        # UI 组件
│   ├── hooks/             # 自定义 Hooks
│   ├── lib/               # 工具函数
│   │   ├── store/         # 数据持久化层（JSON 文件存储）
│   │   ├── models/        # 领域模型
│   │   └── ipc.ts         # IPC 调用封装
│   ├── pages/             # 路由页面
│   ├── stores/            # Zustand 状态管理
│   └── types/             # 类型定义
├── build/                 # 构建资源（图标等）
├── index.html
├── vite.config.ts
└── package.json
```

## 常用命令

```bash
# 安装依赖
npm install

# 开发模式启动（Vite + Electron 并行）
npm run electron:dev

# 仅前端开发（浏览器环境）
npm run dev

# 类型检查
npm run typecheck

# 生产构建
npm run build

# 构建 macOS DMG
npm run dist:mac

# 构建 Windows NSIS
npm run dist:win

# 预览生产构建
npm run preview

# CI/CD（本地只 bump + tag + push，CI 自动构建发布）
npm run cicd              # 自动 bump → commit → tag → push
npm run cicd:patch        # 强制 patch bump
npm run cicd:minor        # 强制 minor bump
npm run cicd:dry          # 干跑预览
```

## 架构要点

1. **独立数据平台**：GUI 直接管理全部数据（JSON 文件），不依赖 CLI 解析
2. **引擎调用层**：`ainovel-cli --headless` 仅作为 AI 推理引擎，被 GUI 调度
3. **多书管理**：支持同时管理多本书，数据隔离在 `~/.ainovel-gui/books/{uuid}/`
4. **兼容模式**：可直接打开 ainovel-cli 的 `output/{novel}/` 目录作为一本书
5. **14 个功能模块**：书籍管理 / 创作工作台 / 创作控制 / 大纲管理 / 章节管理 / 角色管理 / 时间线管理 / 评审管理 / 模型管理 / 系统设置 / 用户规则 / 诊断报告 / 仿写画像 / 导出

## 注意事项

- 开发前确保安装了 `ainovel-cli` 命令行工具（非必需，仅运行 AI 引擎时需要）
- Electron 主进程改动后需要完全重启 Electron
- 渲染进程的 `window.electronAPI` 在浏览器环境不可用，需要条件判断
- 详细规范见 `AGENTS.md`

---

> 模板版本：v2.0 | 更新：2026-07-01 | 架构变更：CLI 包装器 → 独立数据平台
