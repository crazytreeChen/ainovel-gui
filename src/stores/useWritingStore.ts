import { create } from 'zustand'
import { useUIStore } from './useUIStore'
import type { ElectronAPI } from '@/shared/ipc'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export interface WritingState {
  streamOutput: { type: string; text: string }[]
  inputHistory: string[]

  startWriting: (prompt: string, bookId?: string) => Promise<boolean>
  resumeWriting: (bookId: string) => Promise<boolean>
  sendInput: (text: string) => Promise<boolean>
  pauseWriting: () => Promise<boolean>
  stopWriting: () => Promise<boolean>
  runDiag: () => Promise<void>
  runExport: (bookId: string, args: string) => Promise<void>
  appendStreamOutput: (text: { type: string; text: string } | string) => void
  clearStreamOutput: () => void
  pushToHistory: (text: string) => void
}

export const useWritingStore = create<WritingState>((set, get) => ({
  streamOutput: [],
  inputHistory: [],

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
    if (!api) return false
    try {
      useUIStore.getState().setMode('running')
      useUIStore.getState().setError(null)
      const result = await api.startWriting(prompt, bookId)
      return result
    } catch (e: any) {
      useUIStore.getState().setError(e.message)
      useUIStore.getState().setMode('welcome')
      return false
    }
  },

  resumeWriting: async (bookId) => {
    const api = window.electronAPI
    if (!api) return false
    try {
      useUIStore.getState().setMode('running')
      useUIStore.getState().setError(null)
      const result = await api.resumeWriting(bookId)
      return result
    } catch (e: any) {
      useUIStore.getState().setError(e.message)
      useUIStore.getState().setMode('welcome')
      return false
    }
  },

  sendInput: async (text) => {
    const api = window.electronAPI
    if (!api) return false
    get().pushToHistory(text)
    return api.sendInput(text)
  },

  pauseWriting: async () => {
    const api = window.electronAPI
    if (!api) return false
    return api.pauseWriting()
  },

  stopWriting: async () => {
    const api = window.electronAPI
    if (!api) return false
    await api.stopWriting()
    useUIStore.getState().setMode('welcome')
    return true
  },

  runDiag: async () => {
    const api = window.electronAPI
    if (!api) return
    const result = await api.runDiag()
    const report = await api.readDiagReport()
    useUIStore.getState().setDiagReport(report || result)
    useUIStore.getState().toggleDiagnostics()
  },

  runExport: async (bookId, args) => {
    const api = window.electronAPI
    if (!api) return
    useUIStore.getState().toggleExport()
    await api.runExport(bookId, args)
  },
}))
