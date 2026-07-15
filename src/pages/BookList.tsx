import { useNavigate, Link } from 'react-router-dom'
import BookCard from '@/components/BookCard'
import BookEditModal from '@/components/BookEditModal'
import BookFilters from '@/components/BookFilters'
import { useBookCRUD } from '@/hooks/useBookCRUD'

export default function BookList() {
  const navigate = useNavigate()
  const crud = useBookCRUD()

  return (
    <div className="p-32 flex-col" style={{ height: '100vh' }}>
      <div className="flex-row items-center justify-between mb-24 flex-shrink-0">
        <div>
          <h1 className="mono text-accent m-0" style={{ fontSize: 28, letterSpacing: 6 }}>
            <span style={{ letterSpacing: 4 }}>AI小说管理</span>
          </h1>
          <div className="text-dim text-xs mono">AI小说创作管理平台</div>
        </div>
        <BookFilters viewMode={crud.viewMode} setViewMode={crud.setViewMode}
          onNewBook={() => navigate('/books/new')} onImport={crud.handleImport} />
      </div>

      <div className="flex-1 scroll-y">
        {crud.loading && <div className="text-dim text-center mt-60 text-sm">加载中...</div>}

        {!crud.loading && crud.books.length === 0 && (
          <div className="text-dim text-center mt-60">
            <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>📖</div>
            <p style={{ fontSize: 16, marginBottom: 8 }}>还没有书籍</p>
            <p className="text-sm">点击"新建书籍"开始创作，或"导入目录"导入已有作品</p>
          </div>
        )}

        {!crud.loading && crud.books.length > 0 && (
          <div style={{
            display: crud.viewMode === 'card' ? 'grid' : 'flex',
            flexDirection: crud.viewMode === 'detail' ? 'column' : undefined,
            gridTemplateColumns: crud.viewMode === 'card' ? 'repeat(auto-fill, minmax(320px, 1fr))' : undefined,
            gap: crud.viewMode === 'card' ? 16 : 6,
          }}>
            {crud.books.map(book => (
              <BookCard key={book.id} book={book} viewMode={crud.viewMode}
                onClick={() => navigate(`/books/${book.id}/workspace?mode=writing`)}
                onEdit={(e) => crud.handleEditClick(book, e)}
                onDelete={(e) => crud.handleDelete(book.id, e)}
                onOpenFolder={(e) => { void crud.handleOpenFolder(book, e) }} />
            ))}
          </div>
        )}
      </div>

      <div className="text-dim text-xs mono border-bottom" style={{ paddingTop: 12, flexShrink: 0 }}>
        <Link to="/settings" style={{ color: 'var(--color-dim)', textDecoration: 'none' }}>系统设置</Link>
        {' · '}
        <Link to="/settings/models" style={{ color: 'var(--color-dim)', textDecoration: 'none' }}>模型管理</Link>
      </div>

      {crud.editBook && (
        <BookEditModal book={crud.editBook} editName={crud.editName} setEditName={crud.setEditName}
          editStyle={crud.editStyle} setEditStyle={crud.setEditStyle}
          editPhase={crud.editPhase} setEditPhase={crud.setEditPhase}
          editTags={crud.editTags} setEditTags={crud.setEditTags}
          editPremise={crud.editPremise} setEditPremise={crud.setEditPremise}
          editSaving={crud.editSaving} onSave={crud.handleEditSave} onClose={crud.closeEdit} />
      )}

      {crud.deleteTarget && (
        <div className="modal-overlay" onClick={crud.closeDelete}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 380, maxWidth: 420 }}>
            <button className="modal-close" onClick={crud.closeDelete}>✕</button>
            <div className="modal-title text-error">⚠️ 删除书籍</div>

            <div className="mb-12 text-sm" style={{ lineHeight: 1.6 }}>
              <p>确认要删除 <strong style={{ color: 'var(--color-text)' }}>《{crud.deleteTarget.name}》</strong> 吗？</p>
              <p className="text-dim text-xs mt-8">此操作不可恢复，数据库记录与书籍文件夹（章节、大纲、角色等）都将被永久删除。</p>
            </div>

            <div className="mb-12">
              <label className="text-muted text-sm mb-8 d-block">
                请输入 <strong className="mono text-error">确认删除</strong> 后点击确认
              </label>
              <input value={crud.deleteConfirm} onChange={e => crud.setDeleteConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && crud.handleDeleteConfirm()}
                placeholder="输入「确认删除」" autoFocus className="input-field text-sm mono" />
            </div>

            <div className="flex-row gap-8" style={{ justifyContent: 'flex-end' }}>
              <button className="welcome-mode-btn" onClick={crud.closeDelete}>取消</button>
              <button onClick={crud.handleDeleteConfirm} disabled={crud.deleteConfirm !== '确认删除'}
                style={{ padding: '6px 16px', borderRadius: 'var(--radius)',
                  background: crud.deleteConfirm === '确认删除' ? '#e07060' : 'var(--color-surface)',
                  color: crud.deleteConfirm === '确认删除' ? '#fff' : 'var(--color-dim)',
                  border: `1px solid ${crud.deleteConfirm === '确认删除' ? '#e07060' : 'var(--color-border)'}`,
                  cursor: crud.deleteConfirm === '确认删除' ? 'pointer' : 'not-allowed',
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
