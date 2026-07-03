interface RadarChartProps {
  dimensions: { dimension: string; score: number; verdict: string; comment: string }[]
  labels: Record<string, string>
  colors: Record<string, string>
  size?: number
}

export default function RadarChart({ dimensions, labels, colors, size = 200 }: RadarChartProps) {
  const dims = ['consistency', 'character', 'pacing', 'continuity', 'foreshadow', 'hook', 'aesthetic']
  const n = dims.length
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 20

  // 计算顶点坐标
  function point(i: number, ratio: number) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2 // 从顶部开始
    return { x: cx + r * ratio * Math.cos(angle), y: cy + r * ratio * Math.sin(angle) }
  }

  // 网格多边形（25%, 50%, 75%, 100%）
  const grids = [0.25, 0.5, 0.75, 1.0]

  // 数据多边形
  const scores = dims.map(d => {
    const found = dimensions.find(dd => dd.dimension === d)
    return found ? found.score : 0
  })
  // 归一化到 0-1 (假设满分 100)
  const maxScore = 100
  const dataPoints = scores.map((s, i) => point(i, Math.min(s / maxScore, 1)))

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      {/* 网格 */}
      {grids.map((g) => {
        const pts = dims.map((_, i) => {
          const p = point(i, g)
          return `${p.x},${p.y}`
        }).join(' ')
        return <polygon key={g} points={pts} fill="none" stroke="var(--color-border)" strokeWidth={0.5} opacity={0.6} />
      })}

      {/* 轴线 */}
      {dims.map((_, i) => {
        const p = point(i, 1)
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="var(--color-border)" strokeWidth={0.5} opacity={0.4} />
      })}

      {/* 数据多边形 */}
      <polygon
        points={dataPoints.map(p => `${p.x},${p.y}`).join(' ')}
        fill="var(--color-accent)" fillOpacity={0.12}
        stroke="var(--color-accent)" strokeWidth={1.5}
      />

      {/* 数据点 */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth={1} />
      ))}

      {/* 维度标签 */}
      {dims.map((d, i) => {
        const p = point(i, 1.18)
        const found = dimensions.find(dd => dd.dimension === d)
        return (
          <text key={d} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            fill={colors[d] || 'var(--color-dim)'}
            style={{ fontSize: size / 20, fontFamily: 'var(--font-mono)' }}>
            {labels[d] || d} {found?.score ?? '-'}
          </text>
        )
      })}
    </svg>
  )
}
