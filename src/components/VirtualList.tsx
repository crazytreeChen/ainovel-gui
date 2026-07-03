import { useRef, useEffect, useState, type ReactElement } from 'react'

interface Props<T> {
  items: T[]
  itemHeight: number
  renderItem: (item: T, index: number) => ReactElement
  overscan?: number
  style?: React.CSSProperties
}

/**
 * 简单虚拟列表 — 仅渲染可视区域内的 DOM 节点。
 * 适用于角色列表、章节列表等长列表场景。
 */
export default function VirtualList<T>({ items, itemHeight, renderItem, overscan = 5, style }: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(400)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setContainerHeight(entry.contentRect.height)
    })
    observer.observe(el)
    setContainerHeight(el.clientHeight)
    return () => observer.disconnect()
  }, [])

  const totalHeight = items.length * itemHeight
  const startIdx = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan * 2
  const endIdx = Math.min(items.length, startIdx + visibleCount)

  const visibleItems = items.slice(startIdx, endIdx)

  return (
    <div ref={containerRef} style={{ overflowY: 'auto', ...style }}
      onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: startIdx * itemHeight, left: 0, right: 0 }}>
          {visibleItems.map((item, i) => (
            <div key={startIdx + i} style={{ height: itemHeight }}>
              {renderItem(item, startIdx + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
