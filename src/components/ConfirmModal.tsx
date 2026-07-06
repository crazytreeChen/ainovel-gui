import { useState } from 'react'

type ConfirmTone = 'default' | 'danger'

interface ConfirmOptions {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  tone?: ConfirmTone
  details?: string[]
}

interface ConfirmRequest extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

let openConfirm: ((request: ConfirmRequest) => void) | null = null

export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!openConfirm) {
      resolve(window.confirm(options.message))
      return
    }
    openConfirm({ ...options, resolve })
  })
}

export default function ConfirmModalHost() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)

  openConfirm = setRequest

  if (!request) return null

  const isDanger = request.tone === 'danger'

  function close(ok: boolean) {
    const current = request
    setRequest(null)
    current?.resolve(ok)
  }

  return (
    <div className="modal-overlay" onClick={() => close(false)}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 380, maxWidth: 520 }}>
        <button className="modal-close" onClick={() => close(false)}>x</button>
        <div className="modal-title" style={{ color: isDanger ? 'var(--color-error)' : 'var(--color-accent)' }}>
          {request.title}
        </div>
        <div className="text-sm" style={{ lineHeight: 1.7, color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>
          {request.message}
        </div>
        {request.details?.length ? (
          <div className="mt-12 text-xs mono" style={{ maxHeight: 180, overflow: 'auto', color: 'var(--color-dim)', borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
            {request.details.map((detail, index) => <div key={`${index}-${detail}`}>{detail}</div>)}
          </div>
        ) : null}
        <div className="flex-row gap-8 mt-16" style={{ justifyContent: 'flex-end' }}>
          <button className="welcome-mode-btn" onClick={() => close(false)}>
            {request.cancelText || '取消'}
          </button>
          <button
            className={isDanger ? 'btn btn-danger btn-sm' : 'welcome-mode-btn active'}
            onClick={() => close(true)}
            style={isDanger ? { padding: '6px 14px' } : undefined}
          >
            {request.confirmText || '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}
