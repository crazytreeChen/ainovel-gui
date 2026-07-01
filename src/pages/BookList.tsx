import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import BookCover from '@/components/BookCover'

interface BookItem {
  id: string
  name: string
  style: string
  phase: string
  flow: string
  completedCount: number
  totalWordCount: number
  createdAt: string
  lastOpenedAt: string
  workspaceDir?: string
}

export default function BookList() {
  const navigate = useNavigate()
  const [books, setBooks] = useState<BookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editBook, setEditBook] = useState<BookItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editStyle, setEditStyle] = useState('default')
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => { loadBooks() }, [])

  async function loadBooks() {
    setLoading(true)
    try {
      if (window.electronAPI) {
        const list = await window.electronAPI.listBooks()
        setBooks(list || [])
      }
    } catch (e) { console.error('loadBooks error:', e) }
    setLoading(false)
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('确认删除此书籍？')) return
    if (window.electronAPI) {
      await window.electronAPI.deleteBook(id)
      await loadBooks()
    }
  }

  function handleEditClick(book: BookItem, e: React.MouseEvent) {
    e.stopPropagation()
    setEditBook(book)
    setEditName(book.name)
    setEditStyle(book.style || 'default')
  }

  async function handleEditSave() {
    if (!editBook || !editName.trim() || !window.electronAPI) return
    setEditSaving(true)
    await window.electronAPI.updateBook(editBook.id, { name: editName.trim(), style: editStyle })
    setEditSaving(false)
    setEditBook(null)
    await loadBooks()
  }

  async function handleImport() {
    if (!window.electronAPI) return
    const dir = await window.electronAPI.selectDirectory()
    if (!dir) return

    // 扫描工作目录
    const info = await window.electronAPI.scanWorkspace(dir)
    if (!info) {
      alert('所选目录不是有效的 ainovel-cli 工作目录（缺少 output/ 子目录）')
      return
    }

    // 确认导入
    const msg = `检测到作品：${info.name || '未命名'}\n` +
      `阶段: ${info.phase || 'init'}\n` +
      `章节: ${info.chapterCount || 0}\n` +
      `字数: ${(info.totalWordCount || 0).toLocaleString()}\n\n` +
      `确认导入此作品？`
    if (!confirm(msg)) return

    const book = await window.electronAPI.importWorkspace(dir)
    if (book) {
      await loadBooks()
    } else {
      alert('导入失败')
    }
  }

  const phaseLabel: Record<string, string> = {
    init: '初始化', premise: '前提', outline: '大纲',
    writing: '写作', complete: '完成',
  }

  return (
    <div style={{ padding: 32, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexShrink: 0 }}>
        <div>
          <h1 style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', fontSize: 28, letterSpacing: 6, margin: 0 }}>AINOVEL</h1>
          <div className="text-dim" style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>AI-Powered Novel Creation Studio</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="welcome-mode-btn" onClick={() => navigate('/books/new')}>+ 新建书籍</button>
          <button className="welcome-mode-btn" onClick={handleImport}>📂 打开目录</button>
        </div>
      </div>

      {/* 书籍列表 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading && (
          <div className="text-dim" style={{ textAlign: 'center', marginTop: 60, fontSize: 14 }}>
            加载中...
          </div>
        )}

        {!loading && books.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 80, color: 'var(--color-dim)' }}>
            <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>📖</div>
            <p style={{ fontSize: 16, marginBottom: 8 }}>还没有书籍</p>
            <p style={{ fontSize: 13 }}>点击"新建书籍"开始创作，或"打开目录"导入已有作品</p>
          </div>
        )}

        {!loading && books.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
            {books.map(book => (
              <div
                key={book.id}
                className="cursor-clickable"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: 16,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                  display: 'flex',
                  gap: 16,
                }}
                onClick={() => navigate(`/books/${book.id}`)}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
              >
                <BookCover bookId={book.id} size="small" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.name}</div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={(e) => handleEditClick(book, e)}
                        style={{
                          background: 'none', border: 'none', color: 'var(--color-dim)',
                          cursor: 'pointer', fontSize: 12, padding: '0 4px',
                        }}
                        title="编辑"
                      >✎</button>
                      <button
                        onClick={(e) => handleDelete(book.id, e)}
                        style={{
                          background: 'none', border: 'none', color: 'var(--color-dim)',
                          cursor: 'pointer', fontSize: 14, padding: '0 4px',
                        }}
                        title="删除"
                      >✕</button>
                    </div>
                  </div>
                  <div className="mono text-dim" style={{ fontSize: 11, lineHeight: 1.7 }}>
                    <div>状态: {phaseLabel[book.phase] || book.phase} · {book.completedCount || 0} 章 · {(book.totalWordCount || 0).toLocaleString()} 字</div>
                    <div>风格: {book.style || 'default'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部导航 */}
      <div className="text-dim" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', paddingTop: 12, borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
        <Link to="/settings" style={{ color: 'var(--color-dim)', textDecoration: 'none' }}>系统设置</Link>
        {' · '}
        <Link to="/settings/models" style={{ color: 'var(--color-dim)', textDecoration: 'none' }}>模型管理</Link>
      </div>

      {/* 编辑书籍弹窗 */}
      {editBook && (
        <div className="modal-overlay" onClick={() => setEditBook(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 400, maxWidth: 450 }}>
            <button className="modal-close" onClick={() => setEditBook(null)}>✕</button>
            <div className="modal-title">编辑书籍</div>

            <div style={{ marginBottom: 14 }}>
              <label className="text-muted" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>书名</label>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEditSave()}
                style={{ width: '100%', padding: '8px 12px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 13 }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="text-muted" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>写作风格</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { key: 'default', label: '通用' },
                  { key: 'fantasy', label: '仙侠/玄幻' },
                  { key: 'suspense', label: '悬疑推理' },
                  { key: 'romance', label: '言情' },
                ].map(s => (
                  <button key={s.key}
                    className={`welcome-mode-btn ${editStyle === s.key ? 'active' : ''}`}
                    onClick={() => setEditStyle(s.key)}
                    style={{ fontSize: 12 }}
                  >{s.label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="welcome-mode-btn" onClick={() => setEditBook(null)}>取消</button>
              <button className="welcome-mode-btn active" onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
