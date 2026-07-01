import { useEffect, useRef } from 'react'
import { useAppStore } from '@/stores/useAppStore'

export default function StreamOutput() {
  const streamOutput = useAppStore((s) => s.streamOutput)
  const snapshot = useAppStore((s) => s.snapshot)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [streamOutput.length])

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
      {streamOutput.map((round, i) => (
        <div key={i} className="stream-round">
          <div className="stream-content">{round}</div>
        </div>
      ))}
      {snapshot.isRunning && (
        <div className="text-accent" style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>
          ●
        </div>
      )}
    </div>
  )
}
