import { useState, useEffect } from 'react'

interface BookCoverProps {
  bookId: string
  size?: 'small' | 'medium' | 'large'
  editable?: boolean
  onCoverChange?: () => void
}

const SIZE_MAP = {
  small: { width: 60, height: 80 },
  medium: { width: 100, height: 140 },
  large: { width: 160, height: 220 },
}

export default function BookCover({ bookId, size = 'medium', editable, onCoverChange }: BookCoverProps) {
  const [coverData, setCoverData] = useState<string | null>(null)
  const [hover, setHover] = useState(false)
  const dims = SIZE_MAP[size]

  useEffect(() => { loadCover() }, [bookId])

  async function loadCover() {
    if (!window.electronAPI) return
    const data = await window.electronAPI.getBookCover(bookId)
    setCoverData(data)
  }

  async function handleSelect() {
    if (!window.electronAPI || !editable) return
    const path = await window.electronAPI.selectCoverImage()
    if (!path) return
    const ok = await window.electronAPI.saveBookCover(bookId, path)
    if (ok) {
      await loadCover()
      onCoverChange?.()
    }
  }

  return (
    <div
      onClick={handleSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: dims.width,
        height: dims.height,
        borderRadius: 4,
        overflow: 'hidden',
        background: coverData ? 'transparent' : 'var(--color-surface-2)',
        border: coverData ? '1px solid var(--color-border)' : '2px dashed var(--color-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        cursor: editable ? 'pointer' : 'default',
        flexShrink: 0,
        transition: 'border-color 0.2s',
      }}
    >
      {coverData ? (
        <img src={coverData} alt="封面" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span className="text-dim" style={{ fontSize: size === 'small' ? 18 : 28, opacity: 0.4 }}>📖</span>
      )}
      {editable && hover && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.6)', color: '#fff',
          fontSize: 11, textAlign: 'center', padding: '2px 0',
        }}>
          {coverData ? '更换封面' : '添加封面'}
        </div>
      )}
    </div>
  )
}
