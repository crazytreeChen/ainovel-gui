import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import BookCard from '@/components/BookCard'
import BookEditModal from '@/components/BookEditModal'
import BookFilters from '@/components/BookFilters'

interface BookItem {
  id: string; name: string; style: string; phase: string; flow: string
  completedCount: number; totalWordCount: number
  premise?: string; tags?: string; createdAt: string; lastOpenedAt: string; workspaceDir?: string
}

export default function BookList() {
  const navigate = useNavigate()
  const [books, setBooks] = useState<BookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editBook, setEditBook] = useState<BookItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editStyle, setEditStyle] = useState('default')
  const [editPhase, setEditPhase] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editPremise, setEditPremise] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BookItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [viewMode, setViewMode] = useState<'card' | 'detail'>('card')

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
    const book = books.find(b => b.id === id)
    if (!book) return
    setDeleteTarget(book)
    setDeleteConfirm('')
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget || deleteConfirm !== '确认删除') return
    if (window.electronAPI) {
      await window.electronAPI.deleteBook(deleteTarget.id)
      setDeleteTarget(null)
      setDeleteConfirm('')
      await loadBooks()
    }
  }

  function handleEditClick(book: BookItem, e: React.MouseEvent) {
    e.stopPropagation()
    setEditBook(book)
    setEditName(book.name)
    setEditStyle(book.style || 'default')
    setEditPhase(book.phase || 'writing')
    setEditTags(book.tags || '')
    setEditPremise(book.premise || '')
  }

  async function handleEditSave() {
    if (!editBook || !editName.trim() || !window.electronAPI) return
    setEditSaving(true)
    const fields: any = { name: editName.trim(), style: editStyle }
    if (editPhase) fields.phase = editPhase
    if (editTags) fields.tags = editTags
    if (editPremise) fields.premise = editPremise
    await window.electronAPI.updateBook(editBook.id, fields)
    setEditSaving(false)
    setEditBook(null)
    await loadBooks()
  }

  async function handleImport() {
    if (!window.electronAPI) return
    const dir = await window.electronAPI.selectDirectory()
    if (!dir) return

    const info = await window.electronAPI.scanWorkspace(dir)
    if (!info) {
      alert('所选目录不是有效的 ainovel-cli 工作目录（缺少 output/ 子目录）')
      return
    }

    const msg = `检测到作品：${info.name || '未命名'}\n阶段: ${info.phase || 'init'}\n章节: ${info.chapterCount || 0}\n字数: ${(info.totalWordCount || 0).toLocaleString()}\n\n确认导入此作品？`
    if (!confirm(msg)) return

    const book = await window.electronAPI.importWorkspace(dir)
    if (book) { await loadBooks() } else { alert('导入失败') }
  }

  return (
    <div className="p-32 flex-col" style={{ height: '100vh' }}>
      <div className="flex-row items-center justify-between mb-24 flex-shrink-0">
        <div>
          <h1 className="mono text-accent m-0" style={{ fontSize: 28, letterSpacing: 6 }}>
            <span style={{ letterSpacing: 4 }}>AI小说管理</span>
          </h1>
          <div className="text-dim text-xs mono">AI小说创作管理平台</div>
        </div>
        <BookFilters viewMode={viewMode} setViewMode={setViewMode}
          onNewBook={() => navigate('/books/new')} onImport={handleImport} />
      </div>

      <div className="flex-1 scroll-y">
        {loading && <div className="text-dim text-center mt-60 text-sm">加载中...</div>}

        {!loading && books.length === 0 && (
          <div className="text-dim text-center mt-60">
            <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>📖</div>
            <p style={{ fontSize: 16, marginBottom: 8 }}>还没有书籍</p>
            <p className="text-sm">点击"新建书籍"开始创作，或"打开目录"导入已有作品</p>
          </div>
        )}

        {!loading && books.length > 0 && (
          <div style={{
            display: viewMode === 'card' ? 'grid' : 'flex',
            flexDirection: viewMode === 'detail' ? 'column' : undefined,
            gridTemplateColumns: viewMode === 'card' ? 'repeat(auto-fill, minmax(320px, 1fr))' : undefined,
            gap: viewMode === 'card' ? 16 : 6,
          }}>
            {books.map(book => (
              <BookCard key={book.id} book={book} viewMode={viewMode}
                onClick={() => navigate(`/books/${book.id}/workspace?mode=writing`)}
                onEdit={(e) => handleEditClick(book, e)}
                onDelete={(e) => handleDelete(book.id, e)} />
            ))}
          </div>
        )}
      </div>

      <div className="text-dim text-xs mono border-bottom" style={{ paddingTop: 12, flexShrink: 0 }}>
        <Link to="/settings" style={{ color: 'var(--color-dim)', textDecoration: 'none' }}>系统设置</Link>
        {' · '}
        <Link to="/settings/models" style={{ color: 'var(--color-dim)', textDecoration: 'none' }}>模型管理</Link>
      </div>

      {editBook && (
        <BookEditModal book={editBook} editName={editName} setEditName={setEditName}
          editStyle={editStyle} setEditStyle={setEditStyle}
          editPhase={editPhase} setEditPhase={setEditPhase}
          editTags={editTags} setEditTags={setEditTags}
          editPremise={editPremise} setEditPremise={setEditPremise}
          editSaving={editSaving} onSave={handleEditSave} onClose={() => setEditBook(null)} />
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => { setDeleteTarget(null); setDeleteConfirm('') }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 380, maxWidth: 420 }}>
            <button className="modal-close" onClick={() => { setDeleteTarget(null); setDeleteConfirm('') }}>✕</button>
            <div className="modal-title text-error">⚠️ 删除书籍</div>

            <div className="mb-12 text-sm" style={{ lineHeight: 1.6 }}>
              <p>确认要删除 <strong style={{ color: 'var(--color-text)' }}>《{deleteTarget.name}》</strong> 吗？</p>
              <p className="text-dim text-xs mt-8">此操作不可恢复，所有章节、大纲、角色数据将被永久删除。</p>
            </div>

            <div className="mb-12">
              <label className="text-muted text-sm mb-8" style={{ display: 'block' }}>
                请输入 <strong className="mono text-error">确认删除</strong> 后点击确认
              </label>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDeleteConfirm()}
                placeholder="输入「确认删除」" autoFocus className="input-field text-sm mono" />
            </div>

            <div className="flex-row gap-8" style={{ justifyContent: 'flex-end' }}>
              <button className="welcome-mode-btn" onClick={() => { setDeleteTarget(null); setDeleteConfirm('') }}>取消</button>
              <button onClick={handleDeleteConfirm} disabled={deleteConfirm !== '确认删除'}
                style={{ padding: '6px 16px', borderRadius: 'var(--radius)',
                  background: deleteConfirm === '确认删除' ? '#e07060' : 'var(--color-surface)',
                  color: deleteConfirm === '确认删除' ? '#fff' : 'var(--color-dim)',
                  border: `1px solid ${deleteConfirm === '确认删除' ? '#e07060' : 'var(--color-border)'}`,
                  cursor: deleteConfirm === '确认删除' ? 'pointer' : 'not-allowed',
                  fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 'bold', transition: 'all 0.15s' }}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
