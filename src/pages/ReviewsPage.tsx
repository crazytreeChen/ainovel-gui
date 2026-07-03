import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import { useBookId } from '@/hooks/useBookId'
import BackButton from '@/components/BackButton'
import { useBookData } from '@/hooks/useBookData'
import RadarChart from '@/components/RadarChart'

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
  const id = useBookId()
  const navigate = useNavigate()
  const { data: reviews, loading } = useBookData<ReviewEntry[]>(
    async (bid) => (await window.electronAPI?.getBookReviews(bid)) ?? [],
    [],
  )

  const [selectedIdx, setSelectedIdx] = useState(0)

  const reviewList = reviews ?? []
  const review = reviewList[selectedIdx]

  return (
    <div className="flex-row p-24" style={{ height: '100vh', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div className="flex-1 flex-col overflow-hidden">
        <div className="flex-row items-center gap-12 mb-16 flex-shrink-0">
          <BackButton to={`/books/${id}/intro`} />
          <h2 className="mono text-accent m-0 text-lg">评审管理</h2>
          <span className="text-dim text-sm">{reviewList.length} 条记录</span>
        </div>

        {loading ? <div className="text-dim">加载中...</div> : reviewList.length === 0 ? (
          <div className="text-dim text-center mt-60">暂无评审记录</div>
        ) : (
          <div className="flex-1 flex-row gap-16 overflow-hidden">
            <div className="scroll-y border-right flex-shrink-0" style={{ width: 180, paddingRight: 8 }}>
              {reviewList.map((r) => (
                <div key={r.chapter} className="cursor-clickable mono text-sm"
                  onClick={() => setSelectedIdx(reviewList.indexOf(r))}
                  style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', marginBottom: 2,
                    background: reviewList.indexOf(r) === selectedIdx ? 'var(--color-surface-2)' : 'transparent' }}>
                  <span className="text-accent">#{r.chapter}</span>
                  <span className="text-dim" style={{ marginLeft: 4 }}>
                    {r.verdict === 'accept' ? '✅' : r.verdict === 'polish' ? '🔧' : '🔁'}
                  </span>
                </div>
              ))}
            </div>

            {review && (
              <div className="flex-1 scroll-y">
                <div className="flex-row items-center justify-between mb-12">
                  <div>
                    <span className="mono text-accent text-lg fw-bold">第{review.chapter}章 评审</span>
                    <span className="text-dim text-sm ml-8">{review.scope}</span>
                  </div>
                  <span className="tag-sm" style={{ padding: '4px 12px', fontWeight: 'bold',
                    background: review.verdict === 'accept' ? 'rgba(126,196,136,0.2)' : review.verdict === 'polish' ? 'rgba(224,155,90,0.2)' : 'rgba(224,112,96,0.2)',
                    color: review.verdict === 'accept' ? '#7ec488' : review.verdict === 'polish' ? '#e09b5a' : '#e07060' }}>
                    {review.verdict === 'accept' ? '通过' : review.verdict === 'polish' ? '需打磨' : '需重写'}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-start' }}>
                  <RadarChart
                    dimensions={review.dimensions || []}
                    labels={DIM_LABELS}
                    colors={DIM_COLORS}
                    size={180}
                  />
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                    {['consistency', 'character', 'pacing', 'continuity', 'foreshadow', 'hook', 'aesthetic'].map(dim => {
                      const d = review.dimensions?.find(dd => dd.dimension === dim)
                      return (
                        <div key={dim} className="card text-center" style={{ padding: '8px 10px' }}>
                          <div className="text-dim text-xs mb-8">{DIM_LABELS[dim] || dim}</div>
                          <div style={{ fontSize: 22, fontWeight: 'bold', color: DIM_COLORS[dim] }}>{d?.score ?? '-'}</div>
                          <div className="text-2xs" style={{ color: d?.verdict === 'pass' ? '#7ec488' : d?.verdict === 'warning' ? '#e09b5a' : '#e07060' }}>
                            {d?.verdict === 'pass' ? '通过' : d?.verdict === 'warning' ? '警告' : '失败'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {review.summary && (
                  <div className="card mb-12">
                    <div className="sidebar-section-header text-xs mb-8">摘要</div>
                    <div className="text-dim text-sm" style={{ lineHeight: 1.6 }}>{review.summary}</div>
                  </div>
                )}

                {review.issues?.length > 0 && (
                  <div>
                    <div className="sidebar-section-header text-xs mb-8">问题清单 ({review.issues.length})</div>
                    {review.issues.map((issue, i) => (
                      <div key={`${issue.type}-${issue.severity}-${i}`} style={{ padding: '8px 10px', marginBottom: 4, borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-surface)', borderLeft: `3px solid ${issue.severity === 'critical' ? '#e07060' : issue.severity === 'error' ? '#e09b5a' : '#8a8175'}` }}>
                        <div className="flex-row gap-8 text-sm">
                          <span style={{ color: issue.severity === 'critical' ? '#e07060' : issue.severity === 'error' ? '#e09b5a' : '#8a8175', fontWeight: 'bold' }}>
                            {issue.severity === 'critical' ? '严重' : issue.severity === 'error' ? '错误' : '警告'}
                          </span>
                          <span className="text-dim">{issue.type}</span>
                        </div>
                        <div className="text-dim text-sm mt-4">{issue.description}</div>
                        {issue.suggestion && <div className="text-accent2 text-xs mt-4">建议: {issue.suggestion}</div>}
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
