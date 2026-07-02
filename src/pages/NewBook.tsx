import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookCover from '@/components/BookCover'
import { getPhaseLabel } from '@/lib/utils/phaseLabel'

export default function NewBook() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [style, setStyle] = useState('default')
  const [phase, setPhase] = useState('init')
  const [tags, setTags] = useState('')
  const [premise, setPremise] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!name.trim()) { setError('请输入书名'); return }
    setCreating(true)
    setError('')
    try {
      if (window.electronAPI) {
        const book = await window.electronAPI.createBook(name.trim(), style, phase, premise, tags)
        if (book?.id) {
          setCreatedId(book.id)
          if (selectedImage) {
            await window.electronAPI.saveBookCover(book.id, selectedImage)
          }
          navigate('/')
        }
      }
    } catch (e: any) {
      setError(e.message || '创建失败')
    }
    setCreating(false)
  }

  const handleSelectCover = async () => {
    if (!window.electronAPI) return
    const path = await window.electronAPI.selectCoverImage()
    if (path) setSelectedImage(path)
  }

  return (
    <div className="flex-row" style={{ height: '100vh' }}>
      {/* 左侧：基本信息 */}
      <div className="flex-col p-32 scroll-y" style={{ width: 420, minWidth: 380, borderRight: '1px solid var(--color-border)' }}>
        <h2 className="mono text-accent mb-24 text-lg" style={{ fontSize: 20 }}>+ 新建书籍</h2>

        <div className="flex-row gap-24 mb-24">
          <div className="flex-shrink-0">
            {createdId ? (
              <BookCover bookId={createdId} size="medium" editable />
            ) : (
              <div onClick={handleSelectCover} className="cursor-clickable flex-col items-center justify-center"
                style={{ width: 100, height: 140, borderRadius: 4,
                  border: selectedImage ? '1px solid var(--color-border)' : '2px dashed var(--color-dim)',
                  background: 'var(--color-surface-2)', cursor: 'pointer', gap: 6 }}>
                {selectedImage ? (
                  <img src={selectedImage} alt="封面预览" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 3 }} />
                ) : (
                  <>
                    <span style={{ fontSize: 28, opacity: 0.4 }}>📖</span>
                    <span className="text-dim text-xs">添加封面</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="mb-16">
              <label className="text-muted text-sm mb-8" style={{ display: 'block' }}>书名</label>
              <input value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                className="input-field text-sm" style={{ padding: '10px 14px', fontSize: 14 }}
                placeholder="输入书名，如「光斑」「星穹之旅」" autoFocus />
            </div>

            <button className="welcome-mode-btn text-sm mb-12" onClick={handleSelectCover}>
              {selectedImage ? '更换封面图片' : '选择封面图片'}
            </button>
          </div>
        </div>

        <div className="mb-16">
          <label className="text-muted text-sm mb-8" style={{ display: 'block' }}>写作风格</label>
          <div className="flex-row flex-wrap" style={{ gap: 6 }}>
            {[
              { key: 'default', label: '通用' },
              { key: 'fantasy', label: '仙侠/玄幻' },
              { key: 'suspense', label: '悬疑推理' },
              { key: 'romance', label: '言情' },
            ].map(s => (
              <button key={s.key}
                className={`welcome-mode-btn ${style === s.key ? 'active' : ''}`}
                onClick={() => setStyle(s.key)}>{s.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <label className="text-muted text-sm mb-8" style={{ display: 'block' }}>写作阶段</label>
          <div className="flex-row flex-wrap" style={{ gap: 6 }}>
            {[
              { key: 'init', label: getPhaseLabel('init') },
              { key: 'premise', label: getPhaseLabel('premise') },
              { key: 'outline', label: getPhaseLabel('outline') },
              { key: 'writing', label: getPhaseLabel('writing') },
              { key: 'complete', label: getPhaseLabel('complete') },
            ].map(s => (
              <button key={s.key}
                className={`welcome-mode-btn ${phase === s.key ? 'active' : ''}`}
                onClick={() => setPhase(s.key)}>{s.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <label className="text-muted text-sm mb-8" style={{ display: 'block' }}>标签</label>
          <input value={tags} onChange={e => setTags(e.target.value)}
            placeholder="用逗号分隔，如: 玄幻, 后宫, 末日"
            className="input-field" />
        </div>

        {error && (
          <div className="text-error text-sm mono mb-12">{error}</div>
        )}

        <div className="flex-row gap-10 mt-auto" style={{ paddingTop: 16 }}>
          <button className="welcome-mode-btn active" onClick={handleCreate} disabled={creating}
            style={{ fontSize: 13, padding: '8px 24px', opacity: creating ? 0.6 : 1 }}>
            {creating ? '创建中...' : '创建书籍'}
          </button>
          <button className="welcome-mode-btn" onClick={() => navigate('/')}
            style={{ fontSize: 13, padding: '8px 24px' }}>
            取消
          </button>
        </div>
      </div>

      {/* 右侧：内容简介 — 大编辑区 */}
      <div className="flex-1 flex-col p-32">
        <label className="text-muted text-sm mb-8" style={{ display: 'block', fontWeight: 'bold' }}>内容简介</label>
        <textarea value={premise} onChange={e => setPremise(e.target.value)}
          placeholder="输入书籍内容简介，描述故事核心设定、世界观、主线脉络等...
          
可以在这里详细写下你的创作构想，AI 会基于此进行创作。"
          className="textarea-field mono"
          style={{ flex: 1, width: '100%', minHeight: 300, fontSize: 14, lineHeight: 1.8, padding: 16, resize: 'none' }} />
      </div>
    </div>
  )
}
