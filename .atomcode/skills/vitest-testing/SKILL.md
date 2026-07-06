---
name: vitest-testing
description: Vitest 测试指南 — 为 ainovel-gui 项目编写 Vitest 单元测试
---

# Vitest Testing

为 ainovel-gui 项目编写 Vitest 单元测试的指南。

## 项目配置

测试工具：Vitest + @testing-library/react
测试文件位置：`src/__tests__/`

已有测试文件：
- `src/__tests__/types.test.ts`
- `src/__tests__/store.test.ts`

## 编写测试

### Store 测试
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '@/stores/useUIStore'

describe('useUIStore', () => {
  beforeEach(() => {
    useUIStore.setState({ showExport: false })
  })

  it('toggleExport 切换导出模态框状态', () => {
    expect(useUIStore.getState().showExport).toBe(false)
    useUIStore.getState().toggleExport()
    expect(useUIStore.getState().showExport).toBe(true)
  })
})
```

### IPC 模拟
```typescript
import { vi } from 'vitest'

// Mock Electron API
window.electronAPI = {
  runExport: vi.fn(),
  listBooks: vi.fn(),
  // ... 其他方法
} as any
```
