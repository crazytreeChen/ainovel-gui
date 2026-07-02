interface SimTagListProps { items?: string[]; color: string }

export default function SimTagList({ items, color }: SimTagListProps) {
  if (!items || items.length === 0) return <span className="text-dim" style={{ fontSize: 12 }}>（无）</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {items.map((item) => (
        <span key={item} style={{
          padding: '2px 8px', background: `${color}15`, color,
          borderRadius: 'var(--radius-sm)', fontSize: 12, lineHeight: 1.6,
        }}>{item}</span>
      ))}
    </div>
  )
}
