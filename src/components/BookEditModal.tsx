import BookCover from '@/components/BookCover'
import { getPhaseLabel } from '@/lib/utils/phaseLabel'
import type { BookItem } from './BookCard'

interface BookEditModalProps {
  book: BookItem
  editName: string
  setEditName: (v: string) => void
  editStyle: string
  setEditStyle: (v: string) => void
  editPhase: string
  setEditPhase: (v: string) => void
  editTags: string
  setEditTags: (v: string) => void
  editPremise: string
  setEditPremise: (v: string) => void
  editSaving: boolean
  onSave: () => void
  onClose: () => void
}

export default function BookEditModal({
  book,
  editName,
  setEditName,
  editStyle,
  setEditStyle,
  editPhase,
  setEditPhase,
  editTags,
  setEditTags,
  editPremise,
  setEditPremise,
  editSaving,
  onSave,
  onClose,
}: BookEditModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 400, maxWidth: 450 }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-title">编辑书籍</div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 14, alignItems: 'center' }}>
          <BookCover bookId={book.id} size="medium" editable />
          <div className="text-dim" style={{ fontSize: 11 }}>点击封面更换图片</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="text-muted" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>书名</label>
          <input value={editName} onChange={e => setEditName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSave()}
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

        <div style={{ marginBottom: 14 }}>
          <label className="text-muted" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>写作阶段</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { key: 'init', label: getPhaseLabel('init') },
              { key: 'premise', label: getPhaseLabel('premise') },
              { key: 'outline', label: getPhaseLabel('outline') },
              { key: 'writing', label: getPhaseLabel('writing') },
              { key: 'complete', label: getPhaseLabel('complete') },
            ].map(s => (
              <button key={s.key}
                className={`welcome-mode-btn ${editPhase === s.key ? 'active' : ''}`}
                onClick={() => setEditPhase(s.key)}
                style={{ fontSize: 12 }}
              >{s.label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="text-muted" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>标签</label>
          <input value={editTags} onChange={e => setEditTags(e.target.value)}
            placeholder="用逗号分隔，如: 玄幻, 后宫, 末日"
            style={{ width: '100%', padding: '8px 12px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 13 }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="text-muted" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>内容简介</label>
          <textarea value={editPremise} onChange={e => setEditPremise(e.target.value)}
            placeholder="输入书籍内容简介..."
            rows={3}
            style={{ width: '100%', padding: '8px 12px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 13, resize: 'vertical', fontFamily: 'var(--font-mono)' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="welcome-mode-btn" onClick={onClose}>取消</button>
          <button className="welcome-mode-btn active" onClick={onSave} disabled={editSaving}>
            {editSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
