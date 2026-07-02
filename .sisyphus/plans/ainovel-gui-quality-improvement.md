# ainovel-gui 项目质量全面改进计划

## TL;DR

> **Quick Summary**: 对 ainovel-gui 项目进行 8 个阶段的全方位质量改进，覆盖安全修复、类型安全、代码质量、架构重构、样式迁移、构建优化和依赖升级，从零测试覆盖到可维护的生产级代码。
>
> **Deliverables**:
> - 9+ 个安全漏洞修复（命令注入、路径遍历、SIGKILL、SSRF等）
> - electron/ 目录完整类型安全（移除 @ts-nocheck，启用 strict）
> - Zustand store 按领域拆分 + 共享组件/hooks 提取
> - Vitest 测试框架 + ESLint 配置 + GitHub Actions CI
> - 超限文件拆分（5个）+ 内联样式迁移至 CSS 类
> - 构建优化（chunk splitting）+ 依赖增量升级
>
> **Estimated Effort**: Extra Large (8 phases, ~50 tasks)
> **Parallel Execution**: YES — 7 waves within each phase
> **Critical Path**: Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

---

## Context

### Original Request
用户要求对 ainovel-gui 项目进行全面质量分析后，将所有发现的改进项纳入一个完整的工作计划。分析覆盖了 6 个维度（安全、类型安全、代码质量、架构、测试、构建），识别出 22+ 个改进项。

### Interview Summary
**Key Discussions**:
- **分析方式**: 5 个并行后台代理 + 手检，覆盖全部代码路径
- **发现**: P0 安全漏洞 5+ 项、P1 类型/架构问题 8 项、P2 测试/工具 5 项、P3 构建/依赖 4 项
- **策略**: 用户选择"全部纳入一个计划"

**Research Findings**:
- TypeScript 类型检查通过（0 errors），但 electron/ 目录完全关闭了检查
- 零测试覆盖率，无 CI/CD，ESLint 安装但未配置
- `.npmrc` 有 `omit=dev` 会打断新开发者克隆
- AGENTS.md 描述 JSON 文件存储，但实际使用 SQLite
- 775 处内联样式 + 5 个文件超 300 行限制

### Metis Review
**Identified Gaps** (addressed):
- **执行顺序**: P0-P3 是优先级标签，不是实施顺序。必须按依赖关系排序：安全→类型→质量→架构→样式→构建→依赖
- **额外安全问题**: `set-directory`、`download-update`、`install-update`、`scan-workspace`、`import-workspace` 也存在路径/SSRF 风险
- **AGENTS.md 过时**: 描述 JSON 存储但代码用 SQLite — 必须先更新文档
- **`.npmrc` 修复方式**: 不应删除 `omit=dev`，应将其作用域限制在 `npm run dist:*` 脚本
- **依赖升级风险**: Electron 12 个大版本跳跃需要增量升级 + 全量验证
- **Store 拆分前提**: 需要先用 `lsp_find_references` 映射所有消费者

---

## Work Objectives

### Core Objective
将 ainovel-gui 从"功能可用但技术债严重"的状态提升到"安全、类型安全、可测试、可维护"的生产级质量水平。

### Concrete Deliverables
- 主进程所有 IPC handler 无命令注入/路径遍历/SSRF 风险
- `electron/` 目录 `@ts-nocheck` 清零，`strict: true` 启用
- `npx vitest run` 通过（至少覆盖核心模块）
- `npx eslint src/ electron/ --max-warnings 0` 通过
- `find src/ -name "*.tsx" | xargs wc -l | awk '$1 > 300'` 返回空
- `grep -r "style={{" src/ | wc -l` 减少 50%+
- GitHub Actions CI 自动运行 lint + typecheck + test + build

### Definition of Done
- [ ] 所有 9+ 个安全漏洞已修复并验证
- [ ] `npx tsc --noEmit -p electron/tsconfig.json` 退出码 0
- [ ] `npm test` 通过（≥10 个测试用例）
- [ ] `npm run build` 成功生成多 chunk 产物
- [ ] `npm run electron:dev` 启动正常，核心流程可用

### Must Have
- 命令注入修复（`execSync` → `execFile`/`spawn`）
- SIGKILL 兜底
- 路径校验工具 + 应用到全部 8 个 IPC handler
- `@ts-nocheck` 移除
- Vitest 框架 + 首个测试
- GitHub Actions CI（lint + typecheck + test + build）
- Zustand store 拆分
- 超限文件拆分
- `.npmrc` 作用域修复

### Must NOT Have (Guardrails)
- **不删除** `.npmrc` 的 `omit=dev` — 只将其作用域限制到 dist 脚本
- **不在** 安全修复中同时重构代码 — 安全修复 = 最小改动
- **不引入** 新的 CSS 架构（如 Tailwind、CSS-in-JS） — 只迁移到现有 `App.css`
- **不批量** 升级依赖 — Electron/Vite 增量升级，每次最多 2-3 大版本
- **不写** 全面测试套件 — 只覆盖被重构的模块
- **不使用** `any` 修复类型错误 — 用 `unknown` + type guard
- **不改变** 运行时行为 — 重构 = 保持功能不变
- **不引入** 新功能 — 只修复和改进现有代码

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — 所有验证由代理执行

### Test Decision
- **Infrastructure exists**: NO（需新建）
- **Automated tests**: YES（TDD 方式，随重构建立）
- **Framework**: Vitest（Vite 原生，零配置，TypeScript 优先）
- **TDD**: 重构前先写 characterization test（捕获当前行为），确保重构不改变行为

### QA Policy
每个任务包含代理执行的 QA 场景，保存证据至 `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`。

- **CLI/Bash 验证**: `grep`、`npx tsc`、`npx vitest`、`npx eslint`、`npm run build`
- **应用验证**: `npm run electron:dev` → 创建书籍 → 开始写作 → 验证快照更新
- **安全验证**: `grep -r` 搜索危险模式，确认修复后无可利用路径

---

## Execution Strategy

### Parallel Execution Waves

> 8 个阶段，每个阶段内部最大化并行。阶段间串行（上一阶段完成才能开始下一阶段）。

**Phase 0: 前置准备**
```
Wave 0 (并行，无依赖):
├── Task 1: 修复 .npmrc（omit=dev 作用域限制） [quick]
├── Task 2: 更新 .gitignore [quick]
└── Task 3: 更新 AGENTS.md（JSON→SQLite 架构） [quick]
```

**Phase 1: 安全修复**
```
Wave 1 (并行，无依赖):
├── Task 4: 创建路径校验工具 [quick]
├── Task 5: 修复命令注入（execSync→execFile） [quick]
├── Task 6: 添加 SIGKILL 兜底 [quick]
├── Task 7: 修复 shell.openPath 路径校验 [quick]
└── Task 8: execSync 长阻塞改 spawn（diag/simulate/export） [quick]

Wave 2 (并行，依赖 Task 4):
├── Task 9: download-update URL 白名单校验 [quick]
├── Task 10: set-directory/scan-workspace/import-workspace 路径校验 [quick]
├── Task 11: install-update 文件校验 [quick]
└── Task 12: 移除 dead execSync import（books.ts） [quick]
```

**Phase 2: 类型安全**
```
Wave 3 (按文件串行，逐个移除 @ts-nocheck):
├── Task 13: electron/preload.ts 类型化 [quick]
├── Task 14: electron/logger.ts @ts-nocheck 移除 [quick]
├── Task 15: electron/context.ts @ts-nocheck 移除 [quick]
├── Task 16: electron/ipc/books.ts @ts-nocheck 移除 [quick]
├── Task 17: electron/ipc/workspace.ts @ts-nocheck 移除 [quick]
├── Task 18: electron/ipc/writing.ts @ts-nocheck 移除 [deep]
├── Task 19: electron/ipc/system.ts @ts-nocheck 移除 [deep]
├── Task 20: electron/main.ts @ts-nocheck 移除 [quick]
└── Task 21: electron/database.ts @ts-nocheck 移除 [deep]

Wave 4 (并行，依赖 Wave 3 全部):
├── Task 22: electron/tsconfig.json strict:true 启用 [quick]
└── Task 23: src/ 中 11 处 as any 修复 [quick]
```

**Phase 3: 代码质量基础**
```
Wave 5 (并行，无互相依赖):
├── Task 24: 设置 ESLint（@typescript-eslint + react 预设） [quick]
├── Task 25: 设置 Vitest 框架 + 首个测试 [quick]
├── Task 26: 修复 phaseLabel 分歧（统一到 types/index.ts） [quick]
├── Task 27: 移除 5 处 console.log [quick]
├── Task 28: 修复可变列表的 key={i} 反模式 [quick]
├── Task 29: 统一版本号（单一声源 import.meta.env） [quick]
└── Task 30: 为 store/IO/IPC 核心模块写 characterization test [deep]
```

**Phase 4: 架构重构**
```
Wave 6 (先映射，再拆分 — 有依赖):
├── Task 31: lsp_find_references 映射 store 消费者矩阵 [deep]
├── Task 32: 拆分 useAppStore → useUIStore + useDomainStore [deep]
└── Task 33: 拆分 useAppStore → useBookStore + useWritingStore [deep]

Wave 7 (并行，依赖 Wave 6):
├── Task 34: 提取 useBookId() hook [quick]
├── Task 35: 提取 useBookData<T>() hook [quick]
├── Task 36: 提取 <BookPage> 布局组件 [visual-engineering]
└── Task 37: 抽出 RelationGraph 力导向算法为纯函数 [deep]
```

**Phase 5: 超限文件拆分**
```
Wave 8 (并行，每文件独立):
├── Task 38: 拆分 CharactersPage.tsx (643→≤300) [deep]
├── Task 39: 拆分 UserRulesPage.tsx (466→≤300) [deep]
├── Task 40: 拆分 BookList.tsx (366→≤300) [deep]
├── Task 41: 拆分 SimulationPage.tsx (365→≤300) [deep]
└── Task 42: 拆分 ModelsPage.tsx (313→≤300) [deep]
```

**Phase 6: 样式迁移**
```
Wave 9 (并行，分文件):
├── Task 43: 添加高频 CSS 类 (.input, .badge-*, .truncate-2) [visual-engineering]
├── Task 44: 迁移 CharactersPage 内联样式 [visual-engineering]
├── Task 45: 迁移 UserRulesPage 内联样式 [visual-engineering]
├── Task 46: 迁移 BookList/SimulationPage 内联样式 [visual-engineering]
└── Task 47: 迁移其余文件内联样式（批量） [visual-engineering]
```

**Phase 7: 构建优化**
```
Wave 10 (并行，无依赖):
├── Task 48: Vite manualChunks 配置 [quick]
└── Task 49: 版本号同步脚本（package.json ↔ download.json ↔ TopBar） [quick]
```

**Phase 8: CI/CD**
```
Wave 11 (依赖之前全部 Phase):
├── Task 50: GitHub Actions workflow（lint + typecheck + test + build） [quick]
```

**Phase 9: 依赖升级（LAST — 最高风险）**
```
Wave 12 (增量串行，每步验证):
├── Task 51: 升级 Vite 5→6→7→8（增量） + 验证 [deep]
├── Task 52: 升级 lucide-react 0→1 主版本 [deep]
└── Task 53: 升级 Electron 31→43（增量，每 2-3 版本） [deep]
```

