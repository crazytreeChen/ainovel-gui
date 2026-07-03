interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  style?: React.CSSProperties
}

export function Skeleton({ width = '100%', height = 14, borderRadius = 'var(--radius-sm)', style }: SkeletonProps) {
  return (
    <div style={{
      width, height, borderRadius,
      background: 'linear-gradient(90deg, var(--color-surface-2) 25%, var(--color-surface) 50%, var(--color-surface-2) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s ease-in-out infinite',
      ...style,
    }} />
  )
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <Skeleton height={18} width="60%" style={{ marginBottom: 12 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={`${60 + Math.random() * 30}%`} style={{ marginBottom: 6 }} />
      ))}
    </div>
  )
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-row items-center gap-8" style={{ padding: '8px 0' }}>
          <Skeleton width={24} height={14} />
          <Skeleton height={14} width={`${50 + Math.random() * 40}%`} />
        </div>
      ))}
    </div>
  )
}
