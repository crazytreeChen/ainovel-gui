import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { translateEventSummary } from '@/types'

export default function StreamOutput() {
  const streamOutput = useAppStore((s) => s.streamOutput)
  const snapshot = useAppStore((s) => s.snapshot)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [streamOutput.length, streamOutput[streamOutput.length - 1]?.text.length])

  return (
    <div ref={containerRef} style={{ height: '100%', overflow: 'auto' }}>
      <div className="panel-header accent">实时输出</div>
      {streamOutput.length === 0 && !snapshot.isRunning && (
        <div className="text-dim" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          等待输出...
        </div>
      )}
      {streamOutput.length === 0 && snapshot.isRunning && (
        <div className="text-dim" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          正在初始化...
        </div>
      )}
      {/* 合并所有流式输出为连续文本 */}
      <div style={{ lineHeight: 1.7 }}>
        {streamOutput.map((entry, i) => {
          const isNewBlock = i > 0 && streamOutput[i-1].type !== entry.type
          return (
            /* index acceptable: append-only stream log, no UI reorder/delete */
            <span key={i}>
              {isNewBlock && <span style={{ display: 'block', height: 8 }} />}
              <span style={{
                color: entry.type === 'thinking' ? 'var(--color-dim)' : 'var(--color-text)',
                fontSize: entry.type === 'thinking' ? 12 : 13,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>{translateEventSummary(entry.text)}</span>
            </span>
          )
        })}
      </div>
      {snapshot.isRunning && (
        <div className="text-accent" style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>
          ●
        </div>
      )}
    </div>
  )
}
