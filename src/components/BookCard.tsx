import BookCover from '@/components/BookCover'
import { getPhaseLabel } from '@/lib/utils/phaseLabel'
import type { BookItem } from '@/shared/ipc'

interface BookCardProps {
  book: BookItem
  viewMode: 'card' | 'detail'
  onClick: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
}

export default function BookCard({ book, viewMode, onClick, onEdit, onDelete }: BookCardProps) {
  return (
    <div
      className="cursor-clickable"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: viewMode === 'card' ? 16 : '10px 14px',
        cursor: 'pointer',
        transition: 'border-color 0.2s',
        display: 'flex',
        gap: viewMode === 'card' ? 16 : 10,
        alignItems: viewMode === 'detail' ? 'center' : undefined,
      }}
      onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--color-accent)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
    >
      <BookCover bookId={book.id} size="small" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: viewMode === 'card' ? 8 : 2 }}>
          <div style={{ fontWeight: 'bold', fontSize: viewMode === 'card' ? 15 : 13, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.name}</div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={onEdit}
              style={{ background: 'none', border: 'none', color: 'var(--color-dim)', cursor: 'pointer', fontSize: viewMode === 'card' ? 12 : 10, padding: '0 4px' }} title="编辑">✎</button>
            <button onClick={onDelete}
              style={{ background: 'none', border: 'none', color: 'var(--color-dim)', cursor: 'pointer', fontSize: viewMode === 'card' ? 14 : 10, padding: '0 4px' }} title="删除">✕</button>
          </div>
        </div>
        <div className="mono text-dim" style={{ fontSize: viewMode === 'card' ? 11 : 10, lineHeight: viewMode === 'card' ? 1.7 : 1.5 }}>
          <div>状态: {getPhaseLabel(book.phase)} · {book.completedCount || 0} 章 · {(book.totalWordCount || 0).toLocaleString()} 字 · {book.style || 'default'}</div>
        </div>
        {book.premise && (
          <div className="text-dim" style={{
            fontSize: viewMode === 'card' ? 11 : 10,
            marginTop: viewMode === 'card' ? 6 : 2,
            lineHeight: 1.5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: viewMode === 'detail' ? 'nowrap' : undefined,
            display: viewMode === 'card' ? '-webkit-box' : undefined,
            WebkitLineClamp: viewMode === 'card' ? 3 : undefined,
            WebkitBoxOrient: viewMode === 'card' ? 'vertical' : undefined,
          }}>{book.premise}</div>
        )}
      </div>
    </div>
  )
}