### Agent Dispatch Summary

- **Phase 0**: 3 × `quick`
- **Phase 1**: 5 × `quick` + 4 × `quick`
- **Phase 2**: 6 × `quick` + 3 × `deep` + 2 × `quick`
- **Phase 3**: 6 × `quick` + 1 × `deep`
- **Phase 4**: 3 × `deep` + 2 × `quick` + 1 × `visual-engineering` + 1 × `deep`
- **Phase 5**: 5 × `deep`
- **Phase 6**: 5 × `visual-engineering`
- **Phase 7**: 2 × `quick`
- **Phase 8**: 1 × `quick`
- **Phase 9**: 3 × `deep`
- **FINAL**: 4 × parallel review

---

## TODOs

### Phase 0: 前置准备

- [ ] 1. 修复 .npmrc（omit=dev 作用域限制）

  **What to do**:
  - 当前 `.npmrc` 内容为 `omit=dev`，影响所有 `npm install`（包括开发环境）
  - 保留 `omit=dev` 但将其作用域限制到 `dist:*` 脚本：
    - 删除 `.npmrc` 文件
    - 在 `package.json` 的 `dist:mac`、`dist:win`、`dist:linux`、`build:optimized` 脚本中使用 `--omit=dev` 参数
    - 或者在 `scripts/clean-node-modules.js` 中确认已经处理了 dev 依赖清理
  - **Must NOT do**: 直接删除 `.npmrc` 而不在 dist 脚本中保留优化

  **Recommended Agent Profile**: `quick`
  - 单文件修改，无复杂逻辑

  **Parallelization**: Wave 0，可与 Task 2-3 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `.npmrc` — 当前内容
  - `package.json:14-25` — dist 脚本定义
  - `scripts/clean-node-modules.js` — 已有的打包优化

  **Acceptance Criteria**:
  - [ ] `npm install`（无额外参数）完整安装 devDependencies
  - [ ] `npm run dist:mac` 使用 `--omit=dev` 或调用 clean-node-modules
  - [ ] 新开发者 `git clone` + `npm install` + `npm run dev` 能成功运行

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 新克隆项目可正常安装和开发
    Tool: Bash
    Steps:
      1. rm -rf node_modules
      2. npm install（不加 --production/--omit=dev）
      3. node -e "require('vite')"  # 验证 vite 已安装
      4. node -e "require('electron')"  # 验证 electron 已安装
    Expected Result: 两个 require 都成功，无错误
    Evidence: .sisyphus/evidence/task-1-npmrc-fix.txt
  ```

  **Commit**: YES
  - Message: `fix(build): 将 omit=dev 限制到构建脚本，避免影响开发安装`
  - Files: `.npmrc`, `package.json`

- [ ] 2. 更新 .gitignore

  **What to do**:
  - 添加缺失的忽略模式：`.env`, `.env.local`, `coverage/`, `.idea/`, `.vscode/`, `*.tsbuildinfo`, `Thumbs.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`
  - **Must NOT do**: 忽略 `package-lock.json`（应被追踪）

  **Recommended Agent Profile**: `quick`
  - 单文件修改

  **Parallelization**: Wave 0，可与 Task 1、3 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `.gitignore` — 当前 11 行

  **Acceptance Criteria**:
  - [ ] `.gitignore` 包含 `coverage/`, `.env`, `.idea/`, `*.db-journal` 等条目

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 验证 gitignore 覆盖新增模式
    Tool: Bash
    Steps:
      1. echo "test" > .env && git status --porcelain .env
      2. echo "test" > coverage/test.json && git status --porcelain coverage/
      3. 清理: rm -f .env && rm -rf coverage/
    Expected Result: git status 不显示这些文件（已被忽略）
    Evidence: .sisyphus/evidence/task-2-gitignore.txt
  ```

  **Commit**: YES
  - Message: `chore: 完善 .gitignore（添加 .env, coverage/, IDE 配置等）`
  - Files: `.gitignore`

- [ ] 3. 更新 AGENTS.md（JSON→SQLite 架构）

  **What to do**:
  - AGENTS.md 描述数据存储为 `~/.ainovel-gui/books/{uuid}/*.json`
  - 实际实现使用 SQLite（`better-sqlite3` via `electron/database.ts`）
  - 更新数据存储章节反映真实架构：SQLite 为主存储，JSON 文件为 CLI 兼容导出
  - **Must NOT do**: 删除 JSON 兼容性描述（ainovel-cli 仍需要 JSON）

  **Recommended Agent Profile**: `quick`
  - 文档修改

  **Parallelization**: Wave 0，可与 Task 1-2 并行
  - **Blocks**: 所有后续数据层相关任务
  - **Blocked By**: 无

  **References**:
  - `AGENTS.md` — 数据存储章节
  - `electron/database.ts:6-129` — SQLite schema

  **Acceptance Criteria**:
  - [ ] AGENTS.md 数据存储章节反映 SQLite 主存储 + JSON 兼容导出
  - [ ] 架构图与 README.md 一致

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 验证 AGENTS.md 更新内容
    Tool: Bash
    Steps:
      1. grep -i "sqlite" AGENTS.md
      2. grep -i "better-sqlite3" AGENTS.md
    Expected Result: 两者都找到，描述 SQLite 为主存储层
    Evidence: .sisyphus/evidence/task-3-agents-update.txt
  ```

  **Commit**: YES
  - Message: `docs: 更新 AGENTS.md 数据架构描述（JSON→SQLite）`
  - Files: `AGENTS.md`

### Phase 1: 安全修复

- [ ] 4. 创建路径校验工具

  **What to do**:
  - 在 `electron/` 中创建 `path-validator.ts`，导出 `validatePath(input: string): string` 函数
  - 校验规则：路径必须在以下白名单中：
    - `~/.ainovel-gui/`（应用数据目录）
    - `state.outputDir`（用户选择的工作目录）
    - 用户通过 `dialog.showOpenDialog` 选择的目录
  - 返回规范化路径或抛出错误
  - **Must NOT do**: 使用正则表达式做路径校验（不安全，应用 `path.resolve` + 前缀检查）

  **Recommended Agent Profile**: `quick`
  - 工具函数，逻辑集中

  **Parallelization**: Wave 1，与 Task 5-8 并行
  - **Blocks**: Task 7, 9, 10, 11
  - **Blocked By**: 无

  **References**:
  - `electron/context.ts:29-31` — GUI_DATA_DIR 定义
  - `electron/context.ts:16-26` — state.outputDir 定义
  - `electron/ipc/system.ts:19-25` — dialog.showOpenDialog 模式

  **Acceptance Criteria**:
  - [ ] `validatePath('/etc/passwd')` 抛出错误
  - [ ] `validatePath(GUI_DATA_DIR + '/books/test')` 返回规范化路径
  - [ ] `validatePath(state.outputDir + '/chapters')` 返回规范化路径

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 路径校验阻止越权访问
    Tool: Bash
    Steps:
      1. node -e "
         const { validatePath } = require('./dist-electron/path-validator');
         try { validatePath('/etc/passwd'); console.log('FAIL: no error'); }
         catch(e) { console.log('PASS: ' + e.message); }
         "
    Expected Result: 输出 "PASS: ..."
    Evidence: .sisyphus/evidence/task-4-path-validator.txt

  Scenario: 路径校验允许合法路径
    Tool: Bash
    Steps:
      1. node -e "
         const { validatePath } = require('./dist-electron/path-validator');
         const result = validatePath(require('./dist-electron/context').GUI_DATA_DIR + '/books/test');
         console.log('PASS:', result);
         "
    Expected Result: 输出 "PASS: /Users/.../.../books/test"
    Evidence: .sisyphus/evidence/task-4-path-validator-allow.txt
  ```

  **Commit**: YES
  - Message: `feat(main): 添加路径校验工具，防止 IPC 路径遍历`
  - Files: `electron/path-validator.ts`

- [ ] 5. 修复命令注入（execSync→execFile/spawn）

  **What to do**:
  - 审计 `electron/` 中所有 `execSync` 调用：
    - `electron/context.ts:61` — `execSync('which ainovel-cli')` → 保留（硬编码命令，无注入风险）
    - `electron/ipc/system.ts:41` — `execSync('"${binary}" --version')` → 改为 `execFileSync(binary, ['--version'])`
    - `electron/ipc/system.ts:50` — `execSync('"${binary}" --headless --diag')` → 改为 `spawn(binary, ['--headless', '--diag'])`（长任务）
    - `electron/ipc/system.ts:65` — `execSync('"${binary}" --headless --prompt "/simulate"')` → 改为 `spawn`
    - `electron/ipc/system.ts:72` — `execSync(\`"${binary}" --headless /export ${args}\`)` → **最危险**，改为 `spawn(binary, ['--headless', '/export', ...args.split(' ')])`
  - **Must NOT do**: 在安全修复的同时重构 IPC handler 结构

  **Recommended Agent Profile**: `quick`
  - 单个文件的 API 替换

  **Parallelization**: Wave 1，与 Task 4、6-8 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `electron/ipc/system.ts:41,50,65,72` — 需要修复的调用
  - `electron/context.ts:61` — 不需要修复的调用

  **Acceptance Criteria**:
  - [ ] `grep "execSync.*\${" electron/` 返回空（无模板字面量注入 execSync）
  - [ ] `run-export` 使用 `spawn` 而非 `execSync`
  - [ ] 初始化/版本检查使用 `execFileSync` 而非 `execSync` 字符串

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 验证命令注入已修复
    Tool: Bash
    Steps:
      1. grep -rn "execSync.*\\\${" electron/ipc/
      2. grep -rn "execSync.*args" electron/ipc/
    Expected Result: 两者都返回空（无模板字面量 + 用户输入的 execSync）
    Evidence: .sisyphus/evidence/task-5-no-injection.txt

  Scenario: 验证 spawn 替代生效
    Tool: Bash
    Steps:
      1. grep -n "spawn\|execFile" electron/ipc/system.ts | head -20
      2. 确认 run-export/run-diag/run-simulate 都使用 spawn
    Expected Result: 至少 3 处 spawn/execFile 调用在 system.ts 中
    Evidence: .sisyphus/evidence/task-5-spawn-usage.txt
  ```

  **Commit**: YES
  - Message: `fix(main): 修复命令注入漏洞（execSync→execFile/spawn）`
  - Files: `electron/ipc/system.ts`, `electron/context.ts`

- [ ] 6. 添加 SIGKILL 兜底

  **What to do**:
  - 修复 `electron/ipc/writing.ts:309-322` 的 `stopAinovelProcess` 函数：
    - 发送 SIGTERM 后，设置 5 秒超时
    - 超时后发送 SIGKILL
    - 等待 `exit` 事件或额外 1 秒后 resolve
    - 确保 `state.ainovelProcess = null` 只在进程确实退出后设置
  - **Must NOT do**: 缩短超时时间（5s SIGTERM 是合理的），只添加兜底

  **Recommended Agent Profile**: `quick`
  - 单函数修改

  **Parallelization**: Wave 1，与 Task 4、5、7、8 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `electron/ipc/writing.ts:309-322` — 当前 stopAinovelProcess 实现

  **Acceptance Criteria**:
  - [ ] `stopAinovelProcess` 超时后发送 SIGKILL
  - [ ] 进程尸体不会残留（`ps aux | grep ainovel-cli` 返回空）

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: SIGTERM 后 SIGKILL 兜底
    Tool: Bash
    Steps:
      1. 阅读 electron/ipc/writing.ts stopAinovelProcess 函数
      2. grep -n "SIGKILL" electron/ipc/writing.ts
      3. 确认: SIGTERM 发送 → setTimeout(5s) → SIGKILL → on('exit') resolve
    Expected Result: 代码包含 SIGKILL 发送逻辑
    Evidence: .sisyphus/evidence/task-6-sigkill.txt
  ```

  **Commit**: YES
  - Message: `fix(main): 添加 SIGKILL 兜底防止子进程残留`
  - Files: `electron/ipc/writing.ts`

