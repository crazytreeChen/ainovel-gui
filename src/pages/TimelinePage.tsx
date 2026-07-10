import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import { useBookId } from '@/hooks/useBookId'
import BackButton from '@/components/BackButton'

interface TimelineEvent { chapter: number; time: string; event: string; characters: string[] }
interface ForeshadowEntry { id: string; description: string; plantedAt: number; status: string; resolvedAt?: number }
interface RelationshipEntry { characterA: string; characterB: string; relation: string; chapter: number }
interface StateChange { chapter: number; entity: string; field: string; oldValue: string; newValue: string; reason: string }

const FS_COLORS: Record<string, string> = { planted: 'var(--color-accent)', advanced: 'var(--color-tool)', resolved: 'var(--color-success)' }
const FS_LABELS: Record<string, string> = { planted: '已埋设', advanced: '推进中', resolved: '已回收' }

export default function TimelinePage() {
  const id = useBookId()
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
    <div className="flex-row p-24" style={{ height: '100vh', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div className="flex-1 flex-col overflow-hidden">
        <div className="flex-row items-center gap-12 mb-16 flex-shrink-0">
          <BackButton to={`/books/${id}/intro`} />
          <h2 className="mono text-accent m-0 text-lg">时间线管理</h2>
          <div className="ml-auto flex-row" style={{ gap: 6 }}>
            {([
              ['timeline', '事件时间线'],
              ['foreshadow', `伏笔台账 (${foreshadows.length})`],
              ['relations', `关系图谱 (${relations.length})`],
            ] as const).map(([k, label]) => (
              <button key={k} className={`welcome-mode-btn text-xs ${tab === k ? 'active' : ''}`}
                onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
        </div>

        {loading ? <div className="text-dim">加载中...</div> : (
          <div className="flex-1 scroll-y mono text-sm" style={{ lineHeight: 1.8 }}>
            {tab === 'timeline' && (
              <div>
                {events.map((ev) => (
                  <div key={`ev-${ev.chapter}-${ev.event}`} className="flex-row gap-12 border-bottom" style={{ padding: '4px 0' }}>
                    <span className="text-accent" style={{ minWidth: 40, fontWeight: 'bold' }}>#{ev.chapter}</span>
                    <span className="text-dim" style={{ minWidth: 70 }}>{ev.time || '-'}</span>
                    <span className="flex-1">{ev.event}</span>
                    {ev.characters?.length > 0 && <span className="text-accent2 text-xs">{ev.characters.join(', ')}</span>}
                  </div>
                ))}
                {events.length === 0 && <div className="text-dim text-center mt-40">暂无时间线事件</div>}
              </div>
            )}

            {tab === 'foreshadow' && (
              <div>
                <div className="flex-row gap-12 mb-8 flex-wrap">
                  {(['planted', 'advanced', 'resolved'] as const).map(s => (
                    <span key={s} style={{ fontSize: 11, color: FS_COLORS[s] }}>
                      ● {FS_LABELS[s]}: {foreshadows.filter(f => f.status === s).length}
                    </span>
                  ))}
                </div>
                {foreshadows.map((f) => (
                  <div key={f.id} className="flex-row gap-8 border-bottom items-center" style={{ padding: '4px 0' }}>
                    <span style={{ color: FS_COLORS[f.status], fontSize: 10 }}>●</span>
                    <span className="text-accent" style={{ minWidth: 40, fontWeight: 'bold' }}>#{f.plantedAt}</span>
                    <span className="flex-1">{f.description}</span>
                    <span className="text-dim text-xs">[{FS_LABELS[f.status]}]</span>
                    {f.resolvedAt && <span className="text-success text-xs">→ #{f.resolvedAt}</span>}
                  </div>
                ))}
                {foreshadows.length === 0 && <div className="text-dim text-center mt-40">暂无伏笔</div>}
              </div>
            )}

            {tab === 'relations' && (
              <div>
                {relations.map((r) => (
                  <div key={`rel-${r.characterA}-${r.characterB}`} className="border-bottom" style={{ padding: '4px 0' }}>
                    <span className="text-accent fw-bold">{r.characterA}</span>
                    <span className="text-dim"> —[{r.relation}]— </span>
                    <span className="text-accent2 fw-bold">{r.characterB}</span>
                    <span className="text-dim text-xs ml-8">#{r.chapter}</span>
                  </div>
                ))}
                {relations.length === 0 && <div className="text-dim text-center mt-40">暂无关系记录</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
