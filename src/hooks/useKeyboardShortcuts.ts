import { useEffect } from 'react'
import { useAppStore } from '@/stores/useAppStore'

/**
 * 全局键盘快捷键：Escape 关闭各类模态框
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const state = useAppStore.getState()
        if (state.showHelp) state.toggleHelp()
        if (state.showDiagnostics) state.toggleDiagnostics()
        if (state.showModelSwitch) state.toggleModelSwitch()
        if (state.showCoCreate) state.toggleCoCreate()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
