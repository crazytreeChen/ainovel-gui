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

  setActiveBookId: (activeBookId) => set({ activeBookId }),

  refreshSnapshot: async () => {
    const api = window.electronAPI
    if (!api) return
    const activeBookId = useBookStore.getState().activeBookId
    const snapshot = await api.getSnapshot(activeBookId || undefined)
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

  setChapterContent: (chapterContent) => set({ chapterContent }),

  clearEvents: async () => {
    const api = window.electronAPI
    if (api?.clearEvents) await api.clearEvents()
    set({ events: [] })
  },
}))
