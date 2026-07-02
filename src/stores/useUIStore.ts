import { create } from 'zustand'
import type { AppMode, StartupMode, FocusPane, BinaryInfo } from '@/types'
import type { ElectronAPI } from '@/shared/ipc'

export type ThemeMode = 'light' | 'dark' | 'system'

export interface ToastItem {
  id: number
  message: string
  type: 'error' | 'success' | 'info'
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export interface UIState {
  mode: AppMode
  startupMode: StartupMode
  focusPane: FocusPane
  workingDir: string
  binaryInfo: BinaryInfo | null
  theme: ThemeMode

  showHelp: boolean
  showModelSwitch: boolean
  showDiagnostics: boolean
  showCoCreate: boolean
  showImport: boolean
  showExport: boolean
  diagReport: string

  inputValue: string
  placeholderText: string

  error: string | null
  toasts: ToastItem[]

  setMode: (mode: AppMode) => void
  setStartupMode: (mode: StartupMode) => void
  setFocusPane: (pane: FocusPane) => void
  setWorkingDir: (dir: string) => void
  setBinaryInfo: (info: BinaryInfo | null) => void
  setInputValue: (value: string) => void
  setError: (err: string | null) => void
  toggleHelp: () => void
  toggleModelSwitch: () => void
  toggleDiagnostics: () => void
  toggleCoCreate: () => void
  toggleImport: () => void
  toggleExport: () => void
  setDiagReport: (report: string) => void
  setTheme: (theme: ThemeMode) => void
  addToast: (t: ToastItem) => void
  removeToast: (id: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  mode: 'welcome',
  startupMode: 'quick',
  focusPane: 'events',
  workingDir: '',
  binaryInfo: null,
  theme: (typeof window !== 'undefined' && localStorage.getItem('ainovel-theme')) as ThemeMode || 'dark',
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

  setMode: (mode) => set({ mode }),
  setStartupMode: (startupMode) => set({ startupMode }),
  setFocusPane: (focusPane) => set({ focusPane }),
  setWorkingDir: (workingDir) => set({ workingDir }),
  setBinaryInfo: (binaryInfo) => set({ binaryInfo }),
  setInputValue: (inputValue) => set({ inputValue }),
  setError: (error) => set({ error }),
  toggleHelp: () => set((s) => ({ showHelp: !s.showHelp })),
  toggleModelSwitch: () => set((s) => ({ showModelSwitch: !s.showModelSwitch })),
  toggleDiagnostics: () => set((s) => ({ showDiagnostics: !s.showDiagnostics })),
  toggleCoCreate: () => set((s) => ({ showCoCreate: !s.showCoCreate })),
  toggleImport: () => set((s) => ({ showImport: !s.showImport })),
  toggleExport: () => set((s) => ({ showExport: !s.showExport })),
  setDiagReport: (diagReport) => set({ diagReport }),
  setTheme: (theme) => { localStorage.setItem('ainovel-theme', theme); set({ theme }) },
  addToast: (t) => set((s) => ({ toasts: [...s.toasts, t] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}))
