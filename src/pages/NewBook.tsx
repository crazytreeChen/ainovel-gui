import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookCover from '@/components/BookCover'

export default function NewBook() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [style, setStyle] = useState('default')
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
        const book = await window.electronAPI.createBook(name.trim(), style)
        if (book?.id) {
          setCreatedId(book.id)
          // 如果有选择的图片，保存为封面
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
    <div style={{ padding: 32, maxWidth: 560, margin: '0 auto', marginTop: 60 }}>
      <h2 style={{ color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', marginBottom: 24, fontSize: 20 }}>
        + 新建书籍
      </h2>

      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        {/* 封面区域 */}
        <div style={{ flexShrink: 0 }}>
          {createdId ? (
            <BookCover bookId={createdId} size="medium" editable />
          ) : (
            <div
              onClick={handleSelectCover}
              className="cursor-clickable"
              style={{
                width: 100, height: 140, borderRadius: 4,
                border: selectedImage ? '1px solid var(--color-border)' : '2px dashed var(--color-dim)',
                background: 'var(--color-surface-2)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', gap: 6,
              }}
            >
              {selectedImage ? (
                <img src={selectedImage} alt="封面预览" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 3 }} />
              ) : (
                <>
                  <span style={{ fontSize: 28, opacity: 0.4 }}>📖</span>
                  <span className="text-dim" style={{ fontSize: 11 }}>添加封面</span>
                </>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: 16 }}>
            <label className="text-muted" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>书名</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              style={{
                width: '100%', padding: '10px 14px',
                background: 'var(--color-surface-2)', color: 'var(--color-text)',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                fontFamily: 'var(--font-mono)', fontSize: 14, outline: 'none',
              }}
              placeholder="输入书名，如「光斑」「星穹之旅」"
              autoFocus
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="text-muted" style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>写作风格</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { key: 'default', label: '通用' },
                { key: 'fantasy', label: '仙侠/玄幻' },
                { key: 'suspense', label: '悬疑推理' },
                { key: 'romance', label: '言情' },
              ].map(s => (
                <button
                  key={s.key}
                  className={`welcome-mode-btn ${style === s.key ? 'active' : ''}`}
                  onClick={() => setStyle(s.key)}
                  style={{ fontSize: 12, padding: '6px 14px' }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <button
            className="welcome-mode-btn"
            onClick={handleSelectCover}
            style={{ fontSize: 12, padding: '6px 14px', marginBottom: 12 }}
          >
            {selectedImage ? '更换封面图片' : '选择封面图片'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-error" style={{ fontSize: 13, marginBottom: 12, fontFamily: 'var(--font-mono)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button
          className="welcome-mode-btn active"
          onClick={handleCreate}
          disabled={creating}
          style={{ fontSize: 13, padding: '8px 24px', opacity: creating ? 0.6 : 1 }}
        >
          {creating ? '创建中...' : '创建书籍'}
        </button>
        <button className="welcome-mode-btn" onClick={() => navigate('/')} style={{ fontSize: 13, padding: '8px 24px' }}>
          取消
        </button>
      </div>
    </div>
  )
}