- [ ] 7. 修复 IPC 路径校验（应用到所有 handler）

  **What to do**:
  - 将 Task 4 创建的 `validatePath` 应用到以下 IPC handler：
    - `open-directory`（`system.ts:34`）
    - `set-directory`（`system.ts:27`）
    - `save-book-cover`（`system.ts:122` — `imagePath`）
    - `get-book-cover`（`system.ts:133` — 内部路径，风险低但仍需校验）
  - 同时校验 `install-update` 的 `filePath` 必须在下载目录内
  - **Must NOT do**: 影响正常的用户文件选择（dialog.showOpenDialog 选择的路径自动信任）

  **Recommended Agent Profile**: `quick`
  - 在每个 handler 入口添加 validatePath 调用

  **Parallelization**: Wave 2，可与 Task 9-12 并行
  - **Blocks**: 无
  - **Blocked By**: Task 4（需要路径校验工具）

  **References**:
  - `electron/path-validator.ts` — Task 4 创建的校验工具
  - `electron/ipc/system.ts:27,34,122,133,188` — 需要校验的 handler

  **Acceptance Criteria**:
  - [ ] `open-directory('/etc')` 返回错误而非打开系统目录
  - [ ] `set-directory('/tmp/malicious')` 返回错误
  - [ ] `install-update('/tmp/evil.sh')` 返回错误

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 路径校验阻止越权操作
    Tool: Bash
    Steps:
      1. grep -n "validatePath" electron/ipc/system.ts
      2. 确认所有接受路径的 handler 都调用了 validatePath
    Expected Result: 至少 4 处 validatePath 调用（open-dir, set-dir, save-cover, install-update）
    Evidence: .sisyphus/evidence/task-7-validate-path-usage.txt
  ```

  **Commit**: YES
  - Message: `fix(main): 对 IPC handler 路径参数添加安全校验`
  - Files: `electron/ipc/system.ts`, `electron/ipc/books.ts`

- [ ] 8. execSync 长阻塞改 spawn（diag/simulate/export）

  **What to do**:
  - `run-diag`、`run-simulate`、`run-export` 当前使用 `execSync` 阻塞主进程 60-120 秒
  - 改为使用 `spawn`（已在 writing.ts 中有成熟模式）
  - `run-diag`: `spawn(binary, ['--headless', '--diag'])`，收集 stdout 后返回结果
  - `run-simulate`: 同模式，timeout 120s
  - `run-export`: `spawn(binary, ['--headless', '/export', ...args.split(' ')])`，收集输出
  - **Must NOT do**: 同时重构 IPC handler 结构（只改底层调用方式）

  **Recommended Agent Profile**: `quick`
  - 替换调用方式，遵循 writing.ts 已有模式

  **Parallelization**: Wave 1，与 Task 4-7 并行
  - **Blocks**: 无
  - **Blocked By**: 无（可与 Task 5 并行，因为改的是不同 handler）

  **References**:
  - `electron/ipc/writing.ts:14-39` — spawn 模式参考
  - `electron/ipc/system.ts:47-73` — 需要修改的 handler
  - `electron/context.ts:40-79` — getAinovelBinary() 用法

  **Acceptance Criteria**:
  - [ ] `run-diag`/`run-simulate`/`run-export` 使用 `spawn` 而非 `execSync`
  - [ ] 主进程在 diag/simulate/export 执行期间不阻塞（UI 可响应）

  **QA Scenarios (MANDATORY)**:
  ```
  Scenario: 验证异步 spawn 替代 execSync
    Tool: Bash
    Steps:
      1. grep -n "spawn\|execFile" electron/ipc/system.ts
      2. 确认 run-diag, run-simulate, run-export handler 使用 spawn
    Expected Result: 三处都使用 spawn
    Evidence: .sisyphus/evidence/task-8-async-spawn.txt

  Scenario: 验证 execSync 不再用于长时间操作
    Tool: Bash
    Steps:
      1. grep -rn "execSync" electron/ipc/system.ts
      2. 确认 execSync 只用于 check-binary（短操作，~100ms）
    Expected Result: execSync 只在 check-binary handler 出现
    Evidence: .sisyphus/evidence/task-8-no-blocking.txt
  ```

  **Commit**: YES
  - Message: `fix(main): 将 run-diag/simulate/export 从 execSync 改为异步 spawn`
  - Files: `electron/ipc/system.ts`

- [ ] 9. download-update URL 白名单校验

  **What to do**:
  - `electron/ipc/system.ts:149-165` 的 `check-update` handler 从 GitHub API 获取 release 信息
  - `download-update` handler (L167) 接受渲染端传入的 URL 进行下载
  - 添加 URL 白名单校验：只允许从 `https://github.com/crazytreeChen/ainovel-gui/releases/download/` 下载
  - **Must NOT do**: 硬编码 GitHub token；使用公开 API 即可

  **Recommended Agent Profile**: `quick`
  - 单 handler 添加入口校验

  **Parallelization**: Wave 2，可与 Task 7、10-12 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `electron/ipc/system.ts:149-186` — check-update 和 download-update handler
  - `package.json:4` — GitHub repo 名称

  **Acceptance Criteria**:
  - [ ] `download-update` handler 拒绝非 GitHub releases 的 URL
  - [ ] 合法 URL（如 `https://github.com/crazytreeChen/ainovel-gui/releases/download/v0.2.0/...`）被接受

  **QA Scenarios**:
  ```
  Scenario: URL 白名单阻止非 GitHub 下载
    Tool: Bash
    Steps:
      1. grep -n "github.com.*releases.*download" electron/ipc/system.ts
      2. or grep -n "startsWith\|includes\|URL.*parse\|new URL" electron/ipc/system.ts
    Expected Result: download-update handler 包含 URL 域名/前缀校验
    Evidence: .sisyphus/evidence/task-9-url-whitelist.txt
  ```

  **Commit**: YES
  - Message: `fix(main): 添加 download-update URL 白名单校验防止 SSRF`
  - Files: `electron/ipc/system.ts`

- [ ] 10. set-directory/scan-workspace/import-workspace 路径校验

  **What to do**:
  - `set-directory`（`system.ts:27`）：添加 `validatePath(dir)`，只允许在用户文档目录或 GUI_DATA_DIR 下创建
  - `scan-workspace`（`books.ts:67`）：添加 `validatePath(dir)`，只允许扫描白名单目录
  - `import-workspace`（`books.ts:90`）：添加 `validatePath(dir)`，只允许导入白名单目录
  - `get-book-dir`（`books.ts:45`）：内部查询，风险低但添加防御性校验
  - **Must NOT do**: 影响 dialog.showOpenDialog 选择的目录

  **Recommended Agent Profile**: `quick`
  - 在 handler 入口添加校验

  **Parallelization**: Wave 2，可与 Task 7、9、11、12 并行
  - **Blocks**: 无
  - **Blocked By**: Task 4（需要 validatePath）

  **References**:
  - `electron/path-validator.ts` — Task 4 创建
  - `electron/ipc/books.ts:67,90,45` — 需要校验的 handler
  - `electron/ipc/system.ts:27` — set-directory handler

  **Acceptance Criteria**:
  - [ ] `scan-workspace('/etc')` 返回 null 或错误
  - [ ] `import-workspace('/tmp')` 返回 null 或错误
  - [ ] 合法目录正常工作

  **QA Scenarios**:
  ```
  Scenario: 工作区操作路径校验
    Tool: Bash
    Steps:
      1. grep -n "validatePath" electron/ipc/books.ts
      2. 确认 scan-workspace, import-workspace handler 入口有 validatePath
    Expected Result: 至少 2 处 validatePath 调用
    Evidence: .sisyphus/evidence/task-10-workspace-validation.txt
  ```

  **Commit**: YES
  - Message: `fix(main): 对工作区扫描/导入操作添加路径校验`
  - Files: `electron/ipc/books.ts`, `electron/ipc/system.ts`

- [ ] 11. install-update 文件校验

  **What to do**:
  - `electron/ipc/system.ts:188-193` 的 `install-update` handler 接受渲染端传入的 `filePath`
  - 添加校验：文件必须在 `app.getPath('downloads')` 目录内
  - 添加校验：文件扩展名必须是合法安装包格式（`.dmg`, `.exe`, `.AppImage`, `.deb`）
  - 添加校验：文件必须存在且大小 > 0
  - **Must NOT do**: 在执行前打开/读取文件内容

  **Recommended Agent Profile**: `quick`
  - 单 handler 添加入口校验

  **Parallelization**: Wave 2，可与 Task 7、9、10、12 并行
  - **Blocks**: 无
  - **Blocked By**: Task 4（需要 validatePath）

  **References**:
  - `electron/ipc/system.ts:188-193` — install-update handler
  - `electron/path-validator.ts` — 校验工具

  **Acceptance Criteria**:
  - [ ] `install-update('/tmp/evil.sh')` 返回错误
  - [ ] `install-update(downloadsDir + '/AINovel-0.2.0.dmg')` 返回成功
  - [ ] 不存在的文件返回错误

  **QA Scenarios**:
  ```
  Scenario: install-update 文件校验
    Tool: Bash
    Steps:
      1. grep -A 10 "install-update" electron/ipc/system.ts
      2. 确认有路径前缀检查、扩展名检查、文件存在检查
    Expected Result: 包含 downloads 目录前缀校验 + 扩展名校验
    Evidence: .sisyphus/evidence/task-11-install-validation.txt
  ```

  **Commit**: YES
  - Message: `fix(main): 添加 install-update 文件路径校验`
  - Files: `electron/ipc/system.ts`

- [ ] 12. 移除 dead execSync import

  **What to do**:
  - `electron/ipc/books.ts:9` 导入了 `execSync` 但从未使用
  - 移除 `const { execSync } = require('child_process')` 行
  - 验证文件仍能编译

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 2，可与 Task 7、9-11 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `electron/ipc/books.ts:9` — dead import

  **Acceptance Criteria**:
  - [ ] `grep "execSync" electron/ipc/books.ts` 返回空
  - [ ] `npx tsc --noEmit -p electron/tsconfig.json` 通过

  **QA Scenarios**:
  ```
  Scenario: 验证 dead import 已移除
    Tool: Bash
    Steps:
      1. grep "execSync" electron/ipc/books.ts
    Expected Result: 返回空
    Evidence: .sisyphus/evidence/task-12-dead-import.txt
  ```

  **Commit**: YES
  - Message: `refactor(main): 移除 books.ts 中未使用的 execSync 导入`
  - Files: `electron/ipc/books.ts`

