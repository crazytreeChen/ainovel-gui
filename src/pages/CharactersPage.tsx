import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'

interface Character {
  name: string; aliases: string[]; role: string
  tier: 'core' | 'important' | 'secondary' | 'decorative'
  description: string; arc: string; traits: string[]
}

interface CastEntry {
  name: string; aliases: string[]; briefRole: string
  firstSeenChapter: number; lastSeenChapter: number
  appearanceCount: number; appearanceChapters: number[]; promoted: boolean
}

interface Relation {
  character_a: string; character_b: string; relation: string; chapter: number
}

const TIER_COLORS: Record<string, string> = {
  core: '#e5b449', important: '#7ec5d8', secondary: '#8a8175', decorative: '#5a5a5a',
}
const TIER_LABELS: Record<string, string> = {
  core: '主角', important: '重要', secondary: '次要', decorative: '装饰',
}

const PLACEHOLDER_FACES = ['👤', '👥', '🧑', '👩', '👨', '🧔', '👵', '👴']

export default function CharactersPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'chars' | 'cast' | 'relations' | 'eco'>('chars')
  // 角色
  const [chars, setChars] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTier, setFilterTier] = useState<string>('all')
  const [selected, setSelected] = useState<Character | null>(null)
  // 配角
  const [cast, setCast] = useState<CastEntry[]>([])
  const [castLoading, setCastLoading] = useState(false)
  const [selectedCast, setSelectedCast] = useState<CastEntry | null>(null)
  // 关系图谱
  const [relations, setRelations] = useState<Relation[]>([])
  const [relLoading, setRelLoading] = useState(false)

  useEffect(() => { loadChars(); loadCast(); loadRelations() }, [id])

  async function loadChars() {
    if (!id || !window.electronAPI) return
    setLoading(true)
    const data = await window.electronAPI.getBookCharacters(id)
    setChars(data || [])
    setLoading(false)
  }

  async function loadCast() {
    if (!id || !window.electronAPI) return
    setCastLoading(true)
    const data = await window.electronAPI.getBookCast(id)
    setCast(data || [])
    setCastLoading(false)
  }

  async function loadRelations() {
    if (!id || !window.electronAPI) return
    setRelLoading(true)
    const data = await window.electronAPI.getBookTimeline(id)
    setRelations(data?.relationships || [])
    setRelLoading(false)
  }

  const filtered = filterTier === 'all' ? chars : chars.filter(c => c.tier === filterTier)

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexShrink: 0 }}>
        <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回</button>
        <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>角色管理</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button className={`welcome-mode-btn ${tab === 'chars' ? 'active' : ''}`}
            onClick={() => setTab('chars')} style={{ fontSize: 11 }}>
            角色 ({chars.length})
          </button>
          <button className={`welcome-mode-btn ${tab === 'cast' ? 'active' : ''}`}
            onClick={() => setTab('cast')} style={{ fontSize: 11 }}>
            配角名册 ({cast.length})
          </button>
          <button className={`welcome-mode-btn ${tab === 'relations' ? 'active' : ''}`}
            onClick={() => setTab('relations')} style={{ fontSize: 11 }}>
            关系图谱 ({relations.length})
          </button>
          <button className={`welcome-mode-btn ${tab === 'eco' ? 'active' : ''}`}
            onClick={() => setTab('eco')} style={{ fontSize: 11 }}>
            配角生态 ({cast.length})
          </button>
        </div>
      </div>

      {tab === 'chars' && (
        <>
          {/* 角色层级筛选 */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexShrink: 0 }}>
            {['all', 'core', 'important', 'secondary', 'decorative'].map(t => (
              <button key={t} className={`welcome-mode-btn ${filterTier === t ? 'active' : ''}`}
                onClick={() => setFilterTier(t)} style={{ fontSize: 11 }}>
                {t === 'all' ? '全部' : TIER_LABELS[t] || t}
              </button>
            ))}
          </div>

          {loading ? <div className="text-dim">加载中...</div> : (
            <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>
              <div style={{ width: '40%', overflow: 'auto', borderRight: '1px solid var(--color-border)', paddingRight: 12 }}>
                {filtered.map((c) => (
                  <div key={c.name} className="cursor-clickable" onClick={() => setSelected(c)}
                    style={{
                      padding: '10px 12px', marginBottom: 4, borderRadius: 'var(--radius)',
                      background: selected?.name === c.name ? 'var(--color-surface-2)' : 'transparent',
                      border: '1px solid transparent',
                      borderLeft: `3px solid ${TIER_COLORS[c.tier] || '#666'}`,
                    }}>
                    <div style={{ fontWeight: 'bold', fontSize: 14 }}>{c.name}</div>
                    <div className="text-dim" style={{ fontSize: 11, display: 'flex', gap: 8 }}>
                      <span style={{ color: TIER_COLORS[c.tier] }}>{TIER_LABELS[c.tier]}</span>
                      {c.role && <span>{c.role}</span>}
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && <div className="text-dim" style={{ marginTop: 40, textAlign: 'center' }}>暂无角色</div>}
              </div>

              <div style={{ flex: 1, overflow: 'auto' }}>
                {selected ? (
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>{selected.name}</div>
                    <div className="text-dim" style={{ fontSize: 12, marginBottom: 16, display: 'flex', gap: 12 }}>
                      <span style={{ color: TIER_COLORS[selected.tier] }}>{TIER_LABELS[selected.tier]}</span>
                      {selected.role && <span>· {selected.role}</span>}
                    </div>
                    {selected.aliases?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div className="sidebar-section-header" style={{ fontSize: 11 }}>别名</div>
                        <div className="text-dim" style={{ fontSize: 12 }}>{selected.aliases.join(' · ')}</div>
                      </div>
                    )}
                    {selected.description && (
                      <div style={{ marginBottom: 12 }}>
                        <div className="sidebar-section-header" style={{ fontSize: 11 }}>描述</div>
                        <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.6 }}>{selected.description}</div>
                      </div>
                    )}
                    {selected.arc && (
                      <div style={{ marginBottom: 12 }}>
                        <div className="sidebar-section-header" style={{ fontSize: 11 }}>角色弧</div>
                        <div className="text-dim" style={{ fontSize: 12 }}>{selected.arc}</div>
                      </div>
                    )}
                    {selected.traits?.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div className="sidebar-section-header" style={{ fontSize: 11 }}>性格特征</div>
                        <div className="text-dim" style={{ fontSize: 12 }}>{selected.traits.join(' · ')}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-dim" style={{ marginTop: 60, textAlign: 'center' }}>选择一个角色查看详情</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'cast' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {castLoading ? <div className="text-dim">加载中...</div> : cast.length === 0 ? (
            <div className="text-dim" style={{ marginTop: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>👥</div>
              <div style={{ fontSize: 14 }}>暂无配角名册</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>配角由创作引擎在写作过程中自动记录</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
              {cast.map((c, i) => (
                <div key={c.name} className="cursor-clickable" onClick={() => setSelectedCast(selectedCast?.name === c.name ? null : c)}
                  style={{
                    padding: 12, borderRadius: 'var(--radius)',
                    background: selectedCast?.name === c.name ? 'var(--color-surface-2)' : 'var(--color-surface)',
                    border: `1px solid ${selectedCast?.name === c.name ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    transition: 'all 0.12s',
                  }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 18 }}>{PLACEHOLDER_FACES[i % PLACEHOLDER_FACES.length]}</span>
                    <div style={{ fontWeight: 'bold', fontSize: 14 }}>{c.name}</div>
                    {c.promoted && <span className="text-accent" style={{ fontSize: 10, padding: '1px 4px', border: '1px solid var(--color-accent)', borderRadius: 3 }}>晋级</span>}
                  </div>
                  {c.briefRole && <div className="text-dim" style={{ fontSize: 12, marginBottom: 4 }}>{c.briefRole}</div>}
                  <div className="text-dim" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', display: 'flex', gap: 8 }}>
                    <span>出场 {c.appearanceCount} 次</span>
                    {c.firstSeenChapter > 0 && <span>始于 #第{c.firstSeenChapter}章</span>}
                  </div>
                  {selectedCast?.name === c.name && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--color-border)', fontSize: 12 }}>
                      {c.aliases?.length > 0 && <div className="text-dim" style={{ marginBottom: 4 }}>别名: {c.aliases.join(' · ')}</div>}
                      {c.appearanceChapters?.length > 0 && (
                        <div className="text-dim">出场章节: {c.appearanceChapters.slice(0, 20).join(', ')}{c.appearanceChapters.length > 20 ? '...' : ''}</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'relations' && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {relLoading ? <div className="text-dim">加载中...</div> : relations.length === 0 ? (
            <div className="text-dim" style={{ marginTop: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>🔗</div>
              <div style={{ fontSize: 14 }}>暂无关系记录</div>
            </div>
          ) : (
            <RelationGraph relations={relations} chars={chars} cast={cast} />
          )}
        </div>
      )}

      {/* ── 配角生态 ── */}
      {tab === 'eco' && (
        <CastEcosystem chars={chars} cast={cast} relations={relations} />
      )}

      </div>
    </div>
  )
}

function CastEcosystem({ chars, cast, relations }: { chars: Character[]; cast: CastEntry[]; relations: Relation[] }) {
  const castMap = new Map(cast.map(c => [c.name, c]))
  const charNames = new Set(chars.map(c => c.name))

  if (cast.length === 0) {
    return (
      <div className="text-dim" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>🌿</div>
        <div style={{ fontSize: 14 }}>暂无配角生态数据</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>配角由创作引擎在写作过程中自动记录</div>
      </div>
    )
  }

  // 同章关联统计
  const chapterGroups: Record<number, string[]> = {}
  for (const c of cast) {
    for (const ch of (c.appearanceChapters || [])) {
      if (!chapterGroups[ch]) chapterGroups[ch] = []
      chapterGroups[ch].push(c.name)
    }
  }
  const pairCount = new Map<string, number>()
  for (const [ch, names] of Object.entries(chapterGroups)) {
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = [names[i], names[j]].sort().join('||')
        pairCount.set(key, (pairCount.get(key) || 0) + 1)
      }
    }
  }
  const topPairs = [...pairCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)

  // 角色关系网络
  const charRels: Record<string, { target: string; count: number }[]> = {}
  for (const r of relations) {
    if (!charRels[r.character_a]) charRels[r.character_a] = []
    if (!charRels[r.character_b]) charRels[r.character_b] = []
    const e1 = charRels[r.character_a].find(e => e.target === r.character_b)
    if (e1) e1.count++; else charRels[r.character_a].push({ target: r.character_b, count: 1 })
    const e2 = charRels[r.character_b].find(e => e.target === r.character_a)
    if (e2) e2.count++; else charRels[r.character_b].push({ target: r.character_a, count: 1 })
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {/* 生态总览 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div className="panel-surface" style={{ flex: 1, textAlign: 'center' }}>
          <div className="text-accent mono" style={{ fontSize: 24 }}>{cast.length}</div>
          <div className="text-dim" style={{ fontSize: 11 }}>配角总数</div>
        </div>
        <div className="panel-surface" style={{ flex: 1, textAlign: 'center' }}>
          <div className="text-accent mono" style={{ fontSize: 24 }}>{cast.filter(c => c.promoted).length}</div>
          <div className="text-dim" style={{ fontSize: 11 }}>已晋级</div>
        </div>
        <div className="panel-surface" style={{ flex: 1, textAlign: 'center' }}>
          <div className="text-accent mono" style={{ fontSize: 24 }}>{topPairs.length}</div>
          <div className="text-dim" style={{ fontSize: 11 }}>关联对</div>
        </div>
      </div>

      {/* 出场频次 TOP 10 */}
      <div style={{ marginBottom: 16 }}>
        <div className="sidebar-section-header" style={{ marginBottom: 8 }}>🥇 出场频次 TOP 10</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[...cast].sort((a, b) => b.appearanceCount - a.appearanceCount).slice(0, 10).map((c, i) => {
            const maxCount = Math.max(...cast.map(x => x.appearanceCount), 1)
            return (
              <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="text-dim mono" style={{ width: 20, fontSize: 11 }}>#{i + 1}</span>
                <span style={{ width: 120, fontSize: 12, fontWeight: 'bold' }}>{c.name}</span>
                <div style={{ flex: 1, height: 14, background: 'var(--color-surface-2)', borderRadius: 7, overflow: 'hidden' }}>
                  <div style={{ width: `${(c.appearanceCount / maxCount) * 100}%`, height: '100%', background: c.promoted ? 'var(--color-accent)' : 'var(--color-accent2)', borderRadius: 7, transition: 'width 0.3s' }} />
                </div>
                <span className="text-dim mono" style={{ width: 40, textAlign: 'right', fontSize: 11 }}>{c.appearanceCount}次</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 同章关联网络 */}
      {topPairs.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="sidebar-section-header" style={{ marginBottom: 8 }}>🔗 同章关联网络</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {topPairs.map(([key, count]) => {
              const [a, b] = key.split('||')
              const aData = castMap.get(a); const bData = castMap.get(b)
              return (
                <div key={key} className="panel-surface-2" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <span style={{ color: aData?.promoted ? 'var(--color-accent)' : 'var(--color-text)', fontWeight: 'bold' }}>{a}</span>
                  <span className="text-dim">↔</span>
                  <span style={{ color: bData?.promoted ? 'var(--color-accent)' : 'var(--color-text)', fontWeight: 'bold' }}>{b}</span>
                  <span className="text-dim" style={{ fontSize: 10 }}>{count}章</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 配角关联关系 */}
      {relations.length > 0 && (
        <div>
          <div className="sidebar-section-header" style={{ marginBottom: 8 }}>🕸️ 配角关联关系</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {cast.map(c => {
              const rels = charRels[c.name] || []
              if (rels.length === 0) return null
              const filtered = rels.filter(r => charNames.has(r.target) || castMap.has(r.target)).slice(0, 5)
              if (filtered.length === 0) return null
              return (
                <div key={c.name} className="panel-surface" style={{ fontSize: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 'bold', color: c.promoted ? 'var(--color-accent)' : 'var(--color-text)' }}>{c.name}</span>
                    <span className="text-dim" style={{ fontSize: 11 }}>出场 {c.appearanceCount} 次</span>
                    {c.promoted && <span className="text-accent" style={{ fontSize: 10, padding: '1px 4px', border: '1px solid var(--color-accent)', borderRadius: 3 }}>晋级</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {filtered.map(rel => (
                      <span key={rel.target} className="text-dim" style={{ padding: '2px 8px', background: 'var(--color-surface-2)', borderRadius: 10, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {rel.target}
                        <span className="mono" style={{ color: 'var(--color-muted)', fontSize: 9 }}>×{rel.count}</span>
                      </span>
                    ))}
                    {rels.length > 5 && <span className="text-dim" style={{ fontSize: 10 }}>+{rels.length - 5}...</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 关系图谱组件（力导向布局）──

const RELATION_COLORS: Record<string, string> = {
  师徒: '#e5b449', 夫妻: '#e07060', 兄妹: '#7ec488',
  战友: '#7ec5d8', 仇敌: '#a890d8', 同僚: '#5fb8a3',
}

interface ForceNode { name: string; x: number; y: number; vx: number; vy: number; connections: number }

function RelationGraph({ relations, chars, cast }: { relations: Relation[]; chars: Character[]; cast: CastEntry[] }) {
  const validNames = new Set([
    ...chars.filter(c => c.tier === 'core' || c.tier === 'important').map(c => c.name),
    ...cast.map(c => c.name),
  ])
  const filtered = relations.filter(r => validNames.has(r.character_a) && validNames.has(r.character_b))
  const charNames = [...new Set(filtered.flatMap(r => [r.character_a, r.character_b]))]
  if (charNames.length < 2) {
    return <div className="text-dim" style={{ textAlign: 'center', padding: 40 }}>关联的角色太少，无法生成关系图</div>
  }

  const W = 800, H = 500
  const [scale, setScale] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 500 })
  const [selectedRel, setSelectedRel] = useState<Relation | null>(null)
  const [focusName, setFocusName] = useState<string | null>(null)
  const [hopDepth, setHopDepth] = useState(0)
  const [dragNode, setDragNode] = useState<string | null>(null)
  const dragRef = useRef<{ name: string; ox: number; oy: number } | null>(null)

  // 计算节点位置 (带缓存，拖拽时强制更新)
  const [tick, setTick] = useState(0)
  const nodesRef = useRef<Record<string, { x: number; y: number; vx: number; vy: number; c: number }>>({})

  // 初始化节点位置 + 容器尺寸
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

  // 容器尺寸自适应
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

  // 鼠标事件
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
    // 拖拽时运行几轮力模拟让关联节点抖动
    const vals = Object.values(nodesRef.current)
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < vals.length; i++) {
        for (let j = i + 1; j < vals.length; j++) {
          let dx = vals[j].x - vals[i].x, dy = vals[j].y - vals[i].y
          let dist = Math.sqrt(dx * dx + dy * dy) || 1
          const f = 5000 / (dist * dist)
          vals[i].vx -= f * dx / dist; vals[i].vy -= f * dy / dist
          vals[j].vx += f * dx / dist; vals[j].vy += f * dy / dist
        }
      }
      for (const rel of filtered) {
        const a = nodesRef.current[rel.character_a], b = nodesRef.current[rel.character_b]
        if (!a || !b) continue
        let dx = b.x - a.x, dy = b.y - a.y; let d = Math.sqrt(dx * dx + dy * dy) || 1
        const f = d * 0.012
        a.vx += f * dx / d; a.vy += f * dy / d; b.vx -= f * dx / d; b.vy -= f * dy / d
      }
      for (const n of vals) {
        n.x += n.vx; n.y += n.vy; n.vx *= 0.85; n.vy *= 0.85
      }
    }
    setTick(t => t + 1)
  }, [filtered])

  const handleMouseUp = useCallback(() => {
    dragRef.current = null
    setDragNode(null)
  }, [])

  const maxCon = Math.max(...Object.values(nodesRef.current).map(n => n.c), 1)
  const nodes = Object.entries(nodesRef.current).map(([name, n]) => ({ name, ...n }))
  nodes.sort((a, b) => b.c - a.c)

  // 可见节点
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 顶部工具栏：缩放 + 聚焦 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexShrink: 0, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="welcome-mode-btn" onClick={() => setScale(s => Math.min(3, s + 0.3))} style={{ fontSize: 11, padding: '2px 10px' }}>🔍+</button>
        <button className="welcome-mode-btn" onClick={() => setScale(1)} style={{ fontSize: 11, padding: '2px 10px' }}>{Math.round(scale * 100)}%</button>
        <button className="welcome-mode-btn" onClick={() => setScale(s => Math.max(0.3, s - 0.3))} style={{ fontSize: 11, padding: '2px 10px' }}>🔍−</button>
        <span className="text-dim" style={{ fontSize: 10, margin: '0 4px' }}>|</span>
        <button className={`welcome-mode-btn ${hopDepth === 0 ? 'active' : ''}`} onClick={() => { setHopDepth(0); setFocusName(null) }} style={{ fontSize: 11, padding: '2px 10px' }}>全部</button>
        <button className={`welcome-mode-btn ${hopDepth === 1 ? 'active' : ''}`} onClick={() => setHopDepth(1)} style={{ fontSize: 11, padding: '2px 10px' }} disabled={!focusName}>一链</button>
        <button className={`welcome-mode-btn ${hopDepth === 2 ? 'active' : ''}`} onClick={() => setHopDepth(2)} style={{ fontSize: 11, padding: '2px 10px' }} disabled={!focusName}>二链</button>
        {focusName && (
          <button className="welcome-mode-btn" onClick={() => { setFocusName(null); setHopDepth(0) }} style={{ fontSize: 11, padding: '2px 10px', color: 'var(--color-error)' }}>
            取消聚焦 ✕
          </button>
        )}
      </div>

      <div ref={containerRef} style={{ flex: 1, overflow: 'auto', position: 'relative' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg width={size.w} height={size.h} style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius)', display: 'block', minHeight: 400 }}>
          <g>
            {/* 连线 */}
            {[...filtered].sort((a, b) => {
              const aVis = focusName ? (visibleSet.has(a.character_a) && visibleSet.has(a.character_b)) : true
              const bVis = focusName ? (visibleSet.has(b.character_a) && visibleSet.has(b.character_b)) : true
              return (aVis === bVis) ? 0 : aVis ? -1 : 1
            }).map((r, i) => {
              const a = nodes.find(n => n.name === r.character_a)
              const b = nodes.find(n => n.name === r.character_b)
              if (!a || !b) return null
              const isVisible = !focusName || (visibleSet.has(r.character_a) && visibleSet.has(r.character_b))
              const isHighlighted = selectedRel === r
              return <line key={`${r.character_a}-${r.character_b}-${r.relation}-${r.chapter}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isVisible ? (RELATION_COLORS[r.relation] || 'var(--color-dim)') : 'var(--color-border)'}
                strokeWidth={isHighlighted ? 3 : isVisible ? 1.5 : 0.5}
                strokeOpacity={isVisible ? (isHighlighted ? 0.9 : 0.5) : 0.15}
                style={{ cursor: isVisible ? 'pointer' : 'default', transition: 'stroke-width 0.15s' }}
                onClick={() => isVisible && setSelectedRel(selectedRel === r ? null : r)}
              />
            })}
            {/* 节点 */}
            {nodes.map((n) => {
              const isFocused = focusName === n.name
              const isVisible = !focusName || visibleSet.has(n.name)
              const r = 12 + 16 * (n.c / maxCon)
              return <g key={n.name}
                style={{ cursor: dragNode === n.name ? 'grabbing' : 'pointer' }}
                onMouseDown={(e) => handleMouseDown(n.name, e)}
                onDoubleClick={() => {
                  if (focusName === n.name) { setFocusName(null); setHopDepth(0) }
                  else { setFocusName(n.name); if (hopDepth === 0) setHopDepth(1) }
                }}
              >
                <circle cx={n.x} cy={n.y} r={r}
                  fill={isFocused ? 'var(--color-accent)' : 'var(--color-bg)'}
                  stroke={isFocused ? 'var(--color-accent)' : isVisible ? 'var(--color-accent2)' : 'var(--color-border)'}
                  strokeWidth={isFocused ? 3 : 2} opacity={isVisible ? 0.95 : 0.2}
                />
                <text x={n.x} y={n.y + 1} textAnchor="middle" dominantBaseline="central"
                  fill={isFocused ? '#1c1c1c' : isVisible ? 'var(--color-text)' : 'var(--color-dim)'}
                  fontSize={Math.min(r * 0.8, 13)}
                  fontFamily="var(--font-mono)" fontWeight="bold"
                  opacity={isVisible ? 1 : 0.3}
                >{n.name.length <= 4 ? n.name : n.name.slice(0, 2)}</text>
              </g>
            })}
          </g>
        </svg>

        {/* 关系详情弹窗 */}
        {selectedRel && (
          <div style={{
            position: 'absolute', top: 8, right: 8, padding: '10px 14px',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)', fontSize: 12, maxWidth: 280,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontWeight: 'bold', color: 'var(--color-accent)' }}>关系详情</span>
              <button onClick={() => setSelectedRel(null)} style={{ background: 'none', border: 'none', color: 'var(--color-dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ lineHeight: 1.8 }}>
              <span style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>{selectedRel.character_a}</span>
              <span style={{ color: RELATION_COLORS[selectedRel.relation] || 'var(--color-dim)', margin: '0 6px' }}>
                —[{selectedRel.relation}]—
              </span>
              <span style={{ color: 'var(--color-text)', fontWeight: 'bold' }}>{selectedRel.character_b}</span>
              {selectedRel.chapter > 0 && (
                <div className="text-dim" style={{ marginTop: 4 }}>首次出现: 第 {selectedRel.chapter} 章</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 图例 */}
      <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center', flexShrink: 0 }}>
        {Object.entries(RELATION_COLORS).map(([rel, color]) => {
          const count = filtered.filter(r => r.relation === rel).length
          if (count === 0) return null
          return <span key={rel} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 3, background: color, display: 'inline-block', borderRadius: 2 }} />
            <span className="text-dim">{rel} ({count})</span>
          </span>
        })}
        <span className="text-dim" style={{ fontSize: 10 }}>点击线条查看关系详情</span>
      </div>
    </div>
  )
}
