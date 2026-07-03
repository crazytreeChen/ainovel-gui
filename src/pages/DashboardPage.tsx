import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import { useBookId } from '@/hooks/useBookId'

interface ChapterInfo {
  num: number; title: string; wordCount: number
}

interface UsageData {
  totalInputTokens?: number; totalOutputTokens?: number
  totalCostUSD?: number; totalSavedUSD?: number
  cacheReadTokens?: number; cacheWriteTokens?: number
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
    <div className="flex-row p-24" style={{ height: '100vh', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div className="flex-1 scroll-y">
        <div className="flex-row items-center gap-12 mb-16 flex-shrink-0">
          <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回</button>
          <h2 className="mono text-accent m-0 text-lg">📊 写作统计</h2>
        </div>

        {/* 概览卡片 */}
        <div className="flex-row gap-12 mb-16 flex-wrap">
          <div className="card flex-1" style={{ minWidth: 140 }}>
            <div className="text-dim text-xs mb-4">总字数</div>
            <div className="text-accent text-lg fw-bold">{totalWords.toLocaleString()}</div>
          </div>
          <div className="card flex-1" style={{ minWidth: 140 }}>
            <div className="text-dim text-xs mb-4">完成章节</div>
            <div className="text-accent text-lg fw-bold">{completedChapters}/{chapters.length}</div>
          </div>
          <div className="card flex-1" style={{ minWidth: 140 }}>
            <div className="text-dim text-xs mb-4">平均每章</div>
            <div className="text-accent text-lg fw-bold">{chapters.length > 0 ? Math.round(totalWords / chapters.length).toLocaleString() : 0}</div>
          </div>
        </div>

        {/* Token & 成本 */}
        {usage && (
          <div className="flex-row gap-12 mb-16 flex-wrap">
            <div className="card flex-1" style={{ minWidth: 140 }}>
              <div className="text-dim text-xs mb-4">输入 Tokens</div>
              <div className="text-accent2 text-sm fw-bold">{(usage.totalInputTokens ?? 0).toLocaleString()}</div>
            </div>
            <div className="card flex-1" style={{ minWidth: 140 }}>
              <div className="text-dim text-xs mb-4">输出 Tokens</div>
              <div className="text-accent2 text-sm fw-bold">{(usage.totalOutputTokens ?? 0).toLocaleString()}</div>
            </div>
            <div className="card flex-1" style={{ minWidth: 140 }}>
              <div className="text-dim text-xs mb-4">总成本</div>
              <div className="text-accent text-sm fw-bold">${(usage.totalCostUSD ?? 0).toFixed(2)}</div>
            </div>
            {usage.totalSavedUSD ? (
              <div className="card flex-1" style={{ minWidth: 140 }}>
                <div className="text-dim text-xs mb-4">节省成本</div>
                <div className="text-success text-sm fw-bold">${usage.totalSavedUSD.toFixed(2)}</div>
              </div>
            ) : null}
          </div>
        )}

        {/* 章节字数分布 */}
        {chapters.length > 0 && (
          <div className="card mb-16">
            <div className="sidebar-section-header mb-12">各章节字数分布</div>
            {chapters.map((ch) => {
              const wc = ch.wordCount || 0
              const pct = maxWordCount > 0 ? (wc / maxWordCount) * 100 : 0
              return (
                <div key={ch.num} className="flex-row items-center gap-8 mb-4" style={{ fontSize: 12 }}>
                  <span className="text-dim mono flex-shrink-0" style={{ width: 32 }}>#{ch.num}</span>
                  <div className="flex-1" style={{ height: 16, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.max(pct, 2)}%`, height: '100%',
                      background: wc > 0 ? 'var(--color-accent2)' : 'var(--color-dim)',
                      borderRadius: 3, opacity: wc > 0 ? 0.8 : 0.3,
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <span className="text-dim mono flex-shrink-0" style={{ width: 70, textAlign: 'right' }}>{wc.toLocaleString()}</span>
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
