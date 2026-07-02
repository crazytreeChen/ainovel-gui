import { useState } from 'react'

interface SourcesListProps {
  sources: string[]
  onAdd: (value: string) => void
  onRemove: (index: number) => void
}

export default function SourcesList({ sources, onAdd, onRemove }: SourcesListProps) {
  const [input, setInput] = useState('')

  function handleAdd() {
    if (!input.trim()) return
    onAdd(input.trim())
    setInput('')
  }

  return (
    <div>
      <div className="sidebar-section-header" style={{ marginBottom: 8 }}>来源列表</div>
      <div className="text-dim" style={{ fontSize: 12, marginBottom: 8 }}>
        添加你认为与该小说风格/设定相似的参考来源（书籍、作品、风格等）
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="输入来源名称..." style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 12, outline: 'none' }} />
        <button className="welcome-mode-btn active" onClick={handleAdd} style={{ fontSize: 11 }}>添加</button>
      </div>

      {sources.length === 0 ? (
        <div className="text-dim" style={{ textAlign: 'center', marginTop: 40, fontSize: 13 }}>暂无来源</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sources.map((s, i) => (
            <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
              <span>{s}</span>
              <button onClick={() => onRemove(i)} className="text-dim" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>删除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
