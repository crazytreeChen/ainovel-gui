import { useState, useCallback } from 'react'

/**
 * 手风琴展开/折叠 Hook — 统一 OutlinePage 和 SummaryPage 的 toggleExpand 模式
 *
 * @param initial 初始展开的 key 集合
 */
export function useExpandSet<T extends string | number>(initial: T[] = []) {
  const [expanded, setExpanded] = useState<Set<T>>(new Set(initial))

  const toggle = useCallback((key: T) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const isExpanded = useCallback((key: T) => expanded.has(key), [expanded])

  return { expanded, toggle, isExpanded, setExpanded }
}