### Phase 2: 类型安全

- [ ] 13. electron/preload.ts 类型化

  **What to do**:
  - 当前 preload.ts 混合使用 ESM import 和 CJS require（`@ts-nocheck` 掩盖了问题）
  - 统一为 CJS `require`（与主进程一致）
  - 移除 `@ts-nocheck`
  - 引入 `shared/ipc.ts` 的 `ElectronAPI` 类型，对 `exposeInMainWorld` 做类型约束
  - **Must NOT do**: 改变任何运行时行为或 API 签名

  **Recommended Agent Profile**: `quick`
  - 类型修复，遵循 shared/ipc.ts 已有接口

  **Parallelization**: Wave 3，可与 Task 14-15 并行（不同文件）
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `electron/preload.ts` — 原始文件
  - `src/shared/ipc.ts:64-179` — ElectronAPI 接口定义

  **Acceptance Criteria**:
  - [ ] `grep "@ts-nocheck" electron/preload.ts` 返回空
  - [ ] `npx tsc --noEmit -p electron/tsconfig.json` 不报 preload 错误

  **Commit**: YES
  - Message: `types(main): preload.ts 移除 @ts-nocheck，引入 IPC 类型`
  - Files: `electron/preload.ts`

- [ ] 14. electron/logger.ts @ts-nocheck 移除

  **What to do**:
  - logger.ts 只有 57 行，全 CJS 风格
  - 移除 `@ts-nocheck`、`export {}`（CJS 不需要空导出）
  - 改为完整 JSDoc 类型注解或 TS 类型
  - **Must NOT do**: 改变 logger 行为

  **Recommended Agent Profile**: `quick`
  - 小文件，逻辑简单

  **Parallelization**: Wave 3，可与 Task 13、15 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `electron/logger.ts` — 原始文件

  **Acceptance Criteria**:
  - [ ] `grep "@ts-nocheck" electron/logger.ts` 返回空
  - [ ] `npx tsc --noEmit -p electron/tsconfig.json` 不报 logger 错误

  **Commit**: YES
  - Message: `types(main): logger.ts 移除 @ts-nocheck`
  - Files: `electron/logger.ts`

- [ ] 15. electron/context.ts @ts-nocheck 移除

  **What to do**:
  - context.ts 81 行，包含全局状态和 getAinovelBinary
  - 移除 `@ts-nocheck`，添加类型注解
  - 为 `state` 对象定义 `GlobalState` 接口
  - **Must NOT do**: 改变任何运行时行为

  **Recommended Agent Profile**: `quick`
  - 小文件

  **Parallelization**: Wave 3，可与 Task 13-14 并行
  - **Blocks**: Task 16-21（依赖 context 类型）
  - **Blocked By**: 无

  **References**:
  - `electron/context.ts` — 原始文件

  **Acceptance Criteria**:
  - [ ] `grep "@ts-nocheck" electron/context.ts` 返回空
  - [ ] `npx tsc --noEmit -p electron/tsconfig.json` 不报 context 错误

  **Commit**: YES
  - Message: `types(main): context.ts 移除 @ts-nocheck，添加 GlobalState 接口`
  - Files: `electron/context.ts`

- [ ] 16. electron/ipc/books.ts @ts-nocheck 移除

  **What to do**:
  - 219 行，书籍 CRUD + 扫描导入
  - 移除 `@ts-nocheck`，修复类型错误
  - 重点关注：`readStoreJSON`/`readStoreText` 返回类型，`syncArcs`/`syncChapters`/`syncReviews`/`syncSummaries` 参数类型

  **Recommended Agent Profile**: `quick`
  - 类型修复

  **Parallelization**: Wave 3，可与 Task 17 并行
  - **Blocks**: 无
  - **Blocked By**: Task 15（依赖 context 类型）

  **References**:
  - `electron/ipc/books.ts` — 原始文件

  **Acceptance Criteria**:
  - [ ] `grep "@ts-nocheck" electron/ipc/books.ts` 返回空
  - [ ] `npx tsc --noEmit -p electron/tsconfig.json` 不报 books 错误

  **Commit**: YES
  - Message: `types(main): ipc/books.ts 移除 @ts-nocheck`
  - Files: `electron/ipc/books.ts`

- [ ] 17. electron/ipc/workspace.ts @ts-nocheck 移除

  **What to do**:
  - 320 行，大纲/章节/角色/时间线/评审等数据 IPC
  - 移除 `@ts-nocheck`，修复类型错误
  - 高频 `any` 模式：`data: any`、`chars: any[]`、`rules: any[]`
  - 引入 `shared/ipc.ts` 已有类型

  **Recommended Agent Profile**: `quick`
  - 类型修复

  **Parallelization**: Wave 3，可与 Task 16、18 并行
  - **Blocks**: 无
  - **Blocked By**: Task 15

  **References**:
  - `electron/ipc/workspace.ts` — 原始文件
  - `src/shared/ipc.ts:19-42` — OutlineData, OutlineSaveData, ChapterItem, CharacterItem

  **Acceptance Criteria**:
  - [ ] `grep "@ts-nocheck" electron/ipc/workspace.ts` 返回空
  - [ ] `npx tsc --noEmit -p electron/tsconfig.json` 不报 workspace 错误

  **Commit**: YES
  - Message: `types(main): ipc/workspace.ts 移除 @ts-nocheck`
  - Files: `electron/ipc/workspace.ts`

- [ ] 18. electron/ipc/writing.ts @ts-nocheck 移除

  **What to do**:
  - 378 行，最复杂的 IPC 模块（子进程管理 + 流解析 + 定时器 + 快照构建）
  - 移除 `@ts-nocheck`，重点修复：
    - `spawn` 返回值类型
    - `stdout`/`stderr` 事件参数类型
    - `setInterval` 回调类型
    - `readStoreJSON`/`findActiveBookDir` 返回类型
    - `createSnapshotHandler`/`createEventsHandler` 工厂函数类型
  - **Must NOT do**: 重构代码结构（只加类型）

  **Recommended Agent Profile**: `deep`
  - 复杂文件，多类型交叉

  **Parallelization**: Wave 3，与 Task 19 并行
  - **Blocks**: 无
  - **Blocked By**: Task 15

  **References**:
  - `electron/ipc/writing.ts` — 原始文件
  - `src/types/index.ts:3-42` — UISnapshot, EventItem 类型

  **Acceptance Criteria**:
  - [ ] `grep "@ts-nocheck" electron/ipc/writing.ts` 返回空
  - [ ] `npx tsc --noEmit -p electron/tsconfig.json` 不报 writing 错误

  **Commit**: YES
  - Message: `types(main): ipc/writing.ts 移除 @ts-nocheck`
  - Files: `electron/ipc/writing.ts`

- [ ] 19. electron/ipc/system.ts @ts-nocheck 移除

  **What to do**:
  - 204 行，系统管理 IPC（模型/配置/更新/诊断/封面）
  - 移除 `@ts-nocheck`，修复类型错误
  - 重点关注：`fetch` 响应类型、`dialog.showOpenDialog` 返回值、`AbortSignal.timeout`

  **Recommended Agent Profile**: `deep`
  - 涉及外部 API 类型

  **Parallelization**: Wave 3，与 Task 18 并行
  - **Blocks**: 无
  - **Blocked By**: Task 15

  **References**:
  - `electron/ipc/system.ts` — 原始文件

  **Acceptance Criteria**:
  - [ ] `grep "@ts-nocheck" electron/ipc/system.ts` 返回空
  - [ ] `npx tsc --noEmit -p electron/tsconfig.json` 不报 system 错误

  **Commit**: YES
  - Message: `types(main): ipc/system.ts 移除 @ts-nocheck`
  - Files: `electron/ipc/system.ts`

- [ ] 20. electron/main.ts @ts-nocheck 移除

  **What to do**:
  - 76 行，应用入口
  - 移除 `@ts-nocheck`，修复少量类型错误
  - `app.getPath`、`BrowserWindow` 等 Electron 类型已在 `@types/electron` 中

  **Recommended Agent Profile**: `quick`
  - 小文件

  **Parallelization**: Wave 3，可与 Task 21 并行
  - **Blocks**: Task 22（需要全部无错误才能开启 strict）
  - **Blocked By**: 无（main.ts 不依赖其他 electron/ 文件类型）

  **References**:
  - `electron/main.ts` — 原始文件

  **Acceptance Criteria**:
  - [ ] `grep "@ts-nocheck" electron/main.ts` 返回空
  - [ ] `npx tsc --noEmit -p electron/tsconfig.json` 不报 main 错误

  **Commit**: YES
  - Message: `types(main): main.ts 移除 @ts-nocheck`
  - Files: `electron/main.ts`

- [ ] 21. electron/database.ts @ts-nocheck 移除

  **What to do**:
  - 648 行，最大的单文件。移除 `@ts-nocheck`，添加类型注解
  - 为 `AppDatabase` 类添加完整类型（构造函数、所有方法参数和返回值）
  - 重点关注 `prepare().run()` 和 `prepare().get()` 的泛型参数
  - **Must NOT do**: 重构 database 结构（只加类型）

  **Recommended Agent Profile**: `deep`
  - 大文件 + 复杂类型

  **Parallelization**: Wave 3，可与 Task 20 并行
  - **Blocks**: 无
  - **Blocked By**: Task 15（依赖 context 类型约定）

  **References**:
  - `electron/database.ts` — 原始文件

  **Acceptance Criteria**:
  - [ ] `grep "@ts-nocheck" electron/database.ts` 返回空
  - [ ] `npx tsc --noEmit -p electron/tsconfig.json` 不报 database 错误

  **Commit**: YES
  - Message: `types(main): database.ts 移除 @ts-nocheck，添加 AppDatabase 类型`
  - Files: `electron/database.ts`

- [ ] 22. electron/tsconfig.json strict:true 启用

  **What to do**:
  - Task 13-21 完成后，所有文件 `@ts-nocheck` 已清零
  - 修改 `electron/tsconfig.json`：`"strict": true`、`"noImplicitAny": true`
  - 运行 `npx tsc --noEmit -p electron/tsconfig.json` 确认零错误

  **Recommended Agent Profile**: `quick`
  - 配置修改

  **Parallelization**: Wave 4
  - **Blocks**: 无
  - **Blocked By**: Task 13-21 全部完成

  **References**:
  - `electron/tsconfig.json` — 修改目标
  - `tsconfig.json`（src/）— strict: true 参照

  **Acceptance Criteria**:
  - [ ] `electron/tsconfig.json` 中 `strict: true`、`noImplicitAny: true`
  - [ ] `npx tsc --noEmit -p electron/tsconfig.json` 退出码 0

  **QA Scenarios**:
  ```
  Scenario: 主进程 strict 类型检查通过
    Tool: Bash
    Steps:
      1. npx tsc --noEmit -p electron/tsconfig.json
    Expected Result: exit 0，无错误输出
    Evidence: .sisyphus/evidence/task-22-strict-check.txt
  ```

  **Commit**: YES
  - Message: `types(main): 启用主进程严格类型检查 (strict: true)`
  - Files: `electron/tsconfig.json`

