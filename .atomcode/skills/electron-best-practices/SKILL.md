---
name: electron-best-practices
description: Electron 最佳实践 — ainovel-gui 项目的 Electron 主进程安全与架构指南
---

# Electron Best Practices

指导 AtomCode 在编写/修改 Electron 主进程代码时遵循的安全与架构实践。

## 安全规则

### 1. Preload 隔离
- 始终使用 `contextBridge.exposeInMainWorld` 暴露 API
- 不在渲染进程直接使用 `require('electron')` 或 `remote`
- preload 中暴露的函数应尽可能窄，只暴露必要能力

### 2. IPC 通信
- 使用 `ipcMain.handle` / `ipcRenderer.invoke`（而非 `send`/`on`）
- 所有 handler 参数应在主进程侧做类型校验
- 渲染进程不应直接传递文件路径，优先通过 `dialog.showOpenDialog`

### 3. 子进程安全
- spawn 时始终设置 `shell: false`
- 二进制路径必须通过 `validatePath` 校验
- 传递 CLI 参数时避免拼接用户输入

### 4. 路径校验
```typescript
const { validatePath } = require('../path-validator')
const safePath = validatePath(inputPath)
```
