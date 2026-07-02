import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'

interface WorldRule {
  id?: number; category: string; ruleText: string; rule_text?: string; boundary: string
}

export default function WorldRulesPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'world' | 'style'>('world')
  const [worldRules, setWorldRules] = useState<WorldRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [styleRules, setStyleRules] = useState<{ prose: string[]; dialogue: (string | { name: string; rules: string[] })[]; taboos: string[] }>({ prose: [], dialogue: [], taboos: [] })

  const [newCategory, setNewCategory] = useState('')
  const [newRuleText, setNewRuleText] = useState('')
  const [newBoundary, setNewBoundary] = useState('')
  const [newProse, setNewProse] = useState('')
  const [newDialogue, setNewDialogue] = useState('')
  const [newTaboo, setNewTaboo] = useState('')

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    if (!id || !window.electronAPI) return
    setLoading(true)
    const [world, style] = await Promise.all([
      window.electronAPI.getWorldRules(id),
      window.electronAPI.getStyleRules(id),
    ])
    setWorldRules(world || [])
    if (style) setStyleRules({ prose: style.prose || [], dialogue: style.dialogue || [], taboos: style.taboos || [] })
    setLoading(false)
  }

  async function handleSaveWorld() {
    if (!id || !window.electronAPI) return
    setSaving(true)
    const ok = await window.electronAPI.saveWorldRules(id, worldRules)
    setSaving(false)
    setStatusMsg(ok ? '已保存' : '保存失败')
    setTimeout(() => setStatusMsg(''), 2000)
  }

  async function handleSaveStyle() {
    if (!id || !window.electronAPI) return
    setSaving(true)
    const ok = await window.electronAPI.saveStyleRules(id, styleRules)
    setSaving(false)
    setStatusMsg(ok ? '已保存' : '保存失败')
    setTimeout(() => setStatusMsg(''), 2000)
  }

  function addWorldRule() {
    if (!newCategory.trim() || !newRuleText.trim()) return
    setWorldRules(prev => [...prev, { category: newCategory.trim(), ruleText: newRuleText.trim(), boundary: newBoundary.trim() }])
    setNewCategory(''); setNewRuleText(''); setNewBoundary('')
  }

  function removeWorldRule(index: number) {
    setWorldRules(prev => prev.filter((_, i) => i !== index))
  }

  const groupedRules = worldRules.reduce<Record<string, WorldRule[]>>((acc, r) => {
    if (!acc[r.category]) acc[r.category] = []
    acc[r.category].push(r)
    return acc
  }, {})

  if (loading) return <div className="text-dim p-32">加载中...</div>

  return (
    <div className="flex-row p-24" style={{ height: '100vh', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div className="flex-1 flex-col overflow-hidden">
        <div className="flex-row items-center gap-12 mb-16 flex-shrink-0">
          <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回</button>
          <h2 className="mono text-accent m-0 text-lg">世界观与风格规则</h2>
          <div className="ml-auto flex-row items-center gap-8">
            {statusMsg && <span className="text-success text-sm">{statusMsg}</span>}
            <button className="welcome-mode-btn active" onClick={tab === 'world' ? handleSaveWorld : handleSaveStyle} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        <div className="flex-row gap-8 mb-12 flex-shrink-0">
          <button className={`welcome-mode-btn text-xs ${tab === 'world' ? 'active' : ''}`} onClick={() => setTab('world')}>世界观 ({worldRules.length})</button>
          <button className={`welcome-mode-btn text-xs ${tab === 'style' ? 'active' : ''}`} onClick={() => setTab('style')}>风格规则</button>
        </div>

        {tab === 'world' && (
          <div className="flex-1 scroll-y">
            <div className="card mb-12">
              <div className="sidebar-section-header text-sm mb-8">添加上世界观规则</div>
              <div className="flex-row gap-8 mb-8">
                <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="分类（如：魔法体系、社会结构）"
                  className="input-field text-sm" style={{ flex: 1 }} />
                <input value={newBoundary} onChange={e => setNewBoundary(e.target.value)} placeholder="边界限制"
                  className="input-field text-sm" style={{ width: 150 }} />
              </div>
              <div className="flex-row gap-8">
                <input value={newRuleText} onChange={e => setNewRuleText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addWorldRule()}
                  placeholder="规则描述..."
                  className="input-field text-sm" style={{ flex: 1 }} />
                <button className="welcome-mode-btn" onClick={addWorldRule}>添加</button>
              </div>
            </div>

            {Object.keys(groupedRules).length === 0 ? (
              <div className="text-dim text-center mt-40">暂无世界观规则</div>
            ) : (
              Object.entries(groupedRules).map(([cat, rules]) => (
                <div key={cat} className="mb-12">
                  <div className="sidebar-section-header text-sm mb-8" style={{ color: 'var(--color-accent2)' }}>{cat}</div>
                  {rules.map((r) => {
                    const globalIdx = worldRules.indexOf(r)
                    return (
                      <div key={r.id ?? `${r.category}-${r.ruleText}-${r.boundary}`}
                        className="card-sm flex-row gap-8" style={{ marginBottom: 4, alignItems: 'flex-start' }}>
                        <div className="flex-1">
                          <div className="text-sm" style={{ lineHeight: 1.5 }}>{r.ruleText || r.rule_text || ''}</div>
                          {r.boundary && <div className="text-dim text-xs mt-4">边界: {r.boundary}</div>}
                        </div>
                        <button onClick={() => removeWorldRule(globalIdx)}
                          className="text-dim" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 2, flexShrink: 0 }}>✕</button>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'style' && (
          <div className="flex-1 scroll-y">
            {/* 散文风格 */}
            <div className="card mb-12">
              <div className="sidebar-section-header text-sm mb-8">散文风格 ({styleRules.prose.length})</div>
              <div className="flex-row gap-8 mb-8">
                <input value={newProse} onChange={e => setNewProse(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (() => { if (newProse.trim()) { setStyleRules(prev => ({ ...prev, prose: [...prev.prose, newProse.trim()] })); setNewProse('') } })()}
                  placeholder="添加散文风格描述..." className="input-field text-sm" style={{ flex: 1 }} />
                <button className="welcome-mode-btn" onClick={() => { if (newProse.trim()) { setStyleRules(prev => ({ ...prev, prose: [...prev.prose, newProse.trim()] })); setNewProse('') } }}>添加</button>
              </div>
              <div className="flex-row flex-wrap" style={{ gap: 4 }}>
                {styleRules.prose.map((item) => (
                  <span key={item} className="tag" style={{ background: 'rgba(126,197,216,0.15)', color: '#7ec5d8' }}>
                    {item}
                    <button onClick={() => setStyleRules(prev => ({ ...prev, prose: prev.prose.filter(p => p !== item) }))} className="text-dim" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: '#7ec5d8' }}>✕</button>
                  </span>
                ))}
              </div>
            </div>

            {/* 对白风格 */}
            <div className="card mb-12">
              <div className="sidebar-section-header text-sm mb-8">对白风格 ({styleRules.dialogue.length})</div>
              <div className="flex-row gap-8 mb-8">
                <input value={newDialogue} onChange={e => setNewDialogue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (() => { if (newDialogue.trim()) { setStyleRules(prev => ({ ...prev, dialogue: [...prev.dialogue, newDialogue.trim()] })); setNewDialogue('') } })()}
                  placeholder="添加对白风格描述..." className="input-field text-sm" style={{ flex: 1 }} />
                <button className="welcome-mode-btn" onClick={() => { if (newDialogue.trim()) { setStyleRules(prev => ({ ...prev, dialogue: [...prev.dialogue, newDialogue.trim()] })); setNewDialogue('') } }}>添加</button>
              </div>
              <div className="flex-row flex-wrap" style={{ gap: 4 }}>
                {styleRules.dialogue.map((item) => {
                  if (typeof item === 'string') {
                    return <span key={item} className="tag" style={{ background: 'rgba(94,184,163,0.15)', color: '#5fb8a3' }}>{item}
                      <button onClick={() => setStyleRules(prev => ({ ...prev, dialogue: prev.dialogue.filter(d => d !== item) }))} className="text-dim" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: '#5fb8a3' }}>✕</button>
                    </span>
                  }
                  return <span key={item.name} className="text-sm" style={{ padding: '4px 10px', background: 'rgba(94,184,163,0.1)', color: '#5fb8a3', borderRadius: 'var(--radius-sm)', display: 'inline-block', marginBottom: 4 }}>
                    <strong>{item.name}</strong>: {(item.rules || []).join('；')}
                    <button onClick={() => setStyleRules(prev => ({ ...prev, dialogue: prev.dialogue.filter(d => typeof d === 'string' || d.name !== item.name) }))} className="text-dim" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: '#5fb8a3', marginLeft: 4 }}>✕</button>
                  </span>
                })}
              </div>
            </div>

            {/* 禁忌 */}
            <div className="card">
              <div className="sidebar-section-header text-sm mb-8">禁忌 ({styleRules.taboos.length})</div>
              <div className="flex-row gap-8 mb-8">
                <input value={newTaboo} onChange={e => setNewTaboo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (() => { if (newTaboo.trim()) { setStyleRules(prev => ({ ...prev, taboos: [...prev.taboos, newTaboo.trim()] })); setNewTaboo('') } })()}
                  placeholder="添加禁忌..." className="input-field text-sm" style={{ flex: 1 }} />
                <button className="welcome-mode-btn" onClick={() => { if (newTaboo.trim()) { setStyleRules(prev => ({ ...prev, taboos: [...prev.taboos, newTaboo.trim()] })); setNewTaboo('') } }}>添加</button>
              </div>
              <div className="flex-row flex-wrap" style={{ gap: 4 }}>
                {styleRules.taboos.map((item) => (
                  <span key={item} className="tag" style={{ background: 'rgba(224,112,96,0.15)', color: '#e07060' }}>
                    {item}
                    <button onClick={() => setStyleRules(prev => ({ ...prev, taboos: prev.taboos.filter(t => t !== item) }))} className="text-dim" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, color: '#e07060' }}>✕</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
