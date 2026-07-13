import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useWritingStore } from '@/stores/useWritingStore'
import { useUIStore } from '@/stores/useUIStore'

/**
 * 监听 Electron IPC 事件：运行时推送、进程退出、流式输出、初始化检查
 */
export function useIPCListeners() {
  const mode = useAppStore((s) => s.mode)
  const setBinaryInfo = useAppStore((s) => s.setBinaryInfo)
  const refreshSnapshot = useAppStore((s) => s.refreshSnapshot)
  const refreshEvents = useAppStore((s) => s.refreshEvents)
  const refreshChapters = useAppStore((s) => s.refreshChapters)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastErrorKeyRef = useRef<string>('')

  useEffect(() => {
    async function init() {
      if (window.electronAPI) {
        const info = await window.electronAPI.checkBinary()
        setBinaryInfo(info)
        await refreshSnapshot()
        await refreshChapters()
      }
    }
    init()
  }, [setBinaryInfo, refreshSnapshot, refreshChapters])

  useEffect(() => {
    if (mode === 'running') {
      const cleanupPush = window.electronAPI?.onRuntimeUpdate(() => {
        refreshSnapshot()
        refreshEvents()
        refreshChapters()
      })
      pollRef.current = setInterval(async () => {
        await refreshSnapshot()
        await refreshEvents()
        await refreshChapters()
      }, 10000)
      return () => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
        if (cleanupPush) cleanupPush()
      }
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [mode, refreshSnapshot, refreshEvents, refreshChapters])

  useEffect(() => {
    if (!window.electronAPI) return
    const cleanup = window.electronAPI.onProcessExited(async () => {
      await refreshSnapshot()
      const snap = useAppStore.getState().snapshot
      if (snap.isRunning) {
        useAppStore.getState().setMode('running')
      } else if (snap.phase === 'complete') {
        useAppStore.getState().setMode('completed')
      } else {
        useAppStore.getState().setMode('idle')
      }
    })
    return cleanup
  }, [refreshSnapshot])

  useEffect(() => {
    if (!window.electronAPI) return
    const cleanup = window.electronAPI.onStreamOutput((data) => {
      try {
        const parsed = JSON.parse(data)
        useWritingStore.getState().appendStreamOutput(parsed)
      } catch {
        useWritingStore.getState().appendStreamOutput({ type: 'content', text: data })
      }
    })
    return cleanup
  }, [])

  // 监听 ERROR 事件并弹 Toast
  useEffect(() => {
    const unsub = useAppStore.subscribe((state, prevState) => {
      if (state.events.length <= prevState.events.length) return
      const last = state.events[state.events.length - 1]
      if (!last || last.level !== 'error') return
      // 去重：同一错误摘要只弹一次
      const key = `${last.time}-${last.summary}`
      if (key === lastErrorKeyRef.current) return
      lastErrorKeyRef.current = key
      useUIStore.getState().addToast({
        id: Date.now(),
        message: last.summary.slice(0, 120),
        type: 'error',
      })
    })
    return unsub
  }, [])
}
