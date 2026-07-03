import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import { useBookId } from '@/hooks/useBookId'
import BackButton from '@/components/BackButton'

interface SummaryEntry {
  id?: number; type: string; refKey: string
  summary: string; characters: string[]; keyEvents: string[]
}

export default function SummaryPage() {
  const id = useBookId()
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

  if (loading) return <div className="text-dim p-32">加载中...</div>

  return (
    <div className="flex-row p-24" style={{ height: '100vh', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div className="flex-1 flex-col overflow-hidden">
        <div className="flex-row items-center gap-12 mb-16 flex-shrink-0">
          <BackButton to={`/books/${id}/intro`} />
          <h2 className="mono text-accent m-0 text-lg">摘要管理</h2>
          <span className="text-dim text-sm">{summaries.length} 条</span>
        </div>

        <div className="flex-row gap-8 mb-12 flex-shrink-0">
          {([
            ['chapter', '章节摘要'],
            ['arc', '弧摘要'],
            ['volume', '卷摘要'],
          ] as const).map(([k, label]) => (
            <button key={k} className={`welcome-mode-btn text-xs ${tab === k ? 'active' : ''}`}
              onClick={() => setTab(k)}>{label} ({(grouped[k] || []).length})</button>
          ))}
        </div>

        <div className="flex-1 scroll-y">
          {currentList.length === 0 ? (
            <div className="text-dim text-center mt-60">
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>📝</div>
              <div style={{ fontSize: 14 }}>暂无{tab === 'chapter' ? '章节' : tab === 'arc' ? '弧' : '卷'}摘要</div>
            </div>
          ) : (
            currentList.map((entry) => {
              const refKey = String(entry.refKey ?? '')
              const key = refKey || String(currentList.indexOf(entry))
              const isOpen = expanded.has(key)
              const label = tab === 'chapter' ? `第${refKey}章` :
                tab === 'arc' ? refKey.replace('arc-', '弧 ').replace('v', '第').replace('a', '弧') :
                refKey.replace('vol-', '第').replace('v', '卷 ')
              return (
                <div key={key} className="mb-8">
                  <div className="cursor-clickable flex-row items-center gap-8 card"
                    onClick={() => toggleExpand(key)}>
                    <span className="text-dim">{isOpen ? '▼' : '▶'}</span>
                    <span className="text-accent mono" style={{ fontWeight: 'bold', fontSize: 13 }}>{label}</span>
                    {entry.characters?.length > 0 && (
                      <span className="text-dim text-xs ml-8">{entry.characters.join(' · ')}</span>
                    )}
                  </div>
                  {isOpen && (
                    <div className="card-sm" style={{ margin: '0 4px', borderLeft: '2px solid var(--color-accent2)' }}>
                      <div className="text-dim text-sm" style={{ lineHeight: 1.7, marginBottom: 10 }}>
                        {entry.summary || '无摘要内容'}
                      </div>
                      {entry.keyEvents?.length > 0 && (
                        <div>
                          <div className="sidebar-section-header text-xs mb-8">关键事件 ({entry.keyEvents.length})</div>
                          <div className="flex-col gap-3">
                            {entry.keyEvents.map((ev, ei) => (
                              <div key={ei} className="text-sm card-sm flex-row" style={{ gap: 6, alignItems: 'flex-start' }}>
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
