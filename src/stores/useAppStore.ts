import { create } from 'zustand'
import type { UISnapshot, EventItem, AppMode, StartupMode, FocusPane, BinaryInfo, ChapterInfo } from '@/types'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ToastItem {
  id: number
  message: string
  type: 'error' | 'success' | 'info'
}

// 声明 electron API 类型
declare global {
  interface Window {
    electronAPI: {
      // 书籍管理
      listBooks: () => Promise<any[]>
      createBook: (name: string, style: string, phase?: string, premise?: string, tags?: string) => Promise<any>
      deleteBook: (id: string) => Promise<boolean>
      getBookDir: (id: string) => Promise<string | null>
      getGuiDataDir: () => Promise<string>

      // 大纲
      getBookOutline: (id: string) => Promise<any>
      saveBookOutline: (id: string, data: any) => Promise<boolean>

      // 章节
      getBookChapters: (id: string) => Promise<any[]>
      getBookChapter: (id: string, num: number) => Promise<any>
      saveBookChapter: (id: string, num: number, content: string) => Promise<boolean>

      // 角色
      getBookCharacters: (id: string) => Promise<any[]>
      saveBookCharacters: (id: string, chars: any[]) => Promise<boolean>

      // 配角名册
      getBookCast: (id: string) => Promise<any[]>
      saveBookCast: (id: string, entries: any[]) => Promise<boolean>

      // 时间线
      getBookTimeline: (id: string) => Promise<any>

      // 评审
      getBookReviews: (id: string) => Promise<any[]>

      // 封面
      selectCoverImage: () => Promise<string | null>
      saveBookCover: (id: string, imagePath: string) => Promise<boolean>
      getBookCover: (id: string) => Promise<string | null>

      // 仿写画像
      getSimulationProfile: (id: string) => Promise<any>
      saveSimulationProfile: (id: string, profile: any) => Promise<boolean>

      // 用户规则
      getUserRules: (id: string) => Promise<any>
      saveUserRules: (id: string, rules: any) => Promise<boolean>

      // 模型
      fetchModels: (baseUrl: string, apiKey: string, protocol: string) => Promise<{ models?: string[]; error?: string }>
      loadProviderConfig: () => Promise<any>
      saveProviderConfig: (config: any) => Promise<boolean>

      getSnapshot: () => Promise<UISnapshot>
      getEvents: () => Promise<EventItem[]>
      readChapter: (chapterNum: number) => Promise<string>
      listChapters: () => Promise<ChapterInfo[]>
      startWriting: (prompt: string, bookId?: string) => Promise<boolean>
      resumeWriting: (bookId: string) => Promise<boolean>
      sendInput: (text: string) => Promise<boolean>
      pauseWriting: () => Promise<boolean>
      stopWriting: () => Promise<boolean>
      runDiag: () => Promise<string>
      readDiagReport: () => Promise<string>
      runSimulate: (bookId: string) => Promise<string>
      runExport: (args: string) => Promise<string>
      selectDirectory: () => Promise<string | null>
      scanWorkspace: (dir: string) => Promise<any>
      importWorkspace: (dir: string) => Promise<any>
      setDirectory: (dir: string) => Promise<boolean>
      getDirectory: () => Promise<string>
      openDirectory: (dir: string) => Promise<void>
      checkBinary: () => Promise<BinaryInfo>

      // 世界观/风格规则
      getWorldRules: (id: string) => Promise<any[]>
      saveWorldRules: (id: string, rules: any[]) => Promise<boolean>
      getStyleRules: (id: string) => Promise<any>
      saveStyleRules: (id: string, rules: any) => Promise<boolean>

      // 运行元信息/用量
      getRunMeta: (id: string) => Promise<any>
      saveRunMeta: (id: string, meta: any) => Promise<boolean>
      getUsageStats: (id: string) => Promise<any>
      saveUsageStats: (id: string, stats: any) => Promise<boolean>

      // 书籍编辑
      updateBook: (id: string, fields: any) => Promise<boolean>

      // 摘要管理
      getBookSummaries: (id: string) => Promise<any[]>
      saveBookSummaries: (id: string, summaries: any[]) => Promise<boolean>

      // 用户指令
      getUserDirectives: (id: string) => Promise<any[]>
      saveUserDirectives: (id: string, directives: any[]) => Promise<boolean>

      // 自动更新
      checkUpdate: () => Promise<any>
      downloadUpdate: (url: string, sha256: string) => Promise<any>
      installUpdate: (filePath: string) => Promise<any>
      onDownloadProgress: (callback: (data: any) => void) => () => void

      onProcessExited: (callback: () => void) => () => void
      onSnapshotUpdate: (callback: (data: any) => void) => () => void
      onStreamOutput: (callback: (data: string) => void) => () => void
    }
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