- [ ] 23. src/ 中 11 处 as any 修复

  **What to do**:
  - 修复以下文件中所有 `as any`：
    - `BookList.tsx:71,72,209` — `(book as any).tags/.premise` 改为更新 `BookItem` 接口
    - `ModelsPage.tsx:57` — `Object.entries(cfg.providers) as any` 改为定义 `ProviderConfig`
    - `TimelinePage.tsx:52` — `setTab(k as any)` 改为定义 `Tab` union 类型
    - `SummaryPage.tsx:62` — 同上
    - `UserRulesPage.tsx:196` — 同上
    - `SimulationPage.tsx:166,192,335` — `(profile.synthesis as any)[key]` 改为类型化
    - `lib/store/index.ts:266` — `style as any` 改为更新 `Book.style` 类型
  - **Must NOT do**: 使用 `unknown` 代替 `any` 后不添加 type guard

  **Recommended Agent Profile**: `quick`
  - 11 处分散的类型修复

  **Parallelization**: Wave 4，可与 Task 22 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `src/shared/ipc.ts:8-12` — BookItem 接口
  - `src/pages/BookList.tsx:*` — as any 位置

  **Acceptance Criteria**:
  - [ ] `grep -r "as any" src/` 返回空
  - [ ] `npx tsc --noEmit -p tsconfig.json` 通过

  **Commit**: YES
  - Message: `types: 修复 src/ 中 11 处 as any`
  - Files: `src/pages/BookList.tsx`, `src/pages/ModelsPage.tsx`, `src/pages/TimelinePage.tsx`, `src/pages/SummaryPage.tsx`, `src/pages/UserRulesPage.tsx`, `src/pages/SimulationPage.tsx`, `src/lib/store/index.ts`, `src/shared/ipc.ts`

### Phase 3: 代码质量基础

- [ ] 24. 设置 ESLint

  **What to do**:
  - 创建 `eslint.config.js`（ESLint 9 flat config）
  - 配置：`@typescript-eslint/recommended` + `eslint-plugin-react/recommended` + `eslint-plugin-react-hooks/recommended`
  - 添加 `lint` 脚本到 `package.json`
  - 运行 `npx eslint src/ electron/ --fix` 自动修复可修复的问题
  - **Must NOT do**: 添加过于严格的规则（如 `import/order`）。保持 `@typescript-eslint/recommended` 级别。

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 5，可与 Task 25-30 并行
  - **Blocks**: 无
  - **Blocked By**: Task 22-23（类型修复完成后 lint 才有意义）

  **References**:
  - `package.json:50` — eslint 已安装
  - ESLint 9 flat config 文档

  **Acceptance Criteria**:
  - [ ] `npm run lint` 可执行
  - [ ] `eslint.config.js` 存在且有效
  - [ ] `package.json` 包含 `"lint": "eslint src/ electron/"`

  **QA Scenarios**:
  ```
  Scenario: ESLint 配置可用
    Tool: Bash
    Steps:
      1. npx eslint --version
      2. npm run lint 2>&1 | tail -5
    Expected Result: lint 命令执行成功（可能有一些 warning，但无 error）
    Evidence: .sisyphus/evidence/task-24-eslint-setup.txt
  ```

  **Commit**: YES
  - Message: `chore: 配置 ESLint (@typescript-eslint + react 预设)`
  - Files: `eslint.config.js`, `package.json`

- [ ] 25. 设置 Vitest 框架 + 首个测试

  **What to do**:
  - 安装 `vitest` 到 devDependencies
  - 创建 `vitest.config.ts`（alias `@` 与 vite.config.ts 一致）
  - 添加 `"test": "vitest run"` 和 `"test:watch": "vitest"` 到 `package.json`
  - 创建 `src/lib/__tests__/io.test.ts`：测试 `IO` 原子写入（`tmp + rename`）
  - **Must NOT do**: 为所有模块写测试（只做框架搭建 + 1 个示例测试）

  **Recommended Agent Profile**: `quick`
  - 框架搭建 + 简单测试

  **Parallelization**: Wave 5，可与 Task 24、26-30 并行
  - **Blocks**: Task 30、37（后续测试依赖框架）
  - **Blocked By**: 无

  **References**:
  - `src/lib/store/io.ts` — IO 类实现（测试目标）
  - `vite.config.ts:9-11` — alias 配置

  **Acceptance Criteria**:
  - [ ] `npm test` 可执行
  - [ ] `vitest.config.ts` 存在且有效
  - [ ] 至少 1 个测试文件，≥2 个测试用例通过

  **QA Scenarios**:
  ```
  Scenario: Vitest 运行测试通过
    Tool: Bash
    Steps:
      1. npm test
    Expected Result: exit 0，显示 "Tests 2 passed"
    Evidence: .sisyphus/evidence/task-25-vitest-pass.txt
  ```

  **Commit**: YES
  - Message: `test: 集成 Vitest 框架 + IO 原子写入测试`
  - Files: `vitest.config.ts`, `package.json`, `src/lib/__tests__/io.test.ts`

- [ ] 26. 修复 phaseLabel 分歧

  **What to do**:
  - `BookList.tsx:116-119` 和 `BookIntroPage.tsx:33-36` 各自定义了 `phaseLabel`，且有分歧：
    - BookList: `'写作'` vs BookIntroPage: `'写作中'`
  - 统一到 `src/types/index.ts` 的 `PHASE_LABELS`（已存在，但个别值可能不同）
  - 两处改为 `import { PHASE_LABELS } from '@/types'`
  - 确认 `PHASE_LABELS` 包含所有需要的 phase key

  **Recommended Agent Profile**: `quick`
  - 两处替换

  **Parallelization**: Wave 5，可与 Task 24-25、27-30 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `src/types/index.ts:101-107` — PHASE_LABELS
  - `src/pages/BookList.tsx:116-119` — 内联 phaseLabel
  - `src/pages/BookIntroPage.tsx:33-36` — 内联 phaseLabel

  **Acceptance Criteria**:
  - [ ] `grep "phaseLabel" src/pages/BookList.tsx` 不包含 `: { init:` 定义
  - [ ] `grep "phaseLabel" src/pages/BookIntroPage.tsx` 不包含 `: { init:` 定义
  - [ ] 两处都使用 `PHASE_LABELS` import
  - [ ] 值一致（无 '写作' vs '写作中' 分歧）

  **Commit**: YES
  - Message: `fix: 统一 phaseLabel 到 types/index.ts，修复显示不一致`
  - Files: `src/pages/BookList.tsx`, `src/pages/BookIntroPage.tsx`

- [ ] 27. 移除 console.log

  **What to do**:
  - 移除/替换以下 debug console.log：
    - `Workspace.tsx:56,58` — `console.log('resumeWriting called')` / `console.log('resumeWriting result')` → 删除
    - `BookCover.tsx:31,33,36` — `console.log('[cover] selecting image')` → 删除
    - `BookCover.tsx:41` — `console.error('[cover] error:', ok)` → 保留（error 级别，有用）
    - `BookList.tsx:43` — `console.error('loadBooks error:', e)` → 保留
  - **Must NOT do**: 移除 `console.error`（错误日志有价值）

  **Recommended Agent Profile**: `quick`
  - 删除 5 行

  **Parallelization**: Wave 5，可与 Task 24-26、28-30 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `src/pages/Workspace.tsx:56,58`
  - `src/components/BookCover.tsx:31,33,36`

  **Acceptance Criteria**:
  - [ ] `grep "console.log" src/` 返回空（或只剩注释中引用）
  - [ ] `console.error` 保留（BookCover.tsx, BookList.tsx）

  **Commit**: YES
  - Message: `chore: 移除生产代码中的 debug console.log`
  - Files: `src/pages/Workspace.tsx`, `src/components/BookCover.tsx`

- [ ] 28. 修复可变列表的 key={i} 反模式

  **What to do**:
  - 审计所有 `key={i}` 用法（28 处），区分安全/不安全：
    - **必须修复**（列表支持添加/删除/排序/过滤）：
      - TimelinePage.tsx — timeline events
      - ReviewsPage.tsx — review list
      - OutlinePage.tsx — outline items
      - SimulationPage.tsx — synthesis cards
      - WorldRulesPage.tsx — rules list
      - UserRulesPage.tsx — sources/uncertain list
      - CharactersPage.tsx — cast list, relation svg lines
      - StreamOutput.tsx — stream chunks（可能重排）
      - EventFlow.tsx — sliced events
    - **可保留**（静态列表从不重排）：
      - Welcome.tsx — 静态示例
      - CoCreateModal.tsx — 静态建议
      - DetailPanel.tsx — characters display
  - 每个修复：用 `item.name`、`item.id`、`item.num`、`item.chapter` 等稳定 ID

  **Recommended Agent Profile**: `quick`
  - 多处小修改

  **Parallelization**: Wave 5，可与 Task 24-27、29-30 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - 各文件的 `key={i}` 位置（见分析报告）

  **Acceptance Criteria**:
  - [ ] 所有可变列表不再使用数组索引作为 key
  - [ ] `npx tsc --noEmit` 通过

  **Commit**: YES
  - Message: `fix: 修复可变列表的 key={i} 反模式（使用稳定 ID）`
  - Files: `src/pages/TimelinePage.tsx`, `src/pages/ReviewsPage.tsx`, `src/pages/OutlinePage.tsx`, `src/pages/SimulationPage.tsx`, `src/pages/WorldRulesPage.tsx`, `src/pages/UserRulesPage.tsx`, `src/pages/CharactersPage.tsx`, `src/components/StreamOutput.tsx`, `src/components/EventFlow.tsx`

- [ ] 29. 统一版本号

  **What to do**:
  - 问题：版本号在 3 处硬编码：
    - `package.json:3` — `"version": "0.2.0"`
    - `electron/ipc/system.ts:196` — `const APP_VERSION = '0.2.0'`
    - `src/components/TopBar.tsx:8` — `const version = '0.2.0'`
    - `src/pages/SettingsPage.tsx:145,227` — `'v0.2.0'`
  - 解决方案：
    - `system.ts` 改为 `require('../../package.json').version`
    - 渲染端通过 `import.meta.env` 或 define 注入（Vite 的 `define`）
    - **Must NOT do**: 同时修改 version 值（只做引用统一，不改版本号本身）

  **Recommended Agent Profile**: `quick`
  - 3 处替换

  **Parallelization**: Wave 5，可与 Task 24-28、30 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `package.json:3` — 版本源
  - `electron/ipc/system.ts:196` — 硬编码
  - `src/components/TopBar.tsx:8` — 硬编码
  - `src/pages/SettingsPage.tsx:145,227` — 硬编码

  **Acceptance Criteria**:
  - [ ] TopBar 版本号从 `import.meta.env.PACKAGE_VERSION` 读取
  - [ ] system.ts 版本号从 `package.json` 读取
  - [ ] SettingsPage 版本号从同样的源读取

  **Commit**: YES
  - Message: `refactor: 统一版本号为单一声源（package.json）`
  - Files: `electron/ipc/system.ts`, `src/components/TopBar.tsx`, `src/pages/SettingsPage.tsx`, `vite.config.ts`

