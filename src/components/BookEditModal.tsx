import BookCover from '@/components/BookCover'
import { getPhaseLabel } from '@/lib/utils/phaseLabel'
import type { BookItem } from './BookCard'

interface BookEditModalProps {
  book: BookItem
  editName: string; setEditName: (v: string) => void
  editStyle: string; setEditStyle: (v: string) => void
  editPhase: string; setEditPhase: (v: string) => void
  editTags: string; setEditTags: (v: string) => void
  editPremise: string; setEditPremise: (v: string) => void
  editSaving: boolean
  onSave: () => void
  onClose: () => void
}

export default function BookEditModal({
  book, editName, setEditName, editStyle, setEditStyle,
  editPhase, setEditPhase, editTags, setEditTags,
  editPremise, setEditPremise, editSaving, onSave, onClose,
}: BookEditModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 400, maxWidth: 450 }}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-title">编辑书籍</div>

        <div className="flex-row gap-16 mb-12 items-center">
          <BookCover bookId={book.id} size="medium" editable />
          <div className="text-dim text-xs">点击封面更换图片</div>
        </div>

        <div className="mb-12">
          <label className="text-muted text-sm mb-8" style={{ display: 'block' }}>书名</label>
          <input value={editName} onChange={e => setEditName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSave()}
            className="input-field text-sm" autoFocus />
        </div>

        <div className="mb-12">
          <label className="text-muted text-sm mb-8" style={{ display: 'block' }}>写作风格</label>
          <div className="flex-row gap-6">
            {[
              { key: 'default', label: '通用' }, { key: 'fantasy', label: '仙侠/玄幻' },
              { key: 'suspense', label: '悬疑推理' }, { key: 'romance', label: '言情' },
            ].map(s => (
              <button key={s.key} className={`welcome-mode-btn text-sm ${editStyle === s.key ? 'active' : ''}`}
                onClick={() => setEditStyle(s.key)}>{s.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <label className="text-muted text-sm mb-8" style={{ display: 'block' }}>写作阶段</label>
          <div className="flex-row gap-6">
            {['init', 'premise', 'outline', 'writing', 'complete'].map(k => (
              <button key={k} className={`welcome-mode-btn text-sm ${editPhase === k ? 'active' : ''}`}
                onClick={() => setEditPhase(k)}>{getPhaseLabel(k)}</button>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <label className="text-muted text-sm mb-8" style={{ display: 'block' }}>标签</label>
          <input value={editTags} onChange={e => setEditTags(e.target.value)}
            placeholder="用逗号分隔，如: 玄幻, 后宫, 末日" className="input-field" />
        </div>

        <div className="mb-12">
          <label className="text-muted text-sm mb-8" style={{ display: 'block' }}>内容简介</label>
          <textarea value={editPremise} onChange={e => setEditPremise(e.target.value)}
            placeholder="输入书籍内容简介..." rows={3} className="textarea-field" />
        </div>

        <div className="flex-row gap-8" style={{ justifyContent: 'flex-end' }}>
          <button className="welcome-mode-btn" onClick={onClose}>取消</button>
          <button className="welcome-mode-btn active" onClick={onSave} disabled={editSaving}>
            {editSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
