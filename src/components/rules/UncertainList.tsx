import { useState } from 'react'

interface UncertainListProps {
  items: string[]
  onAdd: (value: string) => void
  onRemove: (index: number) => void
}

export default function UncertainList({ items, onAdd, onRemove }: UncertainListProps) {
  const [input, setInput] = useState('')

  function handleAdd() {
    if (!input.trim()) return
    onAdd(input.trim())
    setInput('')
  }

  return (
    <div>
      <div className="sidebar-section-header" style={{ marginBottom: 8 }}>不确定性列表</div>
      <div className="text-dim" style={{ fontSize: 12, marginBottom: 8 }}>
        列出你不确定如何处理的情节、设定或元素，让 AI 在写作时特别注意
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
          placeholder="输入不确定的元素..." style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 12, outline: 'none' }} />
        <button className="welcome-mode-btn active" onClick={handleAdd} style={{ fontSize: 11 }}>添加</button>
      </div>

      {items.length === 0 ? (
        <div className="text-dim" style={{ textAlign: 'center', marginTop: 40, fontSize: 13 }}>暂无不确定性记录</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items.map((item, i) => (
            <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
              <span>{item}</span>
              <button onClick={() => onRemove(i)} className="text-dim" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>删除</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
