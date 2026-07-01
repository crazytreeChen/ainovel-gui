import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'

type ToastType = 'error' | 'success' | 'info'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

const TOAST_DURATION = 4000 // ms
const COLORS: Record<ToastType, string> = {
  error: '#e07060',
  success: '#7ec488',
  info: '#7ec5d8',
}

let nextId = 0

export function showToast(message: string, type: ToastType = 'info') {
  useAppStore.getState().addToast({ id: ++nextId, message, type })
}

export default function ToastContainer() {
  const toasts = useAppStore(s => s.toasts)
  const removeToast = useAppStore(s => s.removeToast)

  return (
    <div style={{
      position: 'fixed', top: 12, right: 12, zIndex: 200,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDone={() => removeToast(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDone }: { toast: ToastItem; onDone: () => void }) {
  const [visible, setVisible] = useState(false)
  const color = COLORS[toast.type]

  useEffect(() => {
    // 入场动画
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(onDone, TOAST_DURATION)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <div
      onClick={onDone}
      style={{
        padding: '10px 16px', borderRadius: 'var(--radius)',
        background: 'var(--color-surface)',
        border: `1px solid ${color}`,
        color: 'var(--color-text)', fontSize: 13,
        fontFamily: 'var(--font-mono)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        maxWidth: 360, cursor: 'pointer',
        transition: 'all 0.25s ease',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(40px)',
        display: 'flex', alignItems: 'center', gap: 8,
        pointerEvents: 'auto',
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, flexShrink: 0,
      }} />
      <span style={{ flex: 1 }}>{toast.message}</span>
      <span style={{ color: 'var(--color-dim)', fontSize: 11, flexShrink: 0 }}>✕</span>
    </div>
  )
}
