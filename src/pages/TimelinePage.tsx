import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'

interface TimelineEvent { chapter: number; time: string; event: string; characters: string[] }
interface ForeshadowEntry { id: string; description: string; plantedAt: number; status: string; resolvedAt?: number }
interface RelationshipEntry { characterA: string; characterB: string; relation: string; chapter: number }
interface StateChange { chapter: number; entity: string; field: string; oldValue: string; newValue: string; reason: string }

const FS_COLORS: Record<string, string> = { planted: '#e5b449', advanced: '#7ec5d8', resolved: '#7ec488' }
const FS_LABELS: Record<string, string> = { planted: '已埋设', advanced: '推进中', resolved: '已回收' }

export default function TimelinePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [foreshadows, setForeshadows] = useState<ForeshadowEntry[]>([])
  const [relations, setRelations] = useState<RelationshipEntry[]>([])
  const [stateChanges, setStateChanges] = useState<StateChange[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'timeline' | 'foreshadow' | 'relations'>('timeline')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    if (!id || !window.electronAPI) return
    setLoading(true)
    const data = await window.electronAPI.getBookTimeline(id)
    if (data) {
      setEvents(data.timeline || [])
      setForeshadows(data.foreshadow || [])
      setRelations(data.relationships || [])
      setStateChanges(data.stateChanges || [])
    }
    setLoading(false)
  }

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回</button>
        <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>时间线管理</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {([
            ['timeline', '事件时间线'],
            ['foreshadow', `伏笔台账 (${foreshadows.length})`],
            ['relations', `关系图谱 (${relations.length})`],
          ] as const).map(([k, label]) => (
            <button key={k} className={`welcome-mode-btn ${tab === k ? 'active' : ''}`}
              onClick={() => setTab(k as any)} style={{ fontSize: 11 }}>{label}</button>
          ))}
        </div>
      </div>

      {loading ? <div className="text-dim">加载中...</div> : (
        <div style={{ flex: 1, overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.8 }}>
          {tab === 'timeline' && (
            <div>
              {events.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span className="text-accent" style={{ minWidth: 40, fontWeight: 'bold' }}>#{ev.chapter}</span>
                  <span className="text-dim" style={{ minWidth: 70 }}>{ev.time || '-'}</span>
                  <span style={{ flex: 1 }}>{ev.event}</span>
                  {ev.characters?.length > 0 && <span className="text-accent2" style={{ fontSize: 11 }}>{ev.characters.join(', ')}</span>}
                </div>
              ))}
              {events.length === 0 && <div className="text-dim" style={{ marginTop: 40, textAlign: 'center' }}>暂无时间线事件</div>}
            </div>
          )}

          {tab === 'foreshadow' && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                {(['planted', 'advanced', 'resolved'] as const).map(s => (
                  <span key={s} style={{ fontSize: 11, color: FS_COLORS[s] }}>
                    ● {FS_LABELS[s]}: {foreshadows.filter(f => f.status === s).length}
                  </span>
                ))}
              </div>
              {foreshadows.map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--color-border)', alignItems: 'center' }}>
                  <span style={{ color: FS_COLORS[f.status], fontSize: 10 }}>●</span>
                  <span className="text-accent" style={{ minWidth: 40, fontWeight: 'bold' }}>#{f.plantedAt}</span>
                  <span style={{ flex: 1 }}>{f.description}</span>
                  <span className="text-dim" style={{ fontSize: 11 }}>[{FS_LABELS[f.status]}]</span>
                  {f.resolvedAt && <span className="text-success" style={{ fontSize: 11 }}>→ #{f.resolvedAt}</span>}
                </div>
              ))}
              {foreshadows.length === 0 && <div className="text-dim" style={{ marginTop: 40, textAlign: 'center' }}>暂无伏笔</div>}
            </div>
          )}

          {tab === 'relations' && (
            <div>
              {relations.map((r, i) => (
                <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span className="text-accent" style={{ fontWeight: 'bold' }}>{r.characterA}</span>
                  <span className="text-dim"> —[{r.relation}]— </span>
                  <span className="text-accent2" style={{ fontWeight: 'bold' }}>{r.characterB}</span>
                  <span className="text-dim" style={{ fontSize: 11, marginLeft: 8 }}>#{r.chapter}</span>
                </div>
              ))}
              {relations.length === 0 && <div className="text-dim" style={{ marginTop: 40, textAlign: 'center' }}>暂无关系记录</div>}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
