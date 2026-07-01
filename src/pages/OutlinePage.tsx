import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'

interface OutlineEntry { chapter: number; title: string; coreEvent: string; hook: string; scenes: string[] }
interface ArcOutline { index: number; title: string; goal: string; estimatedChapters?: number; chapters: OutlineEntry[] }
interface VolumeOutline { index: number; title: string; theme: string; arcs: ArcOutline[] }
interface StoryCompass { endingDirection: string; openThreads: string[]; estimatedScale: string; lastUpdated: number }

export default function OutlinePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [outline, setOutline] = useState<OutlineEntry[]>([])
  const [layered, setLayered] = useState<VolumeOutline[]>([])
  const [compass, setCompass] = useState<StoryCompass | null>(null)
  const [premise, setPremise] = useState('')
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'flat' | 'layered'>('flat')
  const [expandedVols, setExpandedVols] = useState<Set<number>>(new Set([0]))

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    if (!id || !window.electronAPI) return
    setLoading(true)
    const data = await window.electronAPI.getBookOutline(id)
    if (data) {
      setOutline(data.outline || [])
      setLayered(data.layeredOutline || [])
      setCompass(data.compass)
      setPremise(data.premise || '')
      if (data.layeredOutline?.length > 0) setMode('layered')
    }
    setLoading(false)
  }

  function toggleVolume(idx: number) {
    const next = new Set(expandedVols)
    if (next.has(idx)) next.delete(idx); else next.add(idx)
    setExpandedVols(next)
  }

  if (loading) return <div className="text-dim" style={{ padding: 32 }}>加载中...</div>

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 导航 + 侧边栏 */}
      <div style={{ display: 'flex', gap: 24, flex: 1, overflow: 'hidden' }}>
        <BookNavSidebar bookId={id || ''} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* 导航 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回工作台</button>
        <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>大纲管理</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className={`welcome-mode-btn ${mode === 'flat' ? 'active' : ''}`} onClick={() => setMode('flat')}>扁平</button>
          <button className={`welcome-mode-btn ${mode === 'layered' ? 'active' : ''}`} onClick={() => setMode('layered')}>分层</button>
        </div>
      </div>

      {/* 前提 */}
      {premise && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 16, flexShrink: 0 }}>
          <div className="sidebar-section-header">前提</div>
          <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.6, maxHeight: 60, overflow: 'hidden' }}>{premise}</div>
        </div>
      )}

      {/* 大纲内容 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {mode === 'flat' && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            {outline.map((entry, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                borderBottom: '1px solid var(--color-border)',
              }}>
                <span className="text-dim" style={{ minWidth: 24 }}>{entry.chapter}</span>
                <span style={{ flex: 1 }}>{entry.title}</span>
                {entry.coreEvent && <span className="text-dim" style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.coreEvent}</span>}
              </div>
            ))}
            {outline.length === 0 && <div className="text-dim" style={{ textAlign: 'center', marginTop: 40 }}>暂未规划大纲</div>}
          </div>
        )}

        {mode === 'layered' && (
          <div>
            {layered.map((vol, vi) => (
              <div key={vi} style={{ marginBottom: 8 }}>
                <div
                  className="cursor-clickable"
                  onClick={() => toggleVolume(vi)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                  }}
                >
                  <span className="text-dim">{expandedVols.has(vi) ? '▼' : '▶'}</span>
                  <span className="text-accent mono" style={{ fontWeight: 'bold' }}>第{vol.index}卷: {vol.title}</span>
                  <span className="text-dim" style={{ fontSize: 11 }}>{vol.theme}</span>
                  <span className="text-dim" style={{ fontSize: 11, marginLeft: 'auto' }}>{vol.arcs.length} 弧</span>
                </div>
                {expandedVols.has(vi) && (
                  <div style={{ marginLeft: 28, marginTop: 4 }}>
                    {vol.arcs.map((arc, ai) => (
                      <div key={ai} style={{ marginBottom: 4, padding: '6px 8px', borderLeft: '2px solid var(--color-accent2)', marginLeft: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="text-accent2 mono" style={{ fontWeight: 'bold', fontSize: 12 }}>
                            弧{arc.index}: {arc.title}
                          </span>
                          {arc.estimatedChapters ? (
                            <span className="text-dim" style={{ fontSize: 11 }}>[骨架弧, 预计{arc.estimatedChapters}章]</span>
                          ) : (
                            <span className="text-dim" style={{ fontSize: 11 }}>{arc.chapters?.length || 0}章</span>
                          )}
                        </div>
                        {arc.goal && <div className="text-dim" style={{ fontSize: 11, marginTop: 2 }}>目标: {arc.goal}</div>}
                        {arc.chapters?.map((ch, ci) => (
                          <div key={ci} className="text-dim" style={{ fontSize: 12, marginLeft: 16, marginTop: 2 }}>
                            · {ch.title}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {layered.length === 0 && <div className="text-dim" style={{ textAlign: 'center', marginTop: 40 }}>暂未设置分层大纲</div>}
          </div>
        )}
      </div>

      {/* 指南针 */}
      {compass && (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 12, marginTop: 16, flexShrink: 0 }}>
          <div className="sidebar-section-header">指南针</div>
          <div className="text-dim" style={{ fontSize: 12 }}>
            <div>终局: {compass.endingDirection}</div>
            {compass.openThreads?.length > 0 && <div>活跃长线: {compass.openThreads.join(' / ')}</div>}
            {compass.estimatedScale && <div>规模: {compass.estimatedScale}</div>}
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  )
}
