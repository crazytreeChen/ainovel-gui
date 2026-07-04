import { useState } from 'react'
import BookCover from '@/components/BookCover'
import { getPhaseLabel } from '@/lib/utils/phaseLabel'
import type { BookItem } from '@/shared/ipc'

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
  onCoverRegenerated?: () => void
}

export default function BookEditModal({
  book, editName, setEditName, editStyle, setEditStyle,
  editPhase, setEditPhase, editTags, setEditTags,
  editPremise, setEditPremise, editSaving, onSave, onClose,
  onCoverRegenerated,
}: BookEditModalProps) {
  const [genCoverPrompt, setGenCoverPrompt] = useState('')
  const [generatingCover, setGeneratingCover] = useState(false)
  const [showGenCover, setShowGenCover] = useState(false)
  const [genError, setGenError] = useState('')

  /** 从书名和简介自动构建封面生成 prompt */
  function buildCoverPrompt(): string {
    const parts: string[] = []
    if (editName.trim()) parts.push(`书名：《${editName.trim()}》`)
    if (editPremise.trim()) parts.push(`内容简介：${editPremise.trim()}`)
    if (parts.length === 0) return ''
    parts.push('书籍封面设计，艺术风格，高质量')
    return parts.join('；')
  }

  function openGenCover() {
    setGenCoverPrompt(buildCoverPrompt())
    setGenError('')
    setShowGenCover(true)
  }

  async function handleGenerateCover() {
    if (!window.electronAPI || !genCoverPrompt.trim()) return
    setGeneratingCover(true); setGenError('')
    try {
      const result = await window.electronAPI.generateImage('', '', genCoverPrompt.trim(), { size: '1024x1024' })
      if (result.error) { setGenError('生成失败: ' + result.error) }
      else if (result.image) {
        // 保存生成的图片为封面
        await window.electronAPI.saveBookCover(book.id, result.image)
        onCoverRegenerated?.()
        setShowGenCover(false)
      }
    } catch (e: any) { setGenError(e.message || '生成失败') }
    setGeneratingCover(false)
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 700, maxWidth: 800, maxHeight: '85vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="modal-title" style={{ marginBottom: 0 }}>编辑书籍</div>
          <button className="modal-close" onClick={onClose} style={{ position: 'static' }}>✕</button>
        </div>

        <div className="flex-row" style={{ gap: 24, height: 'calc(85vh - 100px)' }}>
          {/* 左侧：基本信息 */}
          <div className="flex-col scroll-y" style={{ width: 300, minWidth: 260, flexShrink: 0 }}>
            <div className="flex-row gap-16 mb-16 items-center">
              <BookCover bookId={book.id} size="medium" editable />
              <div className="flex-col gap-6">
                <div className="text-dim text-xs">点击封面更换图片</div>
                <button className="welcome-mode-btn text-xs"
                  onClick={openGenCover}
                  style={{ color: 'var(--color-accent2)', borderColor: 'var(--color-accent2)', padding: '3px 10px' }}>
                  🤖 AI 生成封面
                </button>
              </div>
            </div>

            <div className="mb-12">
              <label className="text-muted text-sm mb-8 d-block">书名</label>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onSave()}
                className="input-field text-sm" autoFocus />
            </div>

            <div className="mb-12">
              <label className="text-muted text-sm mb-8 d-block">写作风格</label>
              <div className="flex-row flex-wrap" style={{ gap: 6 }}>
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
              <label className="text-muted text-sm mb-8 d-block">写作阶段</label>
              <div className="flex-row flex-wrap" style={{ gap: 6 }}>
                {['init', 'premise', 'outline', 'writing', 'complete'].map(k => (
                  <button key={k} className={`welcome-mode-btn text-sm ${editPhase === k ? 'active' : ''}`}
                    onClick={() => setEditPhase(k)}>{getPhaseLabel(k)}</button>
                ))}
              </div>
            </div>

            <div className="mb-12">
              <label className="text-muted text-sm mb-8 d-block">标签</label>
              <input value={editTags} onChange={e => setEditTags(e.target.value)}
                placeholder="用逗号分隔，如: 玄幻, 后宫, 末日" className="input-field" />
            </div>
          </div>

          {/* 右侧：内容简介 */}
          <div className="flex-1 flex-col">
            <label className="text-muted text-sm mb-8 d-block fw-bold">内容简介</label>
            <textarea value={editPremise} onChange={e => setEditPremise(e.target.value)}
              placeholder="输入书籍内容简介..."
              className="textarea-field mono"
              style={{ flex: 1, width: '100%', minHeight: 200, fontSize: 14, lineHeight: 1.8, padding: 12, resize: 'none' }} />
          </div>
        </div>

        <div className="flex-row gap-8 mt-12" style={{ justifyContent: 'flex-end', paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
          <button className="welcome-mode-btn" onClick={onClose}>取消</button>
          <button className="welcome-mode-btn active" onClick={onSave} disabled={editSaving}>
            {editSaving ? '保存中...' : '保存'}
          </button>
        </div>

        {/* AI 生成封面弹窗 */}
        {showGenCover && (
          <div className="modal-overlay" onClick={() => setShowGenCover(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 420, maxWidth: 500 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 'bold' }}>🤖 AI 生成封面</span>
                <button onClick={() => setShowGenCover(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-dim)' }}>✕</button>
              </div>
              <div className="text-dim text-xs mb-12">
                使用 AI 图片生成模型为书籍创建封面。
                {genCoverPrompt.trim() ? '已从书名和简介自动填充描述，可修改后生成。' : '请先保存书籍信息（书名+简介），再生成封面。'}
              </div>
              <div className="mb-12">
                <label className="text-muted text-sm mb-6 d-block">
                  图片描述（Prompt）{!genCoverPrompt.trim() && <span className="text-error text-xs"> *必填</span>}
                </label>
                <textarea value={genCoverPrompt} onChange={e => setGenCoverPrompt(e.target.value)}
                  placeholder={'描述你想要的封面画面，例如：\n"一本古老魔法书的特写，封面镶嵌金色符文，背景是星空和紫色魔法光晕，奇幻风格"'}
                  className="textarea-field text-sm" rows={4}
                  style={{ width: '100%', resize: 'vertical' }} />
              </div>
              {genError && <div className="text-error text-sm mb-8">{genError}</div>}
              <div className="flex-row gap-8" style={{ justifyContent: 'flex-end' }}>
                <button className="welcome-mode-btn" onClick={() => setShowGenCover(false)}>取消</button>
                <button className="welcome-mode-btn active" onClick={handleGenerateCover} disabled={generatingCover || !genCoverPrompt.trim()}>
                  {generatingCover ? '生成中...' : '生成封面'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