- [ ] 30. 为核心模块写 characterization test

  **What to do**:
  - 为以下模块写 characterization test（捕获当前行为，不改变实现）：
    - `src/stores/useAppStore.ts` — 测试 `setMode`、`setTheme`、`appendStreamOutput`、`pushToHistory`
    - `src/lib/store/io.ts` — 测试读取、原子写入、目录创建
    - `src/types/index.ts` — 测试 `translateEventSummary` 翻译逻辑
  - `shared/ipc.ts` — 编译时类型检查（interface 一致性）
  - **Must NOT do**: 测试 IPC handler（需要 mock Electron）
  - **Must NOT do**: 写 UI 组件测试（需要 @testing-library/react）

  **Recommended Agent Profile**: `deep`
  - 需要理解现有行为并编写精确测试

  **Parallelization**: Wave 5，依赖 Task 25（Vitest 框架）
  - **Blocks**: 后续重构的安全网
  - **Blocked By**: Task 25

  **References**:
  - `src/stores/useAppStore.ts` — 测试目标
  - `src/lib/store/io.ts` — 测试目标
  - `src/types/index.ts:196-203` — translateEventSummary

  **Acceptance Criteria**:
  - [ ] `npx vitest run` ≥10 个测试通过
  - [ ] 测试覆盖 store actions、IO 读写、翻译函数

  **Commit**: YES
  - Message: `test: 添加模块 characterization tests（store, IO, types）`
  - Files: `src/stores/__tests__/useAppStore.test.ts`, `src/lib/__tests__/store-io.test.ts`, `src/types/__tests__/index.test.ts`

### Phase 4: 架构重构

- [ ] 31. 映射 store 消费者矩阵

  **What to do**:
  - 使用 `lsp_find_references` 对 `useAppStore` 的每个字段做引用分析：
    - `mode`, `startupMode`, `focusPane`, `theme` → UI 状态消费者
    - `snapshot`, `events`, `chapters`, `chapterContent` → 领域数据消费者
    - `streamOutput`, `inputHistory`, `inputValue` → 写作状态消费者
    - `showHelp`, `showModelSwitch`, `showDiagnostics` 等 → 模态框消费者
  - 产出一个 field→component 矩阵
  - 输出到 `.sisyphus/evidence/task-31-store-matrix.md`
  - **Must NOT do**: 直接拆分 store（先分析再拆分）

  **Recommended Agent Profile**: `deep`
  - 需要系统性地追踪所有引用

  **Parallelization**: Wave 6
  - **Blocks**: Task 32-33（拆分依赖此分析）
  - **Blocked By**: 无（只需读取代码）

  **References**:
  - `src/stores/useAppStore.ts:20-96` — 所有字段

  **Acceptance Criteria**:
  - [ ] 矩阵文件存在且包含所有 30+ 字段的消费者列表
  - [ ] 清晰划分 UI 状态 / 领域数据 / 写作状态 / 模态框边界

  **QA Scenarios**:
  ```
  Scenario: 消费者矩阵完整
    Tool: Bash
    Steps:
      1. cat .sisyphus/evidence/task-31-store-matrix.md | head -50
    Expected Result: 列出字段名 + 消费者文件列表
    Evidence: .sisyphus/evidence/task-31-store-matrix.md
  ```

  **Commit**: NO（分析产物，不提交代码）

- [ ] 32. 拆分 store: useUIStore + useDomainStore

  **What to do**:
  - 基于 Task 31 的矩阵，从 `useAppStore` 中拆分出：
    - `useUIStore`：`mode`, `startupMode`, `focusPane`, `theme`, `showHelp`, `showModelSwitch`, `showDiagnostics`, `showCoCreate`, `showImport`, `showExport`, `toasts`, `addToast`, `removeToast`, `setTheme` 等
    - `useDomainStore`：`snapshot`, `events`, `chapters`, `chapterContent`, `streamOutput`, `inputHistory`, `inputValue`, `placeholderText`, `error`, `diagReport`, 以及所有 `refresh*`、`startWriting`、`sendInput` 等 action
  - 更新所有消费者 import 路径
  - **Must NOT do**: 改变 selector 签名或行为

  **Recommended Agent Profile**: `deep`
  - 影响面广，需精确

  **Parallelization**: Wave 6，依赖 Task 31
  - **Blocks**: Task 33
  - **Blocked By**: Task 31

  **References**:
  - `src/stores/useAppStore.ts` — 原始 store
  - Task 31 的消费者矩阵

  **Acceptance Criteria**:
  - [ ] `useAppStore` 被拆分为至少 2 个 store 文件
  - [ ] `npx tsc --noEmit` 通过
  - [ ] `npx vitest run` 通过（已有 characterization test）
  - [ ] 原有组件无需修改 selector 逻辑（向后兼容的导出路径）

  **Commit**: YES
  - Message: `refactor: 拆分 Zustand store (useUIStore + useDomainStore)`
  - Files: `src/stores/useAppStore.ts`（重写为 re-export），`src/stores/useUIStore.ts`（新增），`src/stores/useDomainStore.ts`（新增）

- [ ] 33. 拆分 store: useBookStore + useWritingStore

  **What to do**:
  - 进一步从 `useDomainStore` 中拆分：
    - `useBookStore`：`snapshot`, `events`, `chapters`, `chapterContent`, `refreshSnapshot`, `refreshEvents`, `refreshChapters`
    - `useWritingStore`：`streamOutput`, `inputHistory`, `inputValue`, `placeholderText`, `startWriting`, `resumeWriting`, `sendInput`, `pauseWriting`, `stopWriting`, `runDiag`, `runExport`, `setError`
  - **Must NOT do**: 进一步拆分（4 个 store 足够）

  **Recommended Agent Profile**: `deep`
  - 二次拆分

  **Parallelization**: Wave 6，依赖 Task 32
  - **Blocks**: Task 34-35（hook 提取依赖 store 结构稳定）
  - **Blocked By**: Task 32

  **References**:
  - `src/stores/useDomainStore.ts` — Task 32 创建的中间 store

  **Acceptance Criteria**:
  - [ ] 最终有 4 个 store：useUIStore, useBookStore, useWritingStore（useAppStore re-export 全部）
  - [ ] `npx vitest run` 通过
  - [ ] 无单一 store 文件超过 150 行

  **Commit**: YES
  - Message: `refactor: 进一步拆分 store (useBookStore + useWritingStore)`
  - Files: `src/stores/useBookStore.ts`, `src/stores/useWritingStore.ts`, `src/stores/useAppStore.ts`（re-export）

- [ ] 34. 提取 useBookId() hook

  **What to do**:
  - 12 个文件中有 19 处重复的 `useParams<{ id: string }>()` + `if (!id || !window.electronAPI) return` guard
  - 创建 `src/hooks/useBookId.ts`：
    ```ts
    export function useBookId() {
      const { id } = useParams<{ id: string }>()
      const navigate = useNavigate()
      useEffect(() => {
        if (!id || !window.electronAPI) navigate('/')
      }, [id, navigate])
      return id as string
    }
    ```
  - 替换所有 12 个文件中的重复 guard

  **Recommended Agent Profile**: `quick`
  - 小 hook，多文件替换

  **Parallelization**: Wave 7，可与 Task 35-37 并行
  - **Blocks**: 无
  - **Blocked By**: Task 33（store 结构稳定后 hooks 才安全）

  **References**:
  - 12 个页面文件中的 `useParams<{ id: string }>()` 模式（见分析报告）

  **Acceptance Criteria**:
  - [ ] `src/hooks/useBookId.ts` 存在
  - [ ] 所有页面文件使用 `const id = useBookId()` 替代原有 guard
  - [ ] `npx tsc --noEmit` 通过

  **Commit**: YES
  - Message: `refactor: 提取 useBookId() hook（消除 19 处重复 guard）`
  - Files: `src/hooks/useBookId.ts` + 12 个页面文件

- [ ] 35. 提取 useBookData<T>() hook

  **What to do**:
  - 9 个页面文件有相同的 `useState + useEffect + loadData` 模式
  - 创建 `src/hooks/useBookData.ts`：
    ```ts
    export function useBookData<T>(fetcher: (id: string) => Promise<T>) {
      const id = useBookId()
      const [data, setData] = useState<T | null>(null)
      const [loading, setLoading] = useState(true)
      useEffect(() => {
        let cancelled = false
        setLoading(true)
        fetcher(id).then(d => { if (!cancelled) { setData(d); setLoading(false) } })
        return () => { cancelled = true }
      }, [id, fetcher])
      return { data, loading, refetch: () => { setLoading(true); fetcher(id).then(d => { setData(d); setLoading(false) }) } }
    }
    ```
  - 替换 9 个文件中的 loadData 模式

  **Recommended Agent Profile**: `quick`
  - Hook 提取 + 多文件替换

  **Parallelization**: Wave 7，可与 Task 34、36-37 并行
  - **Blocks**: 无
  - **Blocked By**: Task 33（store 结构稳定）

  **References**:
  - 9 个页面文件中的 loadData 模式

  **Acceptance Criteria**:
  - [ ] `src/hooks/useBookData.ts` 存在
  - [ ] 页面使用 `const { data: chars, loading } = useBookData(api.getBookCharacters)`
  - [ ] 包含清理逻辑（防止组件卸载后 setState）

  **Commit**: YES
  - Message: `refactor: 提取 useBookData<T>() hook（消除 ~270 行重复）`
  - Files: `src/hooks/useBookData.ts` + 9 个页面文件

- [ ] 36. 提取 <BookPage> 布局组件

  **What to do**:
  - 11 个页面文件重复相同的布局结构：
    - `<BookNavSidebar bookId={id} />`
    - `<div style={{ flex: 1, ... }}>`
    - `<div style={{ ...flexShrink: 0 }}>`
    - `<button onClick={navigate}>← 返回</button>`
    - `<h2>{title}</h2>`
  - 创建 `src/components/BookPage.tsx`：
    - Props: `title`, `children`
    - 内部: `useBookId()`, `BookNavSidebar`, 返回按钮
  - 替换 11 个文件

  **Recommended Agent Profile**: `visual-engineering`
  - UI 组件提取

  **Parallelization**: Wave 7，可与 Task 34-35、37 并行
  - **Blocks**: 无
  - **Blocked By**: Task 34（依赖 useBookId hook）

  **References**:
  - 11 个页面文件中的布局模式

  **Acceptance Criteria**:
  - [ ] `src/components/BookPage.tsx` 存在
  - [ ] 页面文件使用 `<BookPage title="角色管理"><CharactersPageContent/></BookPage>`
  - [ ] ~880 行重复代码消除

  **Commit**: YES
  - Message: `refactor: 提取 <BookPage> 布局组件（消除 ~880 行重复）`
  - Files: `src/components/BookPage.tsx` + 11 个页面文件

