import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { CATEGORY_COLORS, AGENT_COLORS, AGENT_DISPLAY, translateEventSummary } from '@/types'

function formatTime(ts: string): string {
  if (!ts) return ''
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString('zh-CN', { hour12: false })
  } catch {
    return ts
  }
}

function formatDuration(d: number): string {
  if (d <= 0) return ''
  if (d < 1000) return `${d}ms`
  if (d < 60000) return `${(d / 1000).toFixed(1)}s`
  const m = Math.floor(d / 60000)
  const s = Math.floor((d % 60000) / 1000)
  return `${m}m${s}s`
}

export default function EventFlow() {
  const events = useAppStore((s) => s.events)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [events.length])

  if (events.length === 0) {
    return <div className="text-dim" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: 8 }}>等待事件...</div>
  }

  return (
    <div ref={containerRef} style={{ height: '100%', overflow: 'auto' }}>
      <div className="panel-header">事件流</div>
      {events.slice(-200).map((ev, i) => {
        const indent = ev.depth > 0 ? '  ' : ''
        const ts = formatTime(ev.time)
        const color = CATEGORY_COLORS[ev.category] || '#8a8175'

        let icon = '·'
        let summary = translateEventSummary(ev.summary)
        let agentName = ev.agent || ''
        let lineColor = color

        switch (ev.category) {
          case 'DISPATCH':
            icon = '✓'
            // 用 tui 风格：agent 名称加粗 + 斜体任务描述
            if (agentName) {
              const agentColor = AGENT_COLORS[agentName] || color
              summary = `${AGENT_DISPLAY[agentName] || 'AGENT'} ${ev.summary.replace(agentName, '').trim()}`
            }
            break
          case 'TOOL':
            icon = ev.depth > 0 ? '├' : '◇'
            // TOOL 事件用 tool 颜色
            if (agentName && AGENT_COLORS[agentName]) {
              lineColor = AGENT_COLORS[agentName]
            } else {
              lineColor = '#7ec5d8'
            }
            break
          case 'ERROR':
            icon = '✕'
            summary = `ERROR: ${ev.summary}`
            lineColor = 'var(--color-error)'
            break
          case 'SYSTEM':
            icon = '⚙'
            break
          case 'USER':
            icon = '✎'
            break
          case 'CONTEXT':
          case 'COMPACT':
            icon = '⚙'
            break
        }

        return (
          <div
            key={`${ev.time}-${ev.category}-${ev.summary}-${ev.agent}`}
            className="event-line"
            style={{ color: lineColor }}
          >
            <span className="event-time">{ts}</span>
            {indent}
            <span className="event-icon">{icon}</span>
            <span className="event-summary">{summary}</span>
            {ev.duration > 0 && (
              <span className="text-dim" style={{ fontSize: 10 }}>
                {' '}({formatDuration(ev.duration)})
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
