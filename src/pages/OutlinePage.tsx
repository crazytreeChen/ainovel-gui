import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import { useBookId } from '@/hooks/useBookId'

interface OutlineEntry { chapter: number; title: string; coreEvent: string; hook: string; scenes: string[] }
interface ArcOutline { index: number; title: string; goal: string; estimatedChapters?: number; chapters: OutlineEntry[] }
interface VolumeOutline { index: number; title: string; theme: string; arcs: ArcOutline[] }
interface StoryCompass { endingDirection: string; openThreads: string[]; estimatedScale: string; lastUpdated: number }

export default function OutlinePage() {
  const id = useBookId()
  const navigate = useNavigate()
  const [outline, setOutline] = useState<OutlineEntry[]>([])
  const [layered, setLayered] = useState<VolumeOutline[]>([])
  const [compass, setCompass] = useState<StoryCompass | null>(null)
  const [premise, setPremise] = useState('')
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'flat' | 'layered'>('flat')
  const [expandedVols, setExpandedVols] = useState<Set<number>>(new Set([0]))
  const [editing, setEditing] = useState<{ path: string; value: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    if (!id || !window.electronAPI) return
    setLoading(true)
    const data = await window.electronAPI.getBookOutline(id)
    if (data) {
      setOutline(data.outline || [])
      setLayered(data.layeredOutline || [])
      setCompass(data.compass)
      setPremise(data.premise || '')
      if (data.layeredOutline?.length > 0) setMode('layered')
    }
    setLoading(false)
  }

  function toggleVolume(idx: number) {
    const next = new Set(expandedVols)
    if (next.has(idx)) next.delete(idx); else next.add(idx)
    setExpandedVols(next)
  }

  async function handleSave() {
    if (!id || !window.electronAPI) return
    setSaving(true)
    await window.electronAPI.saveBookOutline(id, {
      outline, layeredOutline: layered, compass, premise,
    })
    setSaving(false)
  }

  function startEdit(path: string, currentValue: string) {
    setEditing({ path, value: currentValue })
  }

  function commitEdit(path: string, newValue: string) {
    setEditing(null)
    if (!newValue.trim()) return
    setLayered(prev => {
      const copy = JSON.parse(JSON.stringify(prev))
      setValueAtPath(copy, path, newValue.trim())
      return copy
    })
  }

  function getValueAtPath(obj: any, path: string): string {
    return path.split('.').reduce((o, k) => o?.[k], obj) ?? ''
  }

  function setValueAtPath(obj: any, path: string, val: string) {
    const keys = path.split('.')
    const last = keys.pop()!
    const target = keys.reduce((o, k) => o[k], obj)
    target[last] = val
  }

  if (loading) return <div className="text-dim p-32">加载中...</div>

  return (
    <div className="p-24 flex-col" style={{ height: '100vh' }}>
      <div className="flex-row gap-24 flex-1 overflow-hidden">
        <BookNavSidebar bookId={id || ''} />
        <div className="flex-1 flex-col overflow-hidden">

          <div className="flex-row items-center gap-12 mb-16 flex-shrink-0">
            <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回工作台</button>
            <h2 className="mono text-accent m-0 text-lg">大纲管理</h2>
            <div className="ml-auto flex-row gap-8">
              <button className={`welcome-mode-btn ${mode === 'flat' ? 'active' : ''}`} onClick={() => setMode('flat')}>扁平</button>
              <button className={`welcome-mode-btn ${mode === 'layered' ? 'active' : ''}`} onClick={() => setMode('layered')}>分层</button>
              <button className="welcome-mode-btn active text-xs" onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存大纲'}
              </button>
            </div>
          </div>

          {premise && (
            <div className="card mb-16 flex-shrink-0">
              <div className="sidebar-section-header">前提</div>
              <div className="text-dim text-sm" style={{ lineHeight: 1.6, maxHeight: 60, overflow: 'hidden' }}>{premise}</div>
            </div>
          )}

          <div className="flex-1 scroll-y">
            {mode === 'flat' && (
              <div className="mono text-sm">
                {outline.map((entry) => (
                  <div key={entry.chapter} className="flex-row items-center gap-8 border-bottom" style={{ padding: '4px 0' }}>
                    <span className="text-dim" style={{ minWidth: 24 }}>{entry.chapter}</span>
                    <span className="flex-1">{entry.title}</span>
                    {entry.coreEvent && <span className="text-dim text-xs flex-1 truncate">{entry.coreEvent}</span>}
                  </div>
                ))}
                {outline.length === 0 && <div className="text-dim text-center mt-40">暂未规划大纲</div>}
              </div>
            )}

            {mode === 'layered' && (
              <div>
                {layered.map((vol, vi) => (
                  <div key={vol.index} className="mb-8">
                    <div className="cursor-clickable flex-row items-center gap-8 card"
                      onClick={() => toggleVolume(vi)}>
                      <span className="text-dim">{expandedVols.has(vi) ? '▼' : '▶'}</span>
                      {editing?.path === `layered.${vi}.title` ? (
                        <input className="input-field text-sm" style={{ width: 200, padding: '2px 6px' }}
                          value={editing.value} autoFocus
                          onChange={e => setEditing({ ...editing, value: e.target.value })}
                          onBlur={() => commitEdit(`layered.${vi}.title`, editing.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(`layered.${vi}.title`, editing.value); if (e.key === 'Escape') setEditing(null) }}
                          onClick={e => e.stopPropagation()} />
                      ) : (
                        <span className="text-accent mono fw-bold cursor-clickable"
                          onDoubleClick={e => { e.stopPropagation(); startEdit(`layered.${vi}.title`, vol.title) }}>
                          第{vol.index}卷: {vol.title}
                        </span>
                      )}
                      <span className="text-dim text-xs">{vol.theme}</span>
                      <span className="text-dim text-xs ml-auto">{vol.arcs.length} 弧</span>
                    </div>
                    {expandedVols.has(vi) && (
                      <div style={{ marginLeft: 28, marginTop: 4 }}>
                        {vol.arcs.map((arc) => (
                          <div key={arc.index} className="mb-8" style={{ padding: '6px 8px', borderLeft: '2px solid var(--color-accent2)', marginLeft: 8 }}>
                            <div className="flex-row items-center gap-8">
                              {editing?.path === `layered.${vi}.arcs.${arc.index}.title` ? (
                                <input className="input-field text-sm" style={{ width: 200, padding: '2px 6px' }}
                                  value={editing.value} autoFocus
                                  onChange={e => setEditing({ ...editing, value: e.target.value })}
                                  onBlur={() => commitEdit(`layered.${vi}.arcs.${arc.index}.title`, editing.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(`layered.${vi}.arcs.${arc.index}.title`, editing.value); if (e.key === 'Escape') setEditing(null) }} />
                              ) : (
                                <span className="text-accent2 mono text-sm fw-bold cursor-clickable"
                                  onDoubleClick={() => startEdit(`layered.${vi}.arcs.${arc.index}.title`, arc.title)}>
                                  弧{arc.index}: {arc.title}
                                </span>
                              )}
                              {arc.estimatedChapters ? (
                                <span className="text-dim text-xs">[骨架弧, 预计{arc.estimatedChapters}章]</span>
                              ) : (
                                <span className="text-dim text-xs">{arc.chapters?.length || 0}章</span>
                              )}
                            </div>
                            {arc.goal && <div className="text-dim text-xs mt-4">目标: {arc.goal}</div>}
                            {arc.chapters?.map((ch) => (
                              <div key={ch.chapter} className="text-dim text-sm" style={{ marginLeft: 16, marginTop: 2 }}>
                                · {ch.title}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {layered.length === 0 && <div className="text-dim text-center mt-40">暂未设置分层大纲</div>}
              </div>
            )}
          </div>

          {compass && (
            <div className="card mt-16 flex-shrink-0">
              <div className="sidebar-section-header">指南针</div>
              <div className="text-dim text-sm">
                <div>终局: {compass.endingDirection}</div>
                {compass.openThreads?.length > 0 && <div>活跃长线: {compass.openThreads.join(' / ')}</div>}
                {compass.estimatedScale && <div>规模: {compass.estimatedScale}</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
