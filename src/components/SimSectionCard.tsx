import type { ReactNode } from 'react'

interface SimSectionCardProps {
  title: string
  children: ReactNode
  borderColor?: string
}

export default function SimSectionCard({ title, children, borderColor }: SimSectionCardProps) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: `1px solid ${borderColor || 'var(--color-border)'}`,
      borderRadius: 'var(--radius)', padding: 14, marginBottom: 10,
    }}>
      <div className="sidebar-section-header" style={{ marginBottom: 8, fontSize: 12 }}>{title}</div>
      {children}
    </div>
  )
}
