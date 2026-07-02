import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'

interface DimensionScore {
  dimension: string; score: number; verdict: 'pass' | 'warning' | 'fail'; comment: string
}
interface ConsistencyIssue {
  type: string; severity: 'critical' | 'error' | 'warning'; description: string; evidence?: string; suggestion?: string
}
interface ReviewEntry {
  chapter: number; scope: string; issues: ConsistencyIssue[]; dimensions: DimensionScore[]
  verdict: 'accept' | 'polish' | 'rewrite'; summary: string; affectedChapters: number[]
}

const DIM_LABELS: Record<string, string> = {
  consistency: '一致', character: '角色', pacing: '节奏', continuity: '连贯',
  foreshadow: '伏笔', hook: '钩子', aesthetic: '审美',
}
const DIM_COLORS: Record<string, string> = {
  consistency: '#7ec488', character: '#7ec5d8', pacing: '#e09b5a',
  continuity: '#a890d8', foreshadow: '#e5b449', hook: '#e07060', aesthetic: '#5fb8a3',
}

export default function ReviewsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [reviews, setReviews] = useState<ReviewEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)

  useEffect(() => { loadReviews() }, [id])

  async function loadReviews() {
    if (!id || !window.electronAPI) return
    setLoading(true)
    const data = await window.electronAPI.getBookReviews(id)
    setReviews(data || [])
    setLoading(false)
  }

  const review = reviews[selectedIdx]

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回</button>
        <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>评审管理</h2>
        <span className="text-dim" style={{ fontSize: 12 }}>{reviews.length} 条记录</span>
      </div>

      {loading ? <div className="text-dim">加载中...</div> : reviews.length === 0 ? (
        <div className="text-dim" style={{ marginTop: 60, textAlign: 'center' }}>暂无评审记录</div>
      ) : (
        <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>
          {/* 评审列表 */}
          <div style={{ width: 180, overflow: 'auto', borderRight: '1px solid var(--color-border)', paddingRight: 8, flexShrink: 0 }}>
            {reviews.map((r, i) => (
              <div key={r.chapter} className="cursor-clickable" onClick={() => setSelectedIdx(i)}
                style={{
                  padding: '6px 8px', borderRadius: 'var(--radius-sm)', marginBottom: 2,
                  background: selectedIdx === i ? 'var(--color-surface-2)' : 'transparent',
                  fontSize: 12, fontFamily: 'var(--font-mono)',
                }}>
                <span className="text-accent">#{r.chapter}</span>
                <span className="text-dim" style={{ marginLeft: 4 }}>
                  {r.verdict === 'accept' ? '✅' : r.verdict === 'polish' ? '🔧' : '🔁'}
                </span>
              </div>
            ))}
          </div>

          {/* 评审详情 */}
          {review && (
            <div style={{ flex: 1, overflow: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span className="mono text-accent" style={{ fontSize: 16, fontWeight: 'bold' }}>第{review.chapter}章 评审</span>
                  <span className="text-dim" style={{ marginLeft: 8, fontSize: 12 }}>{review.scope}</span>
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 'bold',
                  background: review.verdict === 'accept' ? 'rgba(126,196,136,0.2)' : review.verdict === 'polish' ? 'rgba(224,155,90,0.2)' : 'rgba(224,112,96,0.2)',
                  color: review.verdict === 'accept' ? '#7ec488' : review.verdict === 'polish' ? '#e09b5a' : '#e07060',
                }}>
                  {review.verdict === 'accept' ? '通过' : review.verdict === 'polish' ? '需打磨' : '需重写'}
                </span>
              </div>

              {/* 七维评分 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 16 }}>
                {['consistency', 'character', 'pacing', 'continuity', 'foreshadow', 'hook', 'aesthetic'].map(dim => {
                  const d = review.dimensions?.find(dd => dd.dimension === dim)
                  return (
                    <div key={dim} style={{
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius)', padding: '8px 10px', textAlign: 'center',
                    }}>
                      <div className="text-dim" style={{ fontSize: 11, marginBottom: 4 }}>{DIM_LABELS[dim] || dim}</div>
                      <div style={{
                        fontSize: 22, fontWeight: 'bold', color: DIM_COLORS[dim],
                      }}>{d?.score ?? '-'}</div>
                      <div style={{
                        fontSize: 10, color: d?.verdict === 'pass' ? '#7ec488' : d?.verdict === 'warning' ? '#e09b5a' : '#e07060',
                      }}>{d?.verdict === 'pass' ? '通过' : d?.verdict === 'warning' ? '警告' : '失败'}</div>
                    </div>
                  )
                })}
              </div>

              {review.summary && (
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 12 }}>
                  <div className="sidebar-section-header" style={{ fontSize: 11, marginBottom: 4 }}>摘要</div>
                  <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.6 }}>{review.summary}</div>
                </div>
              )}

              {/* 问题清单 */}
              {review.issues?.length > 0 && (
                <div>
                  <div className="sidebar-section-header" style={{ fontSize: 11, marginBottom: 8 }}>问题清单 ({review.issues.length})</div>
                  {review.issues.map((issue, i) => (
                    /* index acceptable: static issue list within a review, no UI reorder/delete */
                    <div key={i} style={{
                      padding: '8px 10px', marginBottom: 4, borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-surface)', borderLeft: `3px solid ${
                        issue.severity === 'critical' ? '#e07060' : issue.severity === 'error' ? '#e09b5a' : '#8a8175'
                      }`,
                    }}>
                      <div style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                        <span style={{
                          color: issue.severity === 'critical' ? '#e07060' : issue.severity === 'error' ? '#e09b5a' : '#8a8175',
                          fontWeight: 'bold',
                        }}>
                          {issue.severity === 'critical' ? '严重' : issue.severity === 'error' ? '错误' : '警告'}
                        </span>
                        <span className="text-dim">{issue.type}</span>
                      </div>
                      <div className="text-dim" style={{ fontSize: 12, marginTop: 2 }}>{issue.description}</div>
                      {issue.suggestion && <div className="text-accent2" style={{ fontSize: 11, marginTop: 2 }}>建议: {issue.suggestion}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}
