import { useState, useCallback } from 'react'

/**
 * 通用撤销/重做 hook — 支持任意类型的状态历史栈。
 *
 * @param initial 初始值
 * @param maxHistory 最大历史记录数（防内存泄漏）
 */
export function useUndo<T>(initial: T, maxHistory = 50) {
  const [past, setPast] = useState<T[]>([initial])
  const [present, setPresent] = useState(initial)
  const [future, setFuture] = useState<T[]>([])

  const push = useCallback((next: T) => {
    setPast(prev => [...prev.slice(-maxHistory + 1), present])
    setPresent(next)
    setFuture([])
  }, [present, maxHistory])

  const undo = useCallback(() => {
    if (past.length <= 1) return // 至少保留初始值
    const prev = past[past.length - 1]
    setPast(prev2 => prev2.slice(0, -1))
    setFuture(prev2 => [present, ...prev2])
    setPresent(prev)
  }, [past, present])

  const redo = useCallback(() => {
    if (future.length === 0) return
    const next = future[0]
    setPast(prev => [...prev, present])
    setFuture(prev2 => prev2.slice(1))
    setPresent(next)
  }, [future, present])

  const reset = useCallback((val: T) => {
    setPast([val])
    setPresent(val)
    setFuture([])
  }, [])

  return {
    state: present,
    setState: push,
    undo,
    redo,
    reset,
    canUndo: past.length > 1,
    canRedo: future.length > 0,
  }
}
