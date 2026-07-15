import { create } from 'zustand'
import type { UISnapshot, EventItem, ChapterInfo } from '@/types'
import type { ElectronAPI } from '@/shared/ipc'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
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

export interface BookState {
  activeBookId: string
  snapshot: UISnapshot
  events: EventItem[]
  chapters: ChapterInfo[]
  chapterContent: string

  setActiveBookId: (bookId: string) => void
  refreshSnapshot: () => Promise<void>
  refreshEvents: () => Promise<void>
  refreshChapters: () => Promise<void>
  clearEvents: () => void
  setChapterContent: (content: string) => void
}

export const useBookStore = create<BookState>((set) => ({
  activeBookId: '',
  snapshot: emptySnapshot,
  events: [],
  chapters: [],
  chapterContent: '',

  setActiveBookId: (activeBookId) => {
    const prev = useBookStore.getState().activeBookId
    // 切书：立刻清空界面态，避免闪现上一本数据
    if (prev && prev !== activeBookId) {
      set({
        activeBookId,
        snapshot: emptySnapshot,
        events: [],
        chapters: [],
        chapterContent: '',
      })
    } else {
      set({ activeBookId })
    }
  },

  refreshSnapshot: async () => {
    const api = window.electronAPI
    if (!api) return
    const activeBookId = useBookStore.getState().activeBookId
    const snapshot = await api.getSnapshot(activeBookId || undefined)
    // 异步返回时若已切到别的书，丢弃结果
    if (useBookStore.getState().activeBookId !== activeBookId) return
    set({ snapshot })
  },

  refreshEvents: async () => {
    const api = window.electronAPI
    if (!api) return
    const activeBookId = useBookStore.getState().activeBookId
    const events = await api.getEvents(activeBookId || undefined)
    if (useBookStore.getState().activeBookId !== activeBookId) return
    set({ events })
  },

  refreshChapters: async () => {
    const api = window.electronAPI
    if (!api) return
    const activeBookId = useBookStore.getState().activeBookId
    const chapters = await api.listChapters(activeBookId || undefined)
    if (useBookStore.getState().activeBookId !== activeBookId) return
    set({ chapters })
  },

  setChapterContent: (chapterContent) => set({ chapterContent }),

  clearEvents: async () => {
    // 仅清前端展示，不清后端全局事件（可能属于正在写的另一本书）
    set({ events: [] })
  },
}))
