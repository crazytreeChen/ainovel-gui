import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import CastEcosystem from '@/components/characters/CastEcosystem'
import RelationGraph from '@/components/characters/RelationGraph'
import CharacterEditor from '@/components/characters/CharacterEditor'
import ImageViewer from '@/components/ImageViewer'
import type { Character, CastEntry, Relation } from '@/types/characters'
import { TIER_COLORS, TIER_LABELS, PLACEHOLDER_FACES } from '@/types/characters'
import { useBookId } from '@/hooks/useBookId'
import BackButton from '@/components/BackButton'

export default function CharactersPage() {
  const id = useBookId()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'chars' | 'cast' | 'relations' | 'eco'>('chars')
  const [chars, setChars] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTier, setFilterTier] = useState<string>('all')
  const [selected, setSelected] = useState<Character | null>(null)
  const [cast, setCast] = useState<CastEntry[]>([])
  const [castLoading, setCastLoading] = useState(false)
  const [selectedCast, setSelectedCast] = useState<CastEntry | null>(null)
  const [relations, setRelations] = useState<Relation[]>([])
  const [relLoading, setRelLoading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editChar, setEditChar] = useState<Character | null>(null)
  const [viewerSrc, setViewerSrc] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([loadChars(), loadCast(), loadRelations()])
  }, [id])

  async function loadChars() {
    if (!id || !window.electronAPI) return
    setLoading(true)
    const data = await window.electronAPI.getBookCharacters(id)
    setChars(data || [])
    setLoading(false)
  }

  async function loadCast() {
    if (!id || !window.electronAPI) return
    setCastLoading(true)
    const data = await window.electronAPI.getBookCast(id)
    setCast(data || [])
    setCastLoading(false)
  }

  async function loadRelations() {
    if (!id || !window.electronAPI) return
    setRelLoading(true)
    const data = await window.electronAPI.getBookTimeline(id)
    setRelations(data?.relationships || [])
    setRelLoading(false)
  }

  const saveChars = useCallback(async (updated: Character[]) => {
    if (!id || !window.electronAPI) return
    await window.electronAPI.saveBookCharacters(id, updated)
    setChars(updated)
  }, [id])

  function handleSave(char: Character) {
    const idx = chars.findIndex(c => c.name === char.name)
    let updated: Character[]
    if (idx >= 0) {
      updated = [...chars]
      updated[idx] = char
    } else {
      updated = [...chars, char]
    }
    saveChars(updated)
    setSelected(char)
    setEditChar(null)
    setEditorOpen(false)
  }

  function handleDelete(name: string) {
    const updated = chars.filter(c => c.name !== name)
    saveChars(updated)
    if (selected?.name === name) setSelected(null)
    setEditChar(null)
    setEditorOpen(false)
  }

  const filtered = filterTier === 'all' ? chars : chars.filter(c => c.tier === filterTier)

  return (
    <div className="flex-row p-24" style={{ height: '100vh', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div className="flex-1 flex-col overflow-hidden">
        <div className="flex-row items-center gap-12 mb-12 flex-shrink-0">
          <BackButton to={`/books/${id}/intro`} />
          <h2 className="mono text-accent m-0 text-lg">角色管理</h2>
          {tab === 'chars' && (
            <button className="welcome-mode-btn active text-xs ml-auto"
              onClick={() => { setEditChar(null); setEditorOpen(true) }}>+ 新建角色</button>
          )}
          <div className="ml-8 flex-row" style={{ gap: 6 }}>
            {([
              ['chars', `角色 (${chars.length})`],
              ['cast', `配角名册 (${cast.length})`],
              ['relations', `关系图谱 (${relations.length})`],
              ['eco', `配角生态 (${cast.length})`],
            ] as const).map(([k, label]) => (
              <button key={k} className={`welcome-mode-btn text-xs ${tab === k ? 'active' : ''}`}
                onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
        </div>

        {tab === 'chars' && (
          <>
            <div className="flex-row flex-shrink-0 mb-8" style={{ gap: 6 }}>
              {['all', 'core', 'important', 'secondary', 'decorative'].map(t => (
                <button key={t} className={`welcome-mode-btn text-xs ${filterTier === t ? 'active' : ''}`}
                  onClick={() => setFilterTier(t)}>
                  {t === 'all' ? '全部' : TIER_LABELS[t] || t}
                </button>
              ))}
            </div>

            {loading ? <div className="text-dim">加载中...</div> : (
              <div className="flex-1 flex-row gap-16 overflow-hidden">
                <div className="scroll-y border-right" style={{ width: '40%', paddingRight: 12 }}>
                  {filtered.map((c) => (
                    <div key={c.name} className="cursor-clickable flex-row items-center gap-10"
                      onClick={() => setSelected(c)}
                      style={{ padding: '10px 12px', marginBottom: 4, borderRadius: 'var(--radius)',
                        background: selected?.name === c.name ? 'var(--color-surface-2)' : 'transparent',
                        border: '1px solid transparent', borderLeft: `3px solid ${TIER_COLORS[c.tier] || '#666'}` }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                        background: c.avatar ? 'transparent' : 'var(--color-surface)',
                        border: c.avatar ? '1px solid var(--color-border)' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: c.avatar ? 'zoom-in' : 'default',
                      }}
                        onClick={e => { if (c.avatar) { e.stopPropagation(); setViewerSrc(c.avatar!) } }}>
                        {c.avatar ? (
                          <img src={c.avatar} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 16, opacity: 0.4 }}>{PLACEHOLDER_FACES[chars.indexOf(c) % PLACEHOLDER_FACES.length]}</span>
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: 14 }}>{c.name}</div>
                        <div className="text-dim text-xs flex-row gap-8">
                          <span style={{ color: TIER_COLORS[c.tier] }}>{TIER_LABELS[c.tier]}</span>
                          {c.role && <span>{c.role}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {filtered.length === 0 && <div className="text-dim text-center mt-40">暂无角色</div>}
                </div>

                <div className="flex-1 scroll-y">
                  {selected ? (
                    <div>
                      <div className="flex-row items-start gap-16 mb-16">
                        {selected.avatar && (
                          <div style={{
                            width: 80, height: 80, borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                            border: '1px solid var(--color-border)', cursor: 'zoom-in',
                          }}
                            onClick={() => setViewerSrc(selected.avatar!)}>
                            <img src={selected.avatar} alt={selected.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>{selected.name}</div>
                          <div className="text-dim text-sm flex-row gap-12">
                            <span style={{ color: TIER_COLORS[selected.tier] }}>{TIER_LABELS[selected.tier]}</span>
                            {selected.role && <span>· {selected.role}</span>}
                          </div>
                        </div>
                      </div>
                      {selected.aliases?.length > 0 && (
                        <div className="mb-12">
                          <div className="sidebar-section-header text-xs">别名</div>
                          <div className="text-dim text-sm">{selected.aliases.join(' · ')}</div>
                        </div>
                      )}
                      {selected.description && (
                        <div className="mb-12">
                          <div className="sidebar-section-header text-xs">描述</div>
                          <div className="text-dim text-sm" style={{ lineHeight: 1.6 }}>{selected.description}</div>
                        </div>
                      )}
                      {selected.arc && (
                        <div className="mb-12">
                          <div className="sidebar-section-header text-xs">角色弧</div>
                          <div className="text-dim text-sm">{selected.arc}</div>
                        </div>
                      )}
                      {selected.traits?.length > 0 && (
                        <div className="mb-12">
                          <div className="sidebar-section-header text-xs">性格特征</div>
                          <div className="text-dim text-sm">{selected.traits.join(' · ')}</div>
                        </div>
                      )}
                      <div className="flex-row gap-8 mt-16">
                        <button className="welcome-mode-btn text-xs"
                          onClick={() => { setEditChar(selected); setEditorOpen(true) }}>
                          编辑角色
                        </button>
                        <button className="welcome-mode-btn text-xs"
                          style={{ color: 'var(--color-error)' }}
                          onClick={() => { if (confirm(`确认删除角色「${selected.name}」？`)) handleDelete(selected.name) }}>
                          删除
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-dim text-center mt-60">选择一个角色查看详情</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'cast' && (
          <div className="flex-1 scroll-y">
            {castLoading ? <div className="text-dim">加载中...</div> : cast.length === 0 ? (
              <div className="text-dim text-center mt-60">
                <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>👥</div>
                <div style={{ fontSize: 14 }}>暂无配角名册</div>
                <div className="text-xs mt-8">配角由创作引擎在写作过程中自动记录</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                {cast.map((c, i) => (
                  <div key={c.name} className="cursor-clickable"
                    onClick={() => setSelectedCast(selectedCast?.name === c.name ? null : c)}
                    style={{ padding: 12, borderRadius: 'var(--radius)',
                      background: selectedCast?.name === c.name ? 'var(--color-surface-2)' : 'var(--color-surface)',
                      border: `1px solid ${selectedCast?.name === c.name ? 'var(--color-accent)' : 'var(--color-border)'}` }}>
                    <div className="flex-row items-center gap-8 mb-6">
                      <span style={{ fontSize: 18 }}>{PLACEHOLDER_FACES[i % PLACEHOLDER_FACES.length]}</span>
                      <div style={{ fontWeight: 'bold', fontSize: 14 }}>{c.name}</div>
                      {c.promoted && <span className="text-accent tag-sm" style={{ border: '1px solid var(--color-accent)' }}>晋级</span>}
                    </div>
                    {c.briefRole && <div className="text-dim text-sm mb-8">{c.briefRole}</div>}
                    <div className="text-dim text-xs mono flex-row gap-8">
                      <span>出场 {c.appearanceCount} 次</span>
                      {c.firstSeenChapter > 0 && <span>始于 #第{c.firstSeenChapter}章</span>}
                    </div>
                    {selectedCast?.name === c.name && (
                      <div className="mt-8" style={{ paddingTop: 8, borderTop: '1px solid var(--color-border)', fontSize: 12 }}>
                        {c.aliases?.length > 0 && <div className="text-dim mb-8">别名: {c.aliases.join(' · ')}</div>}
                        {c.appearanceChapters?.length > 0 && (
                          <div className="text-dim">出场章节: {c.appearanceChapters.slice(0, 20).join(', ')}{c.appearanceChapters.length > 20 ? '...' : ''}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'relations' && (
          <div className="flex-1 scroll-y">
            {relLoading ? <div className="text-dim">加载中...</div> : relations.length === 0 ? (
              <div className="text-dim text-center mt-60">
                <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>🔗</div>
                <div style={{ fontSize: 14 }}>暂无关系记录</div>
              </div>
            ) : (
              <RelationGraph relations={relations} chars={chars} cast={cast} />
            )}
          </div>
        )}

        {tab === 'eco' && (
          <CastEcosystem chars={chars} cast={cast} relations={relations} />
        )}
      </div>

      {/* 角色编辑器模态框 */}
      {editorOpen && (
        <CharacterEditor
          character={editChar}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => { setEditorOpen(false); setEditChar(null) }}
        />
      )}

      {/* 图片放大查看 */}
      {viewerSrc && (
        <ImageViewer src={viewerSrc} alt="头像" onClose={() => setViewerSrc(null)} />
      )}
    </div>
  )
}