- [ ] 37. 抽出 RelationGraph 力导向算法

  **What to do**:
  - `CharactersPage.tsx:391-643` 的 `RelationGraph` 组件包含 253 行力导向图逻辑
  - 抽出力导向核心算法到 `src/lib/force-layout.ts`（纯函数，无 React 依赖）：
    - `initPositions(nodes, width, height)` → 位置初始化
    - `simulateForces(nodes, edges, iterations)` → 力模拟
    - `layoutGraph(nodes, edges, width, height)` → 完整布局
  - `RelationGraph` 组件改为使用上述纯函数
  - 为纯函数写测试

  **Recommended Agent Profile**: `deep`
  - 算法抽出 + 测试

  **Parallelization**: Wave 7，可与 Task 34-36 并行
  - **Blocks**: Task 38（CharactersPage 拆分）
  - **Blocked By**: Task 25（需要测试框架）

  **References**:
  - `src/pages/CharactersPage.tsx:391-643` — RelationGraph 实现
  - `src/pages/CharactersPage.tsx:417-447` — 位置初始化
  - `src/pages/CharactersPage.tsx:481-501` — 拖拽模拟

  **Acceptance Criteria**:
  - [ ] `src/lib/force-layout.ts` 存在
  - [ ] `src/lib/__tests__/force-layout.test.ts` 有 ≥3 个测试
  - [ ] RelationGraph 组件使用 `force-layout.ts` 的函数
  - [ ] 图布局视觉效果不变

  **Commit**: YES
  - Message: `refactor: 抽出 RelationGraph 力导向算法为可测试纯函数`
  - Files: `src/lib/force-layout.ts`, `src/lib/__tests__/force-layout.test.ts`, `src/pages/CharactersPage.tsx`

### Phase 5: 超限文件拆分

- [ ] 38. 拆分 CharactersPage.tsx (643→≤300)

  **What to do**:
  - 当前 643 行，包含主页面 + CastEcosystem + RelationGraph
  - 拆分方案：
    - `pages/CharactersPage.tsx` — 主页面，Tab 切换（~150 行）
    - `components/characters/CharacterList.tsx` — 角色列表 + 筛选 + 详情（~150 行）
    - `components/characters/CastList.tsx` — 配角名册列表（~100 行）
    - `components/characters/RelationGraph.tsx` — 关系图谱（使用 Task 37 的 force-layout，~100 行）
    - `components/characters/CastEcosystem.tsx` — 配角生态系统可视化（~138 行）
  - **Must NOT do**: 同时迁移内联样式（Phase 6 单独做）

  **Recommended Agent Profile**: `deep`
  - 最大文件，4 路拆分

  **Parallelization**: Wave 8，可与 Task 39-42 并行（不同文件）
  - **Blocks**: 无
  - **Blocked By**: Task 37（RelationGraph 算法已抽出）

  **References**:
  - `src/pages/CharactersPage.tsx` — 原始文件
  - `src/lib/force-layout.ts` — Task 37 创建的算法

  **Acceptance Criteria**:
  - [ ] 所有 5 个新文件 ≤300 行
  - [ ] `npx tsc --noEmit` 通过
  - [ ] 页面功能不变（Tab 切换、角色列表、配角、关系图）

  **Commit**: YES
  - Message: `refactor: 拆分 CharactersPage.tsx（643→5 文件）`
  - Files: `src/pages/CharactersPage.tsx`, `src/components/characters/`（新增目录）

- [ ] 39. 拆分 UserRulesPage.tsx (466→≤300)

  **What to do**:
  - 当前 466 行，4 个 tab 全部内联
  - 拆分方案：
    - `pages/UserRulesPage.tsx` — Tab 切换容器（~120 行）
    - `components/rules/RulesEditor.tsx` — 核心规则编辑器（~150 行）
    - `components/rules/PreferencesEditor.tsx` — 偏好设置（~80 行）
    - `components/rules/SourcesList.tsx` — 来源列表（~70 行）
    - `components/rules/UncertainList.tsx` — 不确定性列表（~50 行）

  **Recommended Agent Profile**: `deep`
  - 4 tab 拆分

  **Parallelization**: Wave 8，可与 Task 38、40-42 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `src/pages/UserRulesPage.tsx` — 原始文件

  **Acceptance Criteria**:
  - [ ] 所有新文件 ≤300 行
  - [ ] Tab 切换功能正常

  **Commit**: YES
  - Message: `refactor: 拆分 UserRulesPage.tsx（466→5 文件）`
  - Files: `src/pages/UserRulesPage.tsx`, `src/components/rules/`（新增目录）

- [ ] 40. 拆分 BookList.tsx (366→≤300)

  **What to do**:
  - 当前 366 行，包含模态框逻辑
  - 拆分方案：
    - `pages/BookList.tsx` — 书架主页（~200 行）
    - `components/books/EditBookModal.tsx` — 编辑模态框（~100 行）
    - `components/books/DeleteBookModal.tsx` — 删除确认模态框（~70 行）

  **Recommended Agent Profile**: `deep`
  - 模态框抽出

  **Parallelization**: Wave 8，可与 Task 38-39、41-42 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `src/pages/BookList.tsx` — 原始文件

  **Acceptance Criteria**:
  - [ ] 所有文件 ≤300 行
  - [ ] 编辑/删除模态框功能正常

  **Commit**: YES
  - Message: `refactor: 拆分 BookList.tsx（366→3 文件）`
  - Files: `src/pages/BookList.tsx`, `src/components/books/EditBookModal.tsx`, `src/components/books/DeleteBookModal.tsx`

- [ ] 41. 拆分 SimulationPage.tsx (365→≤300)

  **What to do**:
  - 当前 365 行，3 个 tab
  - 拆分方案：
    - `pages/SimulationPage.tsx` — Tab 容器（~150 行）
    - `components/simulation/ProfileTab.tsx` — 仿写画像（~120 行）
    - `components/simulation/SynthesisTab.tsx` — 综合分析（~100 行）

  **Recommended Agent Profile**: `deep`

  **Parallelization**: Wave 8，可与 Task 38-40、42 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `src/pages/SimulationPage.tsx` — 原始文件

  **Acceptance Criteria**:
  - [ ] 所有文件 ≤300 行

  **Commit**: YES
  - Message: `refactor: 拆分 SimulationPage.tsx（365→3 文件）`
  - Files: `src/pages/SimulationPage.tsx`, `src/components/simulation/`（新增目录）

- [ ] 42. 拆分 ModelsPage.tsx (313→≤300)

  **What to do**:
  - 当前 313 行，5 个子面板
  - 拆分方案：
    - `pages/ModelsPage.tsx` — 主页面（~180 行）
    - `components/models/ProviderCard.tsx` — Provider 卡片（~140 行）

  **Recommended Agent Profile**: `deep`

  **Parallelization**: Wave 8，可与 Task 38-41 并行
  - **Blocks**: 无
  - **Blocked By**: 无

  **References**:
  - `src/pages/ModelsPage.tsx` — 原始文件

  **Acceptance Criteria**:
  - [ ] 所有文件 ≤300 行
  - [ ] `find src/ -name "*.tsx" -exec wc -l {} \; | awk '$1 > 300'` 返回空

  **Commit**: YES
  - Message: `refactor: 拆分 ModelsPage.tsx（313→2 文件）`
  - Files: `src/pages/ModelsPage.tsx`, `src/components/models/ProviderCard.tsx`

### Phase 6: 样式迁移

- [ ] 43. 添加高频 CSS 类

  **What to do**:
  - 在 `App.css` 中添加以下类：
    - `.input`, `.input-sm` — 统一输入框样式（替代 30+ 处内联 input style）
    - `.badge`, `.badge-error`, `.badge-success`, `.badge-warning`, `.badge-info`, `.badge-review` — 标签 pill
    - `.truncate-2` — 两行截断（替代 4+ 处 WebkitLineClamp 内联）
    - `.scroll-y` — 垂直滚动区域
    - `.tag-remove-btn` — tag 删除按钮样式
  - **Must NOT do**: 删除 App.css 现有规则

  **Recommended Agent Profile**: `visual-engineering`

  **Parallelization**: Wave 9
  - **Blocks**: Task 44-47（样式迁移需要 CSS 类先存在）
  - **Blocked By**: 无

  **References**:
  - `src/App.css` — 目标文件

  **Acceptance Criteria**:
  - [ ] `App.css` 添加 ≥6 个新 CSS 类
  - [ ] 类名清晰，使用项目现有 CSS 变量

  **Commit**: YES
  - Message: `style: 添加高频 CSS 类 (.input, .badge-*, .truncate-2)`
  - Files: `src/App.css`

- [ ] 44. 迁移 CharactersPage 内联样式

  **What to do**:
  - CharactersPage 有 124 处内联 `style={{...}}`
  - 用 Task 43 的 CSS 类替换高频模式：
    - 输入框 → `.input` / `.input-sm`
    - 标签 → `.badge-*`
    - 颜色引用 → CSS 变量（如 `#e5b449` → `var(--color-accent)`）
  - 保留必须动态计算的样式（如 `width: ${progress}%`）
  - 目标：减少 50%+（124→60 以内）

  **Recommended Agent Profile**: `visual-engineering`

  **Parallelization**: Wave 9，可与 Task 45-47 并行（不同文件）
  - **Blocks**: 无
  - **Blocked By**: Task 43

  **References**:
  - `src/pages/CharactersPage.tsx` — 目标文件
  - `src/App.css` — CSS 变量

  **Acceptance Criteria**:
  - [ ] 内联样式减少 50%+（`grep "style={{" | wc -l` 验证）

  **Commit**: YES
  - Message: `style: 迁移 CharactersPage 内联样式至 CSS 类`
  - Files: `src/pages/CharactersPage.tsx`, `src/components/characters/*.tsx`

- [ ] 45. 迁移 UserRulesPage 内联样式

  **What to do**:
  - 82 处内联样式
  - 同 Task 44 模式

  **Recommended Agent Profile**: `visual-engineering`

  **Parallelization**: Wave 9，可与 Task 44、46-47 并行

  **Acceptance Criteria**:
  - [ ] 内联样式减少 50%+

  **Commit**: YES
  - Message: `style: 迁移 UserRulesPage 内联样式至 CSS 类`
  - Files: `src/pages/UserRulesPage.tsx`, `src/components/rules/*.tsx`

- [ ] 46. 迁移 BookList/SimulationPage/ModelsPage 内联样式

  **What to do**:
  - BookList: 60 处，SimulationPage: 54 处，ModelsPage: 48 处
  - 三文件一起处理（共享大量相同模式）

  **Recommended Agent Profile**: `visual-engineering`

  **Parallelization**: Wave 9，可与 Task 44-45、47 并行

  **Acceptance Criteria**:
  - [ ] 三个文件内联样式合计减少 50%+

  **Commit**: YES
  - Message: `style: 迁移 BookList/Simulation/Models 页内联样式`
  - Files: `src/pages/BookList.tsx`, `src/pages/SimulationPage.tsx`, `src/pages/ModelsPage.tsx`

- [ ] 47. 迁移其余文件内联样式（批量）

  **What to do**:
  - 处理剩余文件中可迁移的内联样式：
    - SettingsPage (47), WorldRulesPage (50), DetailPanel (34), OutlinePage (32)
    - 其余小文件（TopBar, Welcome, InputBox, StatusSidebar, BookCover, ExportModal 等）
  - 目标：全部内联样式从 775 降至 350 以下

  **Recommended Agent Profile**: `visual-engineering`

  **Parallelization**: Wave 9，可与 Task 44-46 并行

  **Acceptance Criteria**:
  - [ ] `grep -r "style={{" src/ | wc -l` 输出 ≤400

  **Commit**: YES
  - Message: `style: 迁移剩余页面内联样式至 CSS 类（批量）`
  - Files: 剩余页面和组件文件

