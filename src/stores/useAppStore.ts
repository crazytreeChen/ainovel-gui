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

/**
 * 合并 store — 提供向后兼容的单一入口。
 *
 * 订阅策略：
 * - UIStore / BookStore: 即时同步（变化频率低）
 * - WritingStore: 不做订阅合并（每 token appendStreamOutput 会触发全量重建）
 *
 * ✅ 组件应直接使用子 store 获取实时写作状态：
 *   const events = useWritingStore(s => s.events)       // 替代 useAppStore(s => s.events)
 *   const stream = useWritingStore(s => s.streamOutput)   // 替代 useAppStore(s => s.streamOutput)
 */
export const useAppStore = create<AppState>((set) => {
  const initial: AppState = {
    ...useUIStore.getState(),
    ...useBookStore.getState(),
    ...useWritingStore.getState(),
  }

  // 仅同步低频变化的子 store
  useUIStore.subscribe(() => set({
    ...useUIStore.getState(),
    ...useBookStore.getState(),
    // 不包含 useWritingStore — 高频写入应直接订阅 useWritingStore
  }))

  useBookStore.subscribe(() => set({
    ...useUIStore.getState(),
    ...useBookStore.getState(),
  }))

  return initial
})
