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
export { useUIStore, useBookStore, useWritingStore }

export type AppState = UIState & BookState

/**
 * 合并 store — 向后兼容的单一入口。
 *
 * 注意：useWritingStore 的高频数据（streamOutput/events）
 * 应直接使用 useWritingStore 避免每 token 全量重建。
 *
 * ✅ 推荐用法：
 *   const mode = useAppStore(s => s.mode)            // UI 状态
 *   const events = useWritingStore(s => s.events)    // 高频写作状态
 */
export const useAppStore = create<AppState>((set, get) => {
  // 仅合并低频变化的子 store
  const sync = () => set({
    ...useUIStore.getState(),
    ...useBookStore.getState(),
  })

  useUIStore.subscribe(sync)
  useBookStore.subscribe(sync)

  return {
    ...useUIStore.getState(),
    ...useBookStore.getState(),
  }
})
