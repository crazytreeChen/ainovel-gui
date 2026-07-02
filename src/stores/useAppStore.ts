import { create } from 'zustand'
import { useUIStore, type UIState, type ThemeMode, type ToastItem } from './useUIStore'
import { useBookStore, type BookState } from './useBookStore'
import { useWritingStore, type WritingState } from './useWritingStore'
import type { ElectronAPI } from '@/shared/ipc'

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export type { ThemeMode, ToastItem }

export type AppState = UIState & BookState & WritingState

export const useAppStore = create<AppState>((set) => {
  const combined = (): AppState => ({
    ...useUIStore.getState(),
    ...useBookStore.getState(),
    ...useWritingStore.getState(),
  })

  const unsubUI = useUIStore.subscribe(() => set(combined()))
  const unsubBook = useBookStore.subscribe(() => set(combined()))
  const unsubWriting = useWritingStore.subscribe(() => set(combined()))

  return combined()
})
