import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import BookCover from '@/components/BookCover'
import { getPhaseLabel } from '@/lib/utils/phaseLabel'

const PAGE_SIZE = 60 // 3 列 × 20 行 = 60 章/页

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

  if (loading) return <div className="text-dim" style={{ padding: 32 }}>加载中...</div>

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 返回 + 书名 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
          <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}/workspace?mode=writing`)}>← 工作台</button>
          <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>书籍简介</h2>
        </div>

        {/* 书籍信息卡片 */}
        {book && (
          <div style={{
            display: 'flex', gap: 16, padding: 16, marginBottom: 16, flexShrink: 0,
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
          }}>
            <BookCover bookId={id || ''} size="medium" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 'bold', color: 'var(--color-text)', marginBottom: 4 }}>{book.name}</div>
              <div className="text-dim" style={{ fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.8 }}>
                <div>{getPhaseLabel(book.phase)} · {book.completedCount || 0} 章 · {(book.totalWordCount || 0).toLocaleString()} 字 · 风格: {book.style || 'default'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <button className="welcome-mode-btn active" onClick={() => navigate(`/books/${id}/workspace?mode=writing`)}>✍️ 开始创作</button>
                <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}/outline`)}>📋 大纲</button>
                <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}/characters`)}>👤 角色</button>
                <button className="welcome-mode-btn" onClick={() => navigate('/settings/models')}>⚙️ 模型</button>
              </div>
            </div>
          </div>
        )}

        {/* 章节列表 — 紧凑网格 3 列 */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div className="sidebar-section-header" style={{ fontSize: 12, marginBottom: 8 }}>
            章节列表 ({chapters.length} 章)
          </div>

          {chapters.length === 0 ? (
            <div className="text-dim" style={{ textAlign: 'center', padding: 40 }}>
              暂无章节，进入工作台开始创作
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                {pageChapters.map(ch => (
                  <div
                    key={ch.num}
                    className="cursor-clickable"
                    onClick={() => navigate(`/books/${id}/chapters/${ch.num}`)}
                    style={{
                      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                      cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-mono)',
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'border-color 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
                  >
                    <span className="text-accent" style={{ fontWeight: 'bold', minWidth: 28, flexShrink: 0 }}>#{ch.num}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text)' }}>
                      {ch.title}
                    </span>
                    <span className="text-dim" style={{ fontSize: 10, flexShrink: 0 }}>
                      {ch.wordCount.toLocaleString()}字
                    </span>
                  </div>
                ))}
              </div>

              {/* 分页 */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6,
                  marginTop: 12, padding: 8, flexShrink: 0,
                }}>
                  <button className="welcome-mode-btn" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                    style={{ fontSize: 11, padding: '4px 10px' }}>
                    ← 上一页
                  </button>
                  <div className="text-dim mono" style={{ fontSize: 12 }}>
                    {page} / {totalPages}
                  </div>
                  <button className="welcome-mode-btn" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    style={{ fontSize: 11, padding: '4px 10px' }}>
                    下一页 →
                  </button>
                  <span style={{ fontSize: 11, marginLeft: 8 }}>
                    <select
                      value={page}
                      onChange={e => setPage(parseInt(e.target.value))}
                      style={{
                        padding: '3px 6px', background: 'var(--color-bg)', color: 'var(--color-text)',
                        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                        fontSize: 11, outline: 'none',
                      }}
                    >
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
