import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import { useBookId } from '@/hooks/useBookId'

interface ChapterInfo {
  num: number; title: string; wordCount: number
}

interface UsageData {
  total_input?: number; total_output?: number
  total_cost?: number; total_saved?: number
  cache_read?: number; cache_write?: number
  per_model?: Record<string, { input: number; output: number; cost: number }>
  per_agent?: Record<string, { input: number; output: number }>
}

export default function DashboardPage() {
  const id = useBookId()
  const navigate = useNavigate()
  const [book, setBook] = useState<any>(null)
  const [chapters, setChapters] = useState<ChapterInfo[]>([])
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id || !window.electronAPI) return
    setLoading(true)
    Promise.all([
      window.electronAPI.getBook(id),
      window.electronAPI.getBookChapters(id),
      window.electronAPI.getUsageStats(id).catch(() => null),
    ]).then(([b, chs, u]) => {
      setBook(b)
      setChapters(chs || [])
      setUsage(u)
      setLoading(false)
    })
  }, [id])

  const totalWords = book?.totalWordCount ?? chapters.reduce((sum, ch) => sum + (ch.wordCount || 0), 0)
  const maxWordCount = Math.max(...chapters.map(ch => ch.wordCount || 0), 1)
  const completedChapters = chapters.filter(ch => (ch.wordCount || 0) > 0).length

  if (loading) return <div className="text-dim" style={{ padding: 32 }}>加载中...</div>

  return (
    <div className="flex-row p-24" style={{ height: '100vh', gap: 16 }}>
      <BookNavSidebar bookId={id || ''} />
      <div className="flex-1 scroll-y">
        <div className="flex-row items-center gap-12 mb-16">
          <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}/intro`)}>← 返回</button>
          <h2 className="mono text-accent m-0" style={{ fontSize: 16 }}>📊 写作统计</h2>
        </div>

        {/* 概览卡片 — 3 列 */}
        <div className="flex-row gap-8 mb-12">
          <div className="card flex-1" style={{ padding: '10px 12px' }}>
            <div className="text-dim text-xs mb-4">总字数</div>
            <div className="text-accent fw-bold" style={{ fontSize: 18 }}>{totalWords.toLocaleString()}</div>
          </div>
          <div className="card flex-1" style={{ padding: '10px 12px' }}>
            <div className="text-dim text-xs mb-4">完成章节</div>
            <div className="text-accent fw-bold" style={{ fontSize: 18 }}>{completedChapters}/{chapters.length}</div>
          </div>
          <div className="card flex-1" style={{ padding: '10px 12px' }}>
            <div className="text-dim text-xs mb-4">平均每章</div>
            <div className="text-accent fw-bold" style={{ fontSize: 18 }}>{chapters.length > 0 ? Math.round(totalWords / chapters.length).toLocaleString() : 0}</div>
          </div>
        </div>

        {/* Token & 成本 */}
        {usage && (
          <>
          <div className="flex-row gap-8 mb-12 flex-wrap">
            <div className="card" style={{ padding: '8px 10px', flex: '1 1 120px' }}>
              <div className="text-dim text-xs mb-4">输入 Tokens</div>
              <div className="text-accent2 fw-bold" style={{ fontSize: 13 }}>{(usage.total_input || 0).toLocaleString()}</div>
            </div>
            <div className="card" style={{ padding: '8px 10px', flex: '1 1 120px' }}>
              <div className="text-dim text-xs mb-4">输出 Tokens</div>
              <div className="text-accent2 fw-bold" style={{ fontSize: 13 }}>{(usage.total_output || 0).toLocaleString()}</div>
            </div>
            <div className="card" style={{ padding: '8px 10px', flex: '1 1 100px' }}>
              <div className="text-dim text-xs mb-4">费用</div>
              <div className="text-accent fw-bold" style={{ fontSize: 13 }}>${(usage.total_cost || 0).toFixed(4)}</div>
            </div>
            {usage.total_saved ? (
              <div className="card" style={{ padding: '8px 10px', flex: '1 1 100px' }}>
                <div className="text-dim text-xs mb-4">节省</div>
                <div className="text-success fw-bold" style={{ fontSize: 13 }}>${usage.total_saved.toFixed(4)}</div>
              </div>
            ) : null}
          </div>

          {/* 按模型消耗 */}
          {usage.per_model && Object.keys(usage.per_model).length > 0 && (
            <div className="card mb-12" style={{ padding: '10px 12px' }}>
              <div className="sidebar-section-header mb-8" style={{ fontSize: 11 }}>各模型消耗</div>
              {Object.entries(usage.per_model).slice(0, 8).map(([model, stats]) => (
                <div key={model} className="flex-row items-center gap-8 mb-4" style={{ fontSize: 11 }}>
                  <span className="text-dim flex-1 truncate">{model.split('/').pop()}</span>
                  <span className="text-dim mono">{(stats.input || 0).toLocaleString()} / {(stats.output || 0).toLocaleString()}</span>
                  {stats.cost ? <span className="text-accent mono">${stats.cost.toFixed(4)}</span> : null}
                </div>
              ))}
            </div>
          )}
          </>)}
        {/* 章节字数分布 */}
        {chapters.length > 0 && (
          <div className="card" style={{ padding: '10px 12px' }}>
            <div className="sidebar-section-header mb-8" style={{ fontSize: 11 }}>各章节字数分布</div>
            {chapters.map((ch) => {
              const wc = ch.wordCount || 0
              const pct = maxWordCount > 0 ? (wc / maxWordCount) * 100 : 0
              return (
                <div key={ch.num} className="flex-row items-center gap-6" style={{ fontSize: 11, height: 14 }}>
                  <span className="text-dim mono flex-shrink-0" style={{ width: 28 }}>#{ch.num}</span>
                  <div className="flex-1" style={{ height: 10, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.max(pct, 2)}%`, height: '100%',
                      background: wc > 0 ? 'var(--color-accent2)' : 'var(--color-dim)',
                      borderRadius: 2, opacity: wc > 0 ? 0.8 : 0.3,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <span className="text-dim mono flex-shrink-0" style={{ width: 60, textAlign: 'right' }}>{wc.toLocaleString()}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* 空状态 */}
        {chapters.length === 0 && (
          <div className="text-dim text-center mt-60">
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>📊</div>
            <div style={{ fontSize: 14 }}>暂无统计数据</div>
            <div className="text-xs mt-8">开始创作后将自动记录写作数据</div>
          </div>
        )}
      </div>
    </div>
  )
}
