import type { ReactNode } from 'react'

interface Props {
  icon?: string
  title?: string
  description?: string
  action?: ReactNode
}

export default function EmptyState({ icon = '📭', title, description, action }: Props) {
  return (
    <div className="text-dim text-center" style={{ marginTop: 60, padding: '0 24px' }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      {title && <div style={{ fontSize: 14, marginBottom: 8 }}>{title}</div>}
      {description && <div className="text-xs" style={{ lineHeight: 1.6, maxWidth: 320, margin: '0 auto' }}>{description}</div>}
      {action && <div className="mt-16">{action}</div>}
    </div>
  )
}
