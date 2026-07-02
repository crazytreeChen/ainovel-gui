import { create } from 'zustand'
import type { UISnapshot, EventItem, AppMode, StartupMode, FocusPane, BinaryInfo, ChapterInfo } from '@/types'
import type { ElectronAPI } from '@/shared/ipc'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ToastItem {
  id: number
  message: string
  type: 'error' | 'success' | 'info'
}

// 声明 electron API 类型（从共享合约导入）
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

interface AppState {
  // 应用状态
  mode: AppMode
  startupMode: StartupMode
  focusPane: FocusPane
  workingDir: string
  binaryInfo: BinaryInfo | null
  theme: ThemeMode

  // 数据
  snapshot: UISnapshot
  events: EventItem[]
  chapters: ChapterInfo[]
  chapterContent: string
  streamOutput: { type: string; text: string }[]
  inputHistory: string[]

  // 模态框
  showHelp: boolean
  showModelSwitch: boolean
  showDiagnostics: boolean
  showCoCreate: boolean
  showImport: boolean
  showExport: boolean
  diagReport: string

  // 输入
  inputValue: string
  placeholderText: string

  // 错误
  error: string | null
  toasts: ToastItem[]

  // Actions
  setMode: (mode: AppMode) => void
  setStartupMode: (mode: StartupMode) => void
  setFocusPane: (pane: FocusPane) => void
  setWorkingDir: (dir: string) => void
  setBinaryInfo: (info: BinaryInfo | null) => void
  setInputValue: (value: string) => void
  appendStreamOutput: (text: { type: string; text: string } | string) => void
  clearStreamOutput: () => void
  pushToHistory: (text: string) => void
  setError: (err: string | null) => void
  toggleHelp: () => void
  toggleModelSwitch: () => void
  toggleDiagnostics: () => void
  toggleCoCreate: () => void
  toggleImport: () => void
  toggleExport: () => void
  setDiagReport: (report: string) => void
  setChapterContent: (content: string) => void
  setTheme: (theme: ThemeMode) => void

  // 数据加载
  refreshSnapshot: () => Promise<void>
  refreshEvents: () => Promise<void>
  refreshChapters: () => Promise<void>

  // 创作控制
  startWriting: (prompt: string, bookId?: string) => Promise<boolean>
  resumeWriting: (bookId: string) => Promise<boolean>
  sendInput: (text: string) => Promise<boolean>
  pauseWriting: () => Promise<boolean>
  stopWriting: () => Promise<boolean>

  // 诊断
  runDiag: () => Promise<void>

  // 导出
  runExport: (args: string) => Promise<void>

  // Toast
  addToast: (t: ToastItem) => void
  removeToast: (id: number) => void
}

const emptySnapshot: UISnapshot = {
  novelName: '',
  provider: '',
  modelName: '',
  style: '',
  phase: 'init',
  flow: '',
  runtimeState: 'idle',
  isRunning: false,
  completedCount: 0,
  totalChapters: 0,
  totalWordCount: 0,
  inProgressChapter: 0,
  currentChapter: 0,
  pendingRewrites: [],
  rewriteReason: '',
  layered: false,
  currentVolumeArc: '',
  premise: '',
  outline: [],
  totalOutlineCount: 0,
  characters: [],
  compassDirection: '',
  compassScale: '',
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCostUSD: 0,
  totalSavedUSD: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  contextPercent: 0,
  contextTokens: 0,
  contextWindow: 0,
  lastCommitSummary: '',
  lastReviewSummary: '',
  pendingSteer: '',
  statusLabel: 'READY',
  agents: [],
  recentSummaries: [],
}

export const useAppStore = create<AppState>((set, get) => ({
  // 初始状态
  mode: 'welcome',
  startupMode: 'quick',
  focusPane: 'events',
  workingDir: '',
  binaryInfo: null,
  theme: (typeof window !== 'undefined' && localStorage.getItem('ainovel-theme')) as ThemeMode || 'dark',
  snapshot: emptySnapshot,
  events: [],
  chapters: [],
  chapterContent: '',
  streamOutput: [],
  inputHistory: [],
  showHelp: false,
  showModelSwitch: false,
  showDiagnostics: false,
  showCoCreate: false,
  showImport: false,
  showExport: false,
  diagReport: '',
  inputValue: '',
  placeholderText: '输入小说需求开始创作...',
  error: null,
  toasts: [],

  // Actions
  setMode: (mode) => set({ mode }),
  setStartupMode: (startupMode) => set({ startupMode }),
  setFocusPane: (focusPane) => set({ focusPane }),
  setWorkingDir: (workingDir) => set({ workingDir }),
  setBinaryInfo: (binaryInfo) => set({ binaryInfo }),
  setInputValue: (inputValue) => set({ inputValue }),
  appendStreamOutput: (text) => set((s) => {
    const entry = typeof text === 'string' ? {type: 'content', text} : text
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
  setError: (error) => set({ error }),
  toggleHelp: () => set((s) => ({ showHelp: !s.showHelp })),
  toggleModelSwitch: () => set((s) => ({ showModelSwitch: !s.showModelSwitch })),
  toggleDiagnostics: () => set((s) => ({ showDiagnostics: !s.showDiagnostics })),
  toggleCoCreate: () => set((s) => ({ showCoCreate: !s.showCoCreate })),
  toggleImport: () => set((s) => ({ showImport: !s.showImport })),
  toggleExport: () => set((s) => ({ showExport: !s.showExport })),
  setDiagReport: (diagReport) => set({ diagReport }),
  setChapterContent: (chapterContent) => set({ chapterContent }),
  setTheme: (theme) => { localStorage.setItem('ainovel-theme', theme); set({ theme }) },

  refreshSnapshot: async () => {
    const api = window.electronAPI
    if (!api) return
    const snapshot = await api.getSnapshot()
    set({ snapshot })
  },

  refreshEvents: async () => {
    const api = window.electronAPI
    if (!api) return
    const events = await api.getEvents()
    set({ events })
  },

  refreshChapters: async () => {
    const api = window.electronAPI
    if (!api) return
    const chapters = await api.listChapters()
    set({ chapters })
  },

  startWriting: async (prompt, bookId) => {
    const api = window.electronAPI
    if (!api) return false
    try {
      set({ mode: 'running', error: null })
      const result = await api.startWriting(prompt, bookId)
      return result
    } catch (e: any) {
      set({ error: e.message, mode: 'welcome' })
      return false
    }
  },

  resumeWriting: async (bookId) => {
    const api = window.electronAPI
    if (!api) return false
    try {
      set({ mode: 'running', error: null })
      const result = await api.resumeWriting(bookId)
      return result
    } catch (e: any) {
      set({ error: e.message, mode: 'welcome' })
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
    set({ mode: 'welcome' })
    return true
  },

  runDiag: async () => {
    const api = window.electronAPI
    if (!api) return
    const result = await api.runDiag()
    const report = await api.readDiagReport()
    set({ diagReport: report || result, showDiagnostics: true })
  },

  runExport: async (args) => {
    const api = window.electronAPI
    if (!api) return
    set({ showExport: false })
    await api.runExport(args)
  },

  addToast: (t) => set((s) => ({ toasts: [...s.toasts, t] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
