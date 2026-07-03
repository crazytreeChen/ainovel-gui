import { useState, useEffect, useCallback } from 'react'
import { useBookId } from '@/hooks/useBookId'

/**
 * 通用数据加载 hook — 消除 9+ 个页面中重复的 useState + useEffect + loadData 模式。
 *
 * @param fetcher 接收 bookId，返回 Promise<T>
 * @param deps    额外的依赖数组（默认只用 bookId）
 */
export function useBookData<T>(
  fetcher: (id: string) => Promise<T>,
  deps: unknown[] = [],
) {
  const id = useBookId()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    if (!id || !window.electronAPI) return
    setLoading(true)
    fetcher(id).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [id, fetcher])

  const refetch = useCallback(() => {
    reload()
  }, [reload])

  useEffect(() => {
    reload()
  }, [id, ...deps])

  return { data, loading, refetch }
}
