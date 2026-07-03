/**
 * useAppStore 基础测试 — 验证 store actions
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '@/stores/useAppStore'

// mock localStorage for setTheme action
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

beforeEach(() => {
  localStorageMock.clear()
  useAppStore.setState({
    mode: 'welcome' as const,
    startupMode: 'quick' as const,
    theme: 'dark' as const,
    error: null,
  })
})

describe('useAppStore', () => {
  it('should have correct initial mode', () => {
    const state = useAppStore.getState()
    expect(state.mode).toBe('welcome')
  })

  it('should have correct initial theme', () => {
    const state = useAppStore.getState()
    expect(['dark', 'light', 'system']).toContain(state.theme)
  })

  it('should allow setting mode', () => {
    useAppStore.getState().setMode('running')
    expect(useAppStore.getState().mode).toBe('running')
  })

  it('should allow setting theme', () => {
    useAppStore.getState().setTheme('light')
    expect(useAppStore.getState().theme).toBe('light')
  })

  it('should add and remove toasts', () => {
    const store = useAppStore.getState()
    store.addToast({ id: 1, message: 'test', type: 'info' })
    expect(useAppStore.getState().toasts).toHaveLength(1)
    useAppStore.getState().removeToast(1)
    expect(useAppStore.getState().toasts).toHaveLength(0)
  })
})
