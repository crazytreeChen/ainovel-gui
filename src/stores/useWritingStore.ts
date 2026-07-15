import { create } from 'zustand'
import { useUIStore } from './useUIStore'
import type { ElectronAPI } from '@/shared/ipc'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export type WritingOpResult = { ok: boolean; error?: string }

export interface WritingState {
  streamOutput: { type: string; text: string }[]
  inputHistory: string[]
  starting: boolean

  startWriting: (prompt: string, bookId?: string) => Promise<WritingOpResult>
  resumeWriting: (bookId: string) => Promise<WritingOpResult>
  confirmContinueWriting: (bookId: string) => Promise<WritingOpResult>
  sendInput: (text: string, bookId?: string) => Promise<boolean>
  pauseWriting: () => Promise<boolean>
  stopWriting: () => Promise<boolean>
  runDiag: () => Promise<void>
  runExport: (bookId: string, args: string) => Promise<void>
  appendStreamOutput: (text: { type: string; text: string } | string) => void
  clearStreamOutput: () => void
  pushToHistory: (text: string) => void
}

function normalizeResult(result: any, fallback: string): WritingOpResult {
  if (result && typeof result === 'object' && 'ok' in result) {
    return { ok: !!result.ok, error: result.error }
  }
  // 兼容旧 boolean 返回（理论上已不走）
  if (result === true) return { ok: true }
  return { ok: false, error: fallback }
}

export const useWritingStore = create<WritingState>((set, get) => ({
  streamOutput: [],
  inputHistory: [],
  starting: false,

  appendStreamOutput: (text) => set((s) => {
    const entry = typeof text === 'string' ? { type: 'content', text } : text
    const prev = s.streamOutput
    if (prev.length === 0) return { streamOutput: [entry] }
    const last = prev[prev.length - 1]
    if (last.type === entry.type && last.text.length < 5000) {
      prev[prev.length - 1] = { type: last.type, text: last.text + entry.text }
      return { streamOutput: [...prev] }
    }
    return { streamOutput: [...prev, entry] }
  }),

  clearStreamOutput: () => set({ streamOutput: [] }),

  pushToHistory: (text) => set((s) => ({
    inputHistory: [...s.inputHistory.slice(-199), text],
  })),

  startWriting: async (prompt, bookId) => {
    const api = window.electronAPI
    if (!api) return { ok: false, error: 'Electron API 不可用' }
    if (get().starting) return { ok: false, error: '正在启动中，请勿重复操作' }
    try {
      set({ starting: true })
      useUIStore.getState().setMode('running')
      useUIStore.getState().setError(null)
      const result = normalizeResult(await api.startWriting(prompt, bookId), '启动失败')
      if (!result.ok) {
        useUIStore.getState().setError(result.error || '启动失败')
        useUIStore.getState().setMode(bookId ? 'idle' : 'welcome')
        useUIStore.getState().addToast({
          id: Date.now(),
          message: result.error || '启动失败',
          type: 'error',
        })
      }
      return result
    } catch (e: any) {
      useUIStore.getState().setError(e.message)
      useUIStore.getState().setMode(bookId ? 'idle' : 'welcome')
      useUIStore.getState().addToast({ id: Date.now(), message: e.message || '启动异常', type: 'error' })
      return { ok: false, error: e.message || '启动异常' }
    } finally {
      set({ starting: false })
    }
  },

  resumeWriting: async (bookId) => {
    const api = window.electronAPI
    if (!api) return { ok: false, error: 'Electron API 不可用' }
    if (get().starting) return { ok: false, error: '正在启动中，请勿重复操作' }
    try {
      set({ starting: true })
      useUIStore.getState().setMode('running')
      useUIStore.getState().setError(null)
      const result = normalizeResult(await api.resumeWriting(bookId), '恢复失败')
      if (!result.ok) {
        useUIStore.getState().setError(result.error || '恢复失败')
        useUIStore.getState().setMode('idle')
        useUIStore.getState().addToast({
          id: Date.now(),
          message: result.error || '恢复失败',
          type: 'error',
        })
      }
      return result
    } catch (e: any) {
      useUIStore.getState().setError(e.message)
      useUIStore.getState().setMode('idle')
      useUIStore.getState().addToast({ id: Date.now(), message: e.message || '恢复异常', type: 'error' })
      return { ok: false, error: e.message || '恢复异常' }
    } finally {
      set({ starting: false })
    }
  },

  sendInput: async (text, bookId) => {
    const api = window.electronAPI
    if (!api) return false
    get().pushToHistory(text)
    const ok = await api.sendInput(text, bookId)
    if (!ok) {
      useUIStore.getState().addToast({
        id: Date.now(),
        message: '发送失败：未找到当前书籍或创作引擎不可用',
        type: 'error',
      })
    }
    return ok
  },

  pauseWriting: async () => {
    const api = window.electronAPI
    if (!api) return false
    const result = await api.pauseWriting()
    useUIStore.getState().setMode('paused')
    return result
  },

  stopWriting: async () => {
    const api = window.electronAPI
    if (!api) return false
    await api.stopWriting()
    useUIStore.getState().setMode('idle')
    return true
  },

  confirmContinueWriting: async (bookId) => {
    const api = window.electronAPI
    if (!api) return { ok: false, error: 'Electron API 不可用' }
    if (get().starting) return { ok: false, error: '正在启动中，请勿重复操作' }
    try {
      set({ starting: true })
      useUIStore.getState().setMode('running')
      useUIStore.getState().setError(null)
      const result = normalizeResult(await api.confirmContinueWriting(bookId), '继续失败')
      if (!result.ok) {
        useUIStore.getState().setMode('idle')
        useUIStore.getState().addToast({
          id: Date.now(),
          message: result.error || '继续失败',
          type: 'error',
        })
      }
      return result
    } catch (e: any) {
      useUIStore.getState().setError(e.message)
      useUIStore.getState().setMode('idle')
      return { ok: false, error: e.message || '继续异常' }
    } finally {
      set({ starting: false })
    }
  },

  runDiag: async () => {
    const api = window.electronAPI
    if (!api) return
    const result = await api.runDiag()
    const report = await api.readDiagReport()
    useUIStore.getState().setDiagReport(report || result)
    useUIStore.getState().pushModal('diagnostics')
  },

  runExport: async (bookId, args) => {
    const api = window.electronAPI
    if (!api) return
    useUIStore.getState().pushModal('export', { id: bookId })
    await api.runExport(bookId, args)
  },
}))
