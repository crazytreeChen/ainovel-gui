import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useBookId } from '@/hooks/useBookId'

interface SearchResult {
  type: 'chapter' | 'character' | 'event' | 'outline'
  num?: number; name?: string; title?: string; role?: string
  event?: string; match: string; chapter?: number
}

const TYPE_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  chapter:   { label: '章节', icon: '📖', color: 'var(--color-accent2)' },
  character: { label: '角色', icon: '👤', color: 'var(--color-accent)' },
  event:     { label: '事件', icon: '⏳', color: 'var(--color-tool)' },
  outline:   { label: '大纲', icon: '📋', color: 'var(--color-context)' },
}

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const id = useBookId()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const doSearch = useCallback(async (q: string) => {
    if (!id || !window.electronAPI || q.length < 1) { setResults([]); return }
    setLoading(true)
    const res = await window.electronAPI.searchBook(id, q)
    const flat: SearchResult[] = [
      ...res.chapters.map(r => ({ ...r, chapter: r.num })),
      ...res.characters,
      ...res.events,
      ...res.outline.map(r => ({ ...r, chapter: r.chapter })),
    ]
    setResults(flat)
    setSelectedIdx(0)
    setLoading(false)
  }, [id])

  function handleInput(v: string) {
    setQuery(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(v), 200)
  }

  function handleSelect(idx: number) {
    const r = results[idx]
    if (!r || !id) return
    if (r.type === 'chapter') navigate(`/books/${id}/chapters/${r.num}`)
    else if (r.type === 'character') navigate(`/books/${id}/characters`)
    else if (r.type === 'outline') navigate(`/books/${id}/outline`)
    else if (r.type === 'event') navigate(`/books/${id}/timeline`)
    onClose()
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' && results.length > 0) handleSelect(selectedIdx)
  }

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}
        style={{ minWidth: 480, maxWidth: 560, padding: 0, overflow: 'visible' }}>
        {/* 搜索输入 */}
        <div style={{ padding: 16, borderBottom: '1px solid var(--color-border)' }}>
          <input ref={inputRef}
            value={query}
            onChange={e => handleInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="搜索章节标题、角色名、事件、大纲..."
            className="input-field"
            style={{ fontSize: 14, padding: '10px 14px' }}
          />
          <div className="text-dim text-xs mt-4" style={{ paddingLeft: 2 }}>
            ↑↓ 选择 · Enter 跳转 · Esc 关闭
          </div>
        </div>

        {/* 搜索结果 */}
        <div style={{ maxHeight: 400, overflow: 'auto', padding: 8 }}>
          {loading && <div className="text-dim text-center p-16">搜索中...</div>}

          {!loading && query.length > 0 && Object.keys(grouped).length === 0 && (
            <div className="text-dim text-center p-16">无匹配结果</div>
          )}

          {!loading && Object.entries(grouped).map(([type, items], gi) => {
            const cfg = TYPE_CONFIG[type] || { label: type, icon: '📄', color: 'var(--color-dim)' }
            let offset = 0
            for (let i = 0; i < gi; i++) offset += Object.values(grouped)[i].length
            return (
              <div key={type} className="mb-8">
                <div className="text-xs fw-bold mb-4" style={{ color: cfg.color, paddingLeft: 4 }}>
                  {cfg.icon} {cfg.label} ({items.length})
                </div>
                {items.map((item, ii) => {
                  const idx = offset + ii
                  return (
                    <div key={`${type}-${ii}`}
                      className="cursor-clickable flex-row items-center gap-8"
                      onClick={() => handleSelect(idx)}
                      style={{
                        padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                        background: idx === selectedIdx ? 'var(--color-surface-2)' : 'transparent',
                        fontSize: 13,
                      }}>
                      {item.type === 'chapter' && <span className="text-dim mono text-xs flex-shrink-0">#{item.num}</span>}
                      {item.type === 'character' && <span className="text-dim text-xs flex-shrink-0">👤</span>}
                      {item.type === 'event' && <span className="text-dim text-xs flex-shrink-0">#{item.chapter}</span>}
                      {item.type === 'outline' && <span className="text-dim mono text-xs flex-shrink-0">#{item.chapter}</span>}
                      <span className="flex-1 truncate">{item.match}</span>
                      <span className="text-dim text-xs flex-shrink-0" style={{ color: cfg.color }}>{cfg.label}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {query.length === 0 && (
            <div className="text-dim text-xs text-center p-16">
              输入关键词搜索章节、角色、事件和大纲
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
