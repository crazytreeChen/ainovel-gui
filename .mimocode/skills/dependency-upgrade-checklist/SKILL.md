---
name: dependency-upgrade-checklist
description: >
  CJS/ESM 混合 Electron 项目依赖升级检查清单。覆盖 vitest/Vite/Electron 等关键依赖
  升级时的常见陷阱和修复步骤。适用于升级 npm 依赖后遇到构建/类型/Lint 错误的场景。
  触发词：依赖升级、升级依赖、npm upgrade、ESM CJS 兼容、构建失败、typecheck 报错。
user_invocable: true
argument_hint: "[可选：指定要升级的包名，如 vitest 或 electron]"
---

# Dependency Upgrade Checklist

CJS/ESM 混合 Electron 项目的依赖升级检查清单。

## 前置条件

- 项目根目录无 `"type": "module"`（Electron 主进程是 CJS）
- `electron/tsconfig.json` 使用 `"module": "commonjs"`
- `tsconfig.json`（renderer）使用 `"module": "ESNext"`

## Checklist

### 1. 升级前快照

```bash
git stash  # 或 git commit 当前状态
npm ls --depth=0  # 记录当前依赖版本
```

### 2. 执行升级

```bash
npm install <package>@<version> --save-dev
# 或批量升级
npm update
```

### 3. 类型检查

```bash
npm run typecheck  # tsc -p tsconfig.json --noEmit
npx tsc -p electron/tsconfig.json --noEmit  # electron 主进程
```

**常见错误及修复**：

| 错误 | 原因 | 修复 |
|------|------|------|
| `Cannot find module 'vitest'` | vitest 未安装或版本不兼容 | `npm install vitest@^1.6.0 --save-dev` |
| `Property 'resourcesPath' does not exist` | `@types/electron` 冲突 | `npm uninstall @types/electron`（Electron 5+ 自带类型） |
| `Cannot find namespace 'Electron'` | electron 类型未正确引入 | 检查 `electron/tsconfig.json` 的 `types` 配置 |
| `DEFAULT_OPTIONS possibly undefined` | `Required<>` 类型断言缺失 | 显式标注 `Required<T>` 类型 |

### 4. 构建验证

```bash
npm run build:renderer  # Vite renderer 构建
npm run build:electron  # tsc electron 主进程
npm run build:cli       # Go 子模块编译
npm run build           # 完整构建
```

### 5. ESLint 验证

```bash
npx eslint src/ electron/ --ext .ts,.tsx --max-warnings 0
```

**注意**：CI 中 `npx eslint` 需加 `--ext .ts,.tsx`，否则 flat config 找不到文件。

### 6. 运行时验证

```bash
npm run electron:dev  # 启动开发模式
# 验证：窗口正常显示 → IPC 通信正常 → 数据库连接正常
```

### 7. CJS/ESM 兼容性检查

如果升级引入了 `type: module` 相关变更：

- **不要**在 `package.json` 添加 `"type": "module"`（会导致 CJS 脚本失败）
- `scripts/*.js` 需重命名为 `*.cjs`
- `package.json` 中所有 `node scripts/xxx.js` 引用需同步更新为 `.cjs`
- `dist-electron/` 输出是 CJS，不需要额外处理

### 8. 跨平台构建检查

```bash
# 检查 build-cli.cjs 中的路径处理
# Windows 路径必须用 JSON.stringify() 包裹
# chmod 只在 process.platform !== 'win32' 时执行
```

### 9. 提交

```bash
git add -A
git diff --cached --stat  # 确认变更范围
git commit -m "fix: 依赖升级 — {摘要}"
```

## Gotchas Reference

详见 `AGENTS.md` → `## Gotchas` 章节，包含：
- ESM/CJS 混合项目陷阱
- ESLint 9 迁移要点
- 跨平台构建注意事项
- 版本号管理规则

## Notes

- 本 skill 基于 ainovel-gui 项目的实际升级经验（Electron 31→41, Vite 5→8, vitest 1→2）
- 升级后务必同时验证 renderer + electron + cli 三个构建目标
- 如果升级导致 `npm install` 的 postinstall 失败，先 `npm ci --ignore-scripts` 再手动构建
