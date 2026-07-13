import { useEffect } from 'react'
import { useUIStore } from '@/stores/useUIStore'

/**
 * 全局键盘快捷键：Escape 关闭各类模态框
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const state = useUIStore.getState()
        if (state.modalStack.length > 0) {
          state.popModal()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
