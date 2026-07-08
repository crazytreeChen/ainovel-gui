---
name: project-status-assessment
description: >
  快速评估 ainovel-gui 项目当前状态：扫描项目结构、关键文件、git 历史、
  知识库同步状态，输出结构化状态报告。适用于"分析项目""项目现状""当前进度"等场景。
  触发词：分析项目、项目状态、当前进度、项目现状、项目概况、status assessment。
user_invocable: true
argument_hint: "[可选：聚焦模块名，如 M5 或 chapters]"
---

# Project Status Assessment

快速评估 ainovel-gui 项目当前状态，输出结构化报告。

## Workflow

### Step 1: 项目基础信息

读取以下文件获取项目概况：
- `package.json` — 版本号、依赖、脚本
- `README.md` — 项目说明
- `AGENTS.md` — 项目约束和规范

### Step 2: 代码结构扫描

并行扫描：
- `src/` 目录结构（组件、页面、stores、hooks、types）
- `electron/` 目录结构（主进程、IPC、数据库）
- `scripts/` 目录（构建/发布脚本）
- `.github/workflows/`（CI/CD 配置）

### Step 3: 模块实现进度

根据 AGENTS.md 中的 14 个功能模块列表（M1-M14），逐个检查：
- 对应页面文件是否存在（`src/pages/XxxPage.tsx`）
- 对应 IPC handler 是否注册（`electron/ipc/*.ts`）
- 对应数据库表是否定义（`electron/database.ts`）

输出每个模块的状态：✅ 已完成 / 🔄 进行中 / ⬜ 未开始

### Step 4: Git 状态

```bash
git log --oneline -10    # 最近提交
git status               # 工作区状态
git diff --stat          # 未提交变更
```

### Step 5: 知识库同步状态

检查 Obsidian 知识库是否与代码同步：
- 读取 `/Users/qinglinchen/01-Code/98-Custom/obsdian/02-工作项目/进行中/ainovel-gui/` 目录
- 对比版本号是否与 `package.json` 一致
- 检查子模块笔记是否覆盖所有已实现模块

### Step 6: 输出报告

按以下格式输出：

```
## 项目状态报告 — ainovel-gui v{版本}

### 基础信息
- 版本：x.y.z
- 技术栈：Electron XX + Vite X + React 18 + TypeScript
- 最近提交：{commit msg}

### 模块进度（14 模块）
| 模块 | 状态 | 说明 |
|------|------|------|
| M1 书籍管理 | ✅ | ... |
| ... | ... | ... |

### 工作区状态
- 未提交变更：{N} 个文件
- 关键变更：{摘要}

### 知识库同步
- 版本一致性：✅/❌
- 子模块覆盖率：{N}/14

### 风险/待办
- {如有}
```

## Notes

- 本 skill 面向 ainovel-gui 项目，模块列表和目录结构硬编码自 AGENTS.md
- 如果用户指定了聚焦模块（如 "M5"），跳过全量扫描，只深入该模块
- 不执行任何修改操作，纯只读分析