### Phase 7: 构建优化

- [ ] 48. Vite manualChunks 配置

  **What to do**:
  - 在 `vite.config.ts` 添加 `build.rollupOptions.output.manualChunks`：
    ```ts
    manualChunks: {
      'vendor-react': ['react', 'react-dom'],
      'vendor-router': ['react-router-dom'],
      'vendor-state': ['zustand'],
      'vendor-icons': ['lucide-react'],
    }
    ```
  - 设置 `build.chunkSizeWarningLimit: 500`
  - **Must NOT do**: 同时升级 Vite 版本

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 10，可与 Task 49 并行
  - **Blocks**: 无
  - **Blocked By**: Task 42（文件拆分后模块结构稳定）

  **References**:
  - `vite.config.ts` — 目标文件
  - Vite build.rollupOptions 文档

  **Acceptance Criteria**:
  - [ ] `npm run build` 生成 ≥3 个 JS chunk
  - [ ] 无单一 chunk 超过 200KB（gzip 前更小）
  - [ ] `npm run electron:dev` 启动正常

  **Commit**: YES
  - Message: `build: 配置 Vite manualChunks 拆分 vendor bundle`
  - Files: `vite.config.ts`

- [ ] 49. 版本号同步自动化

  **What to do**:
  - 创建 `scripts/sync-version.ts`：读取 `package.json` 版本，更新 `download.json` 版本
  - 在 `prebuild` 或 `release` 脚本中添加 `npm run sync-version`
  - 确保 `electron/ipc/system.ts` 使用 `require('../../package.json').version`（已在 Task 29 修复）
  - 确保渲染端通过 Vite `define` 注入版本号（已在 Task 29 修复）
  - **Must NOT do**: 自动改动版本号值（版本号仍需手动更新）

  **Recommended Agent Profile**: `quick`

  **Parallelization**: Wave 10，可与 Task 48 并行
  - **Blocks**: 无
  - **Blocked By**: Task 29（版本号引用统一后才有意义）

  **References**:
  - `package.json:3` — 版本源
  - `download.json:2` — 需要同步的版本字段

  **Acceptance Criteria**:
  - [ ] `scripts/sync-version.ts` 存在
  - [ ] `diff <(jq -r '.version' package.json) <(jq -r '.version' download.json)` 一致

  **Commit**: YES
  - Message: `build: 添加版本号同步脚本（package.json ↔ download.json）`
  - Files: `scripts/sync-version.ts`, `package.json`

### Phase 8: CI/CD

- [ ] 50. GitHub Actions workflow

  **What to do**:
  - 创建 `.github/workflows/ci.yml`：
    - Trigger: push to master, PR to master
    - Jobs:
      1. `lint`: `npm ci` → `npm run lint`
      2. `typecheck`: `npm ci` → `npx tsc --noEmit -p tsconfig.json` + `npx tsc --noEmit -p electron/tsconfig.json`
      3. `test`: `npm ci` → `npm test`
      4. `build`: `npm ci` → `npm run build`
    - Runner: macOS（Electron 需要 macOS SDK）
    - Node 20 LTS
  - **Must NOT do**: 添加跨平台 matrix build（成本高）；release 自动化（手工触发）

  **Recommended Agent Profile**: `quick`
  - YAML 配置

  **Parallelization**: Wave 11（依赖所有前置 Phase）
  - **Blocks**: 无
  - **Blocked By**: Task 24（ESLint）、Task 25（Vitest）、Task 48（build 配置稳定）

  **References**:
  - GitHub Actions 文档

  **Acceptance Criteria**:
  - [ ] `.github/workflows/ci.yml` 存在
  - [ ] CI 包含 lint + typecheck + test + build 四个 job

  **QA Scenarios**:
  ```
  Scenario: CI 工作流文件语法正确
    Tool: Bash
    Steps:
      1. cat .github/workflows/ci.yml | head -5
    Expected Result: 有效的 YAML 工作流定义
    Evidence: .sisyphus/evidence/task-50-ci-workflow.txt
  ```

  **Commit**: YES
  - Message: `ci: 添加 GitHub Actions CI（lint + typecheck + test + build）`
  - Files: `.github/workflows/ci.yml`

### Phase 9: 依赖升级（LAST — 最高风险）

- [ ] 51. 升级 Vite（5→6→7→8 增量）

  **What to do**:
  - **Step 1**: 升级 Vite 5→6：`npm i -D vite@^6.0.0 @vitejs/plugin-react@^5.0.0`
    - 验证：`npm run dev` + `npm run build` + `npm run electron:dev`
  - **Step 2**: 升级 Vite 6→7：`npm i -D vite@^7.0.0 @vitejs/plugin-react@^6.0.0`
    - 检查 breaking changes 文档
  - **Step 3**: 升级到 latest stable
  - 每一步提交前验证
  - **Must NOT do**: 与 Electron 升级同步骤

  **Recommended Agent Profile**: `deep`
  - 多步升级，需要仔细验证

  **Parallelization**: Wave 12（依赖所有前置 Phase，增量串行）
  - **Blocks**: Task 52-53
  - **Blocked By**: Task 48（chunk splitting 在升级前已配置并验证）

  **References**:
  - Vite migration guide
  - `vite.config.ts` — 当前配置

  **Acceptance Criteria**:
  - [ ] Vite 升级到最新稳定版
  - [ ] `npm run dev` + `npm run build` + `npm run electron:dev` 全部通过

  **Commit**: YES（每个升级步一个 commit）
  - Message: `build: 升级 Vite 5→6` / `build: 升级 Vite 6→7` / `build: 升级 Vite 7→latest`

- [ ] 52. 升级 lucide-react（0→1 主版本）

  **What to do**:
  - 当前 `^0.400.0`，最新 `1.23.0`
  - 检查 breaking changes：
    - 图标名称可能变化（如 `HelpCircle` → `CircleHelp`）
    - 导入路径可能变化
  - 升级后逐文件验证导入
  - **Must NOT do**: 与 Vite 升级同步骤

  **Recommended Agent Profile**: `deep`
  - 需要全局搜索替换

  **Parallelization**: Wave 12
  - **Blocks**: 无
  - **Blocked By**: Task 51（Vite 升级优先）

  **References**:
  - lucide-react v1 migration guide
  - `src/` 中所有 lucide-react import

  **Acceptance Criteria**:
  - [ ] lucide-react 升级到 1.x
  - [ ] 所有图标正常渲染
  - [ ] `npx tsc --noEmit` 通过

  **Commit**: YES
  - Message: `build: 升级 lucide-react 0→1 主版本`
  - Files: `package.json`, 所有引用 lucide-react 的文件

- [ ] 53. 升级 Electron（31→43 增量）

  **What to do**:
  - **Step 1**: 检查 `better-sqlite3` 对目标 Electron 版本的兼容性
  - **Step 2**: 升级 Electron 31→33：验证 Dev 启动、窗口显示、IPC 通信、创作流程
  - **Step 3**: 升级 33→35：同验证
  - **Step 4**: 升级 35→37→39→41→43：增量
  - 每一步：`npx electron-rebuild` 重建原生模块
  - **Must NOT do**: 跳过版本（如 31→43 直接跳）
  - **Must NOT do**: 同时升级 Vite 或 lucide-react
  - **Must NOT do**: 在 macOS 上跳过 electron-rebuild

  **Recommended Agent Profile**: `deep`
  - 最高风险，多步验证

  **Parallelization**: Wave 12（最后执行，增量串行）
  - **Blocks**: 无
  - **Blocked By**: Task 50（CI 就绪）、Task 51-52（其他依赖已升级）

  **References**:
  - Electron Breaking Changes 文档（32-43 每个版本）
  - `electron/database.ts` — better-sqlite3 用法

  **Acceptance Criteria**:
  - [ ] Electron 升级到最新稳定版（或接近最新）
  - [ ] `npm run electron:dev` 窗口正常显示
  - [ ] 创建书籍 → 开始写作 → IPC 通信 → 章节保存 → 全部验证通过
  - [ ] `npm run dist:mac` 打包成功

  **Commit**: YES（每个升级步一个 commit）
  - Message: `build: 升级 Electron 31→33` / `build: 升级 Electron 33→35` / ...

---

## Final Verification Wave

- [ ] F1. **安全审计** — `oracle`
  搜索所有危险模式：`execSync` + 模板字面量、`shell: true`、`openPath` 无校验、`mkdirSync` 无路径校验、`fetch` 无 URL 白名单。验证每个修复已正确应用。
  Output: `execSync风险 [0/N] | shell:true [0/N] | openPath [N/N validated] | fetch [N/N validated]`

- [ ] F2. **类型与构建验证** — `unspecified-high`
  `npx tsc --noEmit -p tsconfig.json` + `npx tsc --noEmit -p electron/tsconfig.json` + `npm run build` + `npx eslint src/ electron/ --max-warnings 0`
  Output: `src types [PASS/FAIL] | electron types [PASS/FAIL] | build [PASS/FAIL] | lint [PASS/FAIL]`

- [ ] F3. **运行验证** — `unspecified-high`
  `npm run electron:dev` → 窗口显示 → 创建书籍 → 开始写作 → 验证快照更新 → 停止进程。
  验证 book list 加载、chapter 编辑、角色管理可访问。
  Output: `启动 [PASS/FAIL] | CRUD [PASS/FAIL] | 写作流程 [PASS/FAIL]`

- [ ] F4. **文件合规审计** — `deep`
  `find src/ -name "*.tsx" -exec wc -l {} \; | awk '$1 > 300'`、`grep -r "@ts-nocheck" electron/`、`grep -r "console.log" src/`、`grep -r "as any" src/`、`grep "style={{" src/ | wc -l`
  Output: `超限文件 [0/N] | @ts-nocheck [0/N] | console.log [0/N] | as any [0/N] | 内联样式 [N total]`

---

## Success Criteria

### Verification Commands
```bash
# 安全验证
grep -r "execSync" electron/ | grep -v "node_modules"  # 应只有安全用法（硬编码命令，无模板字面量）
grep -r "@ts-nocheck" electron/  # 应返回空

# 类型验证
npx tsc --noEmit -p tsconfig.json         # exit 0
npx tsc --noEmit -p electron/tsconfig.json # exit 0

# 代码质量
npx eslint src/ electron/ --max-warnings 0  # exit 0
find src/ -name "*.tsx" -exec wc -l {} \; | awk '$1 > 300'  # 应返回空

# 测试
npx vitest run  # exit 0, ≥10 tests pass

# 构建
npm run build   # exit 0, dist/assets/ 有多个 JS chunk
```

### Final Checklist
- [ ] 所有 9+ 安全漏洞已修复
- [ ] electron/ @ts-nocheck 清零
- [ ] 类型检查全部通过
- [ ] ≥10 个自动化测试通过
- [ ] ESLint 0 warnings
- [ ] 所有 .tsx 文件 ≤300 行
- [ ] 内联样式减少 50%+
- [ ] CI 自动运行
- [ ] npm run electron:dev 启动正常
