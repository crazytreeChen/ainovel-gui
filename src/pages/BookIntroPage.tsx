import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import BookCover from '@/components/BookCover'
import { getPhaseLabel } from '@/lib/utils/phaseLabel'

const PAGE_SIZE = 60

export default function BookIntroPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<any>(null)
  const [chapters, setChapters] = useState<{ num: number; title: string; wordCount: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!id || !window.electronAPI) return
    Promise.all([
      window.electronAPI.listBooks(),
      window.electronAPI.getBookChapters(id),
    ]).then(([books, chs]) => {
      const b = books.find((x: any) => x.id === id)
      if (b) setBook(b)
      setChapters(chs || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  const totalPages = Math.ceil(chapters.length / PAGE_SIZE)
  const start = (page - 1) * PAGE_SIZE
  const pageChapters = chapters.slice(start, start + PAGE_SIZE)

  if (loading) return <div className="text-dim p-32">加载中...</div>

  return (
    <div className="flex-row p-24" style={{ height: '100vh', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div className="flex-1 flex-col overflow-hidden">
        <div className="flex-row items-center gap-12 mb-16 flex-shrink-0">
          <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}/workspace?mode=writing`)}>← 工作台</button>
          <h2 className="mono text-accent m-0 text-lg">书籍简介</h2>
        </div>

        {book && (
          <div className="card flex-row gap-16 mb-16 flex-shrink-0" style={{ padding: 16 }}>
            <BookCover bookId={id || ''} size="medium" />
            <div className="flex-1">
              <div className="text-lg" style={{ fontWeight: 'bold', color: 'var(--color-text)', marginBottom: 4 }}>{book.name}</div>
              <div className="text-dim text-xs mono" style={{ lineHeight: 1.8 }}>
                <div>{getPhaseLabel(book.phase)} · {book.completedCount || 0} 章 · {(book.totalWordCount || 0).toLocaleString()} 字 · 风格: {book.style || 'default'}</div>
              </div>
              <div className="flex-row flex-wrap mt-8" style={{ gap: 6 }}>
                <button className="welcome-mode-btn active" onClick={() => navigate(`/books/${id}/workspace?mode=writing`)}>✍️ 开始创作</button>
                <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}/outline`)}>📋 大纲</button>
                <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}/characters`)}>👤 角色</button>
                <button className="welcome-mode-btn" onClick={() => navigate('/settings/models')}>⚙️ 模型</button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 scroll-y">
          <div className="sidebar-section-header text-sm mb-8">章节列表 ({chapters.length} 章)</div>

          {chapters.length === 0 ? (
            <div className="text-dim text-center p-32">暂无章节，进入工作台开始创作</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                {pageChapters.map(ch => (
                  <div key={ch.num} className="cursor-clickable card-sm flex-row items-center gap-6 mono text-sm"
                    onClick={() => navigate(`/books/${id}/chapters/${ch.num}`)}>
                    <span className="text-accent" style={{ fontWeight: 'bold', minWidth: 28, flexShrink: 0 }}>#{ch.num}</span>
                    <span className="flex-1 truncate" style={{ color: 'var(--color-text)' }}>{ch.title}</span>
                    <span className="text-dim text-xs flex-shrink-0">{ch.wordCount.toLocaleString()}字</span>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex-row items-center justify-center gap-8 mt-12 p-8 flex-shrink-0">
                  <button className="welcome-mode-btn btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                    ← 上一页
                  </button>
                  <div className="text-dim mono text-sm">{page} / {totalPages}</div>
                  <button className="welcome-mode-btn btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    下一页 →
                  </button>
                  <span className="text-xs ml-8">
                    <select value={page} onChange={e => setPage(parseInt(e.target.value))}>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <option key={i + 1} value={i + 1}>第{i + 1}页</option>
                      ))}
                    </select>
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
