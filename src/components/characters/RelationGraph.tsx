import { useState, useRef, useCallback, useEffect } from 'react'
import type { Character, CastEntry, Relation } from '@/types/characters'
import { RELATION_COLORS } from '@/types/characters'

interface RelationGraphProps {
  relations: Relation[]
  chars: Character[]
  cast: CastEntry[]
}

export default function RelationGraph({ relations, chars, cast }: RelationGraphProps) {
  const validNames = new Set([
    ...chars.filter(c => c.tier === 'core' || c.tier === 'important').map(c => c.name),
    ...cast.map(c => c.name),
  ])
  const filtered = relations.filter(r => validNames.has(r.character_a) && validNames.has(r.character_b))
  const charNames = [...new Set(filtered.flatMap(r => [r.character_a, r.character_b]))]
  if (charNames.length < 2) {
    return <div className="text-dim text-center p-32">关联的角色太少，无法生成关系图</div>
  }

  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 500 })
  const [selectedRel, setSelectedRel] = useState<Relation | null>(null)
  const [focusName, setFocusName] = useState<string | null>(null)
  const [hopDepth, setHopDepth] = useState(0)
  const [dragNode, setDragNode] = useState<string | null>(null)
  const dragRef = useRef<{ name: string; ox: number; oy: number } | null>(null)
  const [tick, setTick] = useState(0)
  const nodesRef = useRef<Record<string, { x: number; y: number; vx: number; vy: number; c: number }>>({})

  // Force simulation init
  if (Object.keys(nodesRef.current).length === 0) {
    const cx = size.w / 2, cy = size.h / 2
    charNames.forEach((name, i) => {
      const angle = (i / charNames.length) * 2 * Math.PI - Math.PI / 2
      const connections = filtered.filter(r => r.character_a === name || r.character_b === name).length
      nodesRef.current[name] = { x: cx + Math.min(200, size.w * 0.25) * Math.cos(angle), y: cy + Math.min(140, size.h * 0.25) * Math.sin(angle), vx: 0, vy: 0, c: connections }
    })
    for (let iter = 0; iter < 100; iter++) {
      const vals = Object.values(nodesRef.current)
      for (let i = 0; i < vals.length; i++) {
        for (let j = i + 1; j < vals.length; j++) {
          let dx = vals[j].x - vals[i].x, dy = vals[j].y - vals[i].y
          let dist = Math.sqrt(dx * dx + dy * dy) || 1
          const f = 4000 / (dist * dist)
          vals[i].vx -= f * dx / dist; vals[i].vy -= f * dy / dist
          vals[j].vx += f * dx / dist; vals[j].vy += f * dy / dist
        }
      }
      for (const rel of filtered) {
        const a = nodesRef.current[rel.character_a], b = nodesRef.current[rel.character_b]
        if (!a || !b) continue
        let dx = b.x - a.x, dy = b.y - a.y; let d = Math.sqrt(dx * dx + dy * dy) || 1
        const f = d * 0.01
        a.vx += f * dx / d; a.vy += f * dy / d; b.vx -= f * dx / d; b.vy -= f * dy / d
      }
      for (const n of vals) {
        n.vx += (cx - n.x) * 0.001; n.vy += (cy - n.y) * 0.001
        n.x += n.vx; n.y += n.vy; n.vx *= 0.85; n.vy *= 0.85
      }
    }
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setSize({ w: Math.round(width), h: Math.round(height) })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleMouseDown = useCallback((name: string, e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    const n = nodesRef.current[name]
    if (!n) return
    dragRef.current = { name, ox: e.clientX - n.x, oy: e.clientY - n.y }
    setDragNode(name)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return
    const n = nodesRef.current[dragRef.current.name]
    if (!n) return
    n.x = e.clientX - dragRef.current.ox
    n.y = e.clientY - dragRef.current.oy
    const vals = Object.values(nodesRef.current)
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < vals.length; i++) { for (let j = i + 1; j < vals.length; j++) { let dx = vals[j].x - vals[i].x, dy = vals[j].y - vals[i].y; let dist = Math.sqrt(dx * dx + dy * dy) || 1; const f = 5000 / (dist * dist); vals[i].vx -= f * dx / dist; vals[i].vy -= f * dy / dist; vals[j].vx += f * dx / dist; vals[j].vy += f * dy / dist; } }
      for (const rel of filtered) { const a = nodesRef.current[rel.character_a]; const b = nodesRef.current[rel.character_b]; if (!a || !b) continue; let dx = b.x - a.x, dy = b.y - a.y; let d = Math.sqrt(dx * dx + dy * dy) || 1; const f = d * 0.012; a.vx += f * dx / d; a.vy += f * dy / d; b.vx -= f * dx / d; b.vy -= f * dy / d; }
      for (const n of vals) { n.x += n.vx; n.y += n.vy; n.vx *= 0.85; n.vy *= 0.85; }
    }
    setTick(t => t + 1)
  }, [filtered])

  const handleMouseUp = useCallback(() => { dragRef.current = null; setDragNode(null) }, [])

  const maxCon = Math.max(...Object.values(nodesRef.current).map(n => n.c), 1)
  const nodes = Object.entries(nodesRef.current).map(([name, n]) => ({ name, ...n }))
  nodes.sort((a, b) => b.c - a.c)

  const visibleSet = new Set<string>()
  if (focusName && hopDepth > 0) {
    visibleSet.add(focusName)
    let cur = new Set([focusName])
    for (let h = 0; h < hopDepth; h++) {
      const next = new Set<string>()
      for (const rel of filtered) {
        if (cur.has(rel.character_a) && !visibleSet.has(rel.character_b)) next.add(rel.character_b)
        if (cur.has(rel.character_b) && !visibleSet.has(rel.character_a)) next.add(rel.character_a)
      }
      for (const n of next) visibleSet.add(n)
      cur = next
    }
  }

  return (
    <div className="flex-col" style={{ height: '100%' }}>
      <div className="flex-row items-center justify-center gap-6 mb-8 flex-shrink-0 flex-wrap">
        <button className="welcome-mode-btn" style={{ fontSize: 11, padding: '2px 10px' }} onClick={() => setScale(s => Math.min(3, s + 0.3))}>🔍+</button>
        <button className="welcome-mode-btn" style={{ fontSize: 11, padding: '2px 10px' }} onClick={() => setScale(1)}>{Math.round(scale * 100)}%</button>
        <button className="welcome-mode-btn" style={{ fontSize: 11, padding: '2px 10px' }} onClick={() => setScale(s => Math.max(0.3, s - 0.3))}>🔍−</button>
        <span className="text-dim text-xs" style={{ margin: '0 4px' }}>|</span>
        <button className={`welcome-mode-btn btn-sm ${hopDepth === 0 ? 'active' : ''}`} onClick={() => { setHopDepth(0); setFocusName(null) }}>全部</button>
        <button className={`welcome-mode-btn btn-sm ${hopDepth === 1 ? 'active' : ''}`} onClick={() => setHopDepth(1)} disabled={!focusName}>一链</button>
        <button className={`welcome-mode-btn btn-sm ${hopDepth === 2 ? 'active' : ''}`} onClick={() => setHopDepth(2)} disabled={!focusName}>二链</button>
        {focusName && (
          <button className="welcome-mode-btn btn-sm" style={{ color: 'var(--color-error)' }}
            onClick={() => { setFocusName(null); setHopDepth(0) }}>
            取消聚焦 ✕
          </button>
        )}
      </div>

      <div ref={containerRef} className="flex-1 scroll-y" style={{ position: 'relative' }}
        onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
        <svg width={size.w} height={size.h} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius)', display: 'block', minHeight: 400 }}>
          {[...filtered].sort((a, b) => {
            const aVis = focusName ? (visibleSet.has(a.character_a) && visibleSet.has(a.character_b)) : true
            const bVis = focusName ? (visibleSet.has(b.character_a) && visibleSet.has(b.character_b)) : true
            return (aVis === bVis) ? 0 : aVis ? -1 : 1
          }).map((r) => {
            const aNode = nodes.find(n => n.name === r.character_a)
            const bNode = nodes.find(n => n.name === r.character_b)
            if (!aNode || !bNode) return null
            const vis = !focusName || (visibleSet.has(r.character_a) && visibleSet.has(r.character_b))
            const hl = selectedRel === r
            return <line key={`${r.character_a}-${r.character_b}-${r.relation}-${r.chapter}`}
              x1={aNode.x} y1={aNode.y} x2={bNode.x} y2={bNode.y}
              stroke={vis ? (RELATION_COLORS[r.relation] || 'var(--color-dim)') : 'var(--color-border)'}
              strokeWidth={hl ? 3 : vis ? 1.5 : 0.5}
              strokeOpacity={vis ? (hl ? 0.9 : 0.5) : 0.15}
              style={{ cursor: vis ? 'pointer' : 'default', transition: 'stroke-width 0.15s' }}
              onClick={() => vis && setSelectedRel(selectedRel === r ? null : r)} />
          })}
          {nodes.map((n) => {
            const isFocused = focusName === n.name
            const vis = !focusName || visibleSet.has(n.name)
            const r = 12 + 16 * (n.c / maxCon)
            return <g key={n.name} style={{ cursor: dragNode === n.name ? 'grabbing' : 'pointer' }}
              onMouseDown={(e) => handleMouseDown(n.name, e)}
              onDoubleClick={() => { if (focusName === n.name) { setFocusName(null); setHopDepth(0) } else { setFocusName(n.name); if (hopDepth === 0) setHopDepth(1) } }}>
              <circle cx={n.x} cy={n.y} r={r}
                fill={isFocused ? 'var(--color-accent)' : 'var(--color-bg)'}
                stroke={isFocused ? 'var(--color-accent)' : vis ? 'var(--color-accent2)' : 'var(--color-border)'}
                strokeWidth={isFocused ? 3 : 2} opacity={vis ? 0.95 : 0.2} />
              <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="central"
                fill={isFocused ? '#1c1c1c' : vis ? 'var(--color-text)' : 'var(--color-dim)'}
                fontSize={Math.min(r * 0.8, 13)} fontFamily="var(--font-mono)" fontWeight="bold"
                opacity={vis ? 1 : 0.3}>{n.name.length <= 4 ? n.name : n.name.slice(0, 2)}</text>
            </g>
          })}
        </svg>

        {selectedRel && (
          <div className="card text-sm" style={{ position: 'absolute', top: 8, right: 8, maxWidth: 280, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            <div className="flex-row justify-between mb-8">
              <span style={{ fontWeight: 'bold', color: 'var(--color-accent)' }}>关系详情</span>
              <button onClick={() => setSelectedRel(null)} className="text-dim" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ lineHeight: 1.8 }}>
              <span style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>{selectedRel.character_a}</span>
              <span style={{ color: RELATION_COLORS[selectedRel.relation] || 'var(--color-dim)', margin: '0 6px' }}>—[{selectedRel.relation}]—</span>
              <span style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>{selectedRel.character_b}</span>
              {selectedRel.chapter > 0 && <div className="text-dim mt-8">首次出现: 第 {selectedRel.chapter} 章</div>}
            </div>
          </div>
        )}
      </div>

      <div className="flex-row justify-center gap-12 mt-8 flex-wrap flex-shrink-0">
        {Object.entries(RELATION_COLORS).map(([rel, color]) => {
          const count = filtered.filter(r => r.relation === rel).length
          if (count === 0) return null
          return <span key={rel} className="flex-row items-center text-xs gap-4">
            <span style={{ width: 10, height: 3, background: color, display: 'inline-block', borderRadius: 2 }} />
            <span className="text-dim">{rel} ({count})</span>
          </span>
        })}
        <span className="text-dim text-xs">点击线条查看关系详情</span>
      </div>
    </div>
  )
}
