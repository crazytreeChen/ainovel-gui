import { useState } from 'react'
import { useUIStore, useWritingStore } from '@/stores/useAppStore'

interface DiagnosticsModalProps {
  onClose?: () => void
}

export default function DiagnosticsModal({ onClose }: DiagnosticsModalProps) {
  const diagReport = useUIStore((s) => s.diagReport)
  const toggleDiagnostics = useUIStore((s) => s.toggleDiagnostics)
  const handleClose = onClose || toggleDiagnostics
  const runDiag = useWritingStore((s) => s.runDiag)
  const [loading, setLoading] = useState(false)

  const handleRun = async () => {
    setLoading(true)
    await runDiag()
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 600 }}>
        <button className="modal-close" onClick={handleClose}>✕</button>
        <div className="modal-title">诊断报告</div>

        <button
          onClick={handleRun}
          disabled={loading}
          style={{
            background: 'var(--color-accent)',
            color: '#1c1c1c',
            border: 'none',
            borderRadius: 'var(--radius)',
            padding: '6px 16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}
        >
          {loading ? '运行中...' : '运行诊断 /diag'}
        </button>

        <div
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: 12,
            maxHeight: 500,
            overflow: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            color: diagReport ? 'var(--color-text)' : 'var(--color-dim)',
          }}
        >
          {diagReport || '点击"运行诊断"按钮生成报告\n\n诊断覆盖四个维度：\n· 流程 — 改写循环卡顿、阶段/流程状态异常\n· 质量 — 评审维度持续低分、改写率\n· 规划 — 伏笔停滞、指南针过时\n· 上下文 — 角色消失、时间线缺口'}
        </div>
      </div>
    </div>
  )
}
