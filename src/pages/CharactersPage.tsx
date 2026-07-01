import { useState, useEffect } from 'react'
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
  const [tab, setTab] = useState<'chars' | 'cast'>('chars')
  // 角色
  const [chars, setChars] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTier, setFilterTier] = useState<string>('all')
  const [selected, setSelected] = useState<Character | null>(null)
  // 配角
  const [cast, setCast] = useState<CastEntry[]>([])
  const [castLoading, setCastLoading] = useState(false)
  const [selectedCast, setSelectedCast] = useState<CastEntry | null>(null)

  useEffect(() => { loadChars(); loadCast() }, [id])

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
                {filtered.map((c, i) => (
                  <div key={i} className="cursor-clickable" onClick={() => setSelected(c)}
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
                <div key={i} className="cursor-clickable" onClick={() => setSelectedCast(selectedCast?.name === c.name ? null : c)}
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

      </div>
    </div>
  )
}
