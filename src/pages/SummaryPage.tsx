import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'

interface SummaryEntry {
  id?: number; type: string; refKey: string
  summary: string; characters: string[]; keyEvents: string[]
}

export default function SummaryPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [summaries, setSummaries] = useState<SummaryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'chapter' | 'arc' | 'volume'>('chapter')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    if (!id || !window.electronAPI) return
    setLoading(true)
    const data = await window.electronAPI.getBookSummaries(id)
    setSummaries(data || [])
    setLoading(false)
  }

  const grouped = summaries.reduce<Record<string, SummaryEntry[]>>((acc, s) => {
    const key = s.type || 'chapter'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const currentList = grouped[tab] || []

  function toggleExpand(key: string) {
    const next = new Set(expanded)
    if (next.has(key)) next.delete(key); else next.add(key)
    setExpanded(next)
  }

  if (loading) return <div className="text-dim" style={{ padding: 32 }}>加载中...</div>

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
          <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回</button>
          <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>摘要管理</h2>
          <span className="text-dim" style={{ fontSize: 12 }}>{summaries.length} 条</span>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
          {([
            ['chapter', '章节摘要'],
            ['arc', '弧摘要'],
            ['volume', '卷摘要'],
          ] as const).map(([k, label]) => (
            <button key={k} className={`welcome-mode-btn ${tab === k ? 'active' : ''}`}
              onClick={() => setTab(k as any)} style={{ fontSize: 11 }}>
              {label} ({(grouped[k] || []).length})
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto' }}>
          {currentList.length === 0 ? (
            <div className="text-dim" style={{ marginTop: 60, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>📝</div>
              <div style={{ fontSize: 14 }}>暂无{tab === 'chapter' ? '章节' : tab === 'arc' ? '弧' : '卷'}摘要</div>
            </div>
          ) : (
            currentList.map((entry, i) => {
              const key = entry.refKey || String(i)
              const isOpen = expanded.has(key)
              const label = tab === 'chapter' ? `第${entry.refKey}章` :
                tab === 'arc' ? entry.refKey.replace('arc-', '弧 ').replace('v', '第').replace('a', '弧') :
                entry.refKey.replace('vol-', '第').replace('v', '卷 ')
              return (
                <div key={key} style={{ marginBottom: 8 }}>
                  <div
                    className="cursor-clickable"
                    onClick={() => toggleExpand(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius)', cursor: 'pointer',
                    }}
                  >
                    <span className="text-dim">{isOpen ? '▼' : '▶'}</span>
                    <span className="text-accent mono" style={{ fontWeight: 'bold', fontSize: 13 }}>{label}</span>
                    {entry.characters?.length > 0 && (
                      <span className="text-dim" style={{ fontSize: 11, marginLeft: 8 }}>
                        {entry.characters.join(' · ')}
                      </span>
                    )}
                  </div>
                  {isOpen && (
                    <div style={{ padding: '10px 14px', margin: '0 4px', borderLeft: '2px solid var(--color-accent2)' }}>
                      <div className="text-dim" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>
                        {entry.summary || '无摘要内容'}
                      </div>
                      {entry.keyEvents?.length > 0 && (
                        <div>
                          <div className="sidebar-section-header" style={{ fontSize: 11, marginBottom: 6 }}>
                            关键事件 ({entry.keyEvents.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {entry.keyEvents.map((ev, ei) => (
                              <div key={ei} style={{
                                padding: '4px 8px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                display: 'flex', gap: 6, alignItems: 'flex-start',
                              }}>
                                <span className="text-accent2" style={{ fontWeight: 'bold', flexShrink: 0 }}>#{ei + 1}</span>
                                <span className="text-dim">{ev}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
