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
  // 世界观
  const [worldRules, setWorldRules] = useState<WorldRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  // 风格规则
  const [styleRules, setStyleRules] = useState<{ prose: string[]; dialogue: (string | { name: string; rules: string[] })[]; taboos: string[] }>({ prose: [], dialogue: [], taboos: [] })

  // 新增世界观的输入
  const [newCategory, setNewCategory] = useState('')
  const [newRuleText, setNewRuleText] = useState('')
  const [newBoundary, setNewBoundary] = useState('')

  // 新增风格规则
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

  if (loading) return <div className="text-dim" style={{ padding: 32 }}>加载中...</div>

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
          <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回</button>
          <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>世界观与风格规则</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {statusMsg && <span className="text-success" style={{ fontSize: 12 }}>{statusMsg}</span>}
            <button className="welcome-mode-btn active" onClick={tab === 'world' ? handleSaveWorld : handleSaveStyle} disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
          <button className={`welcome-mode-btn ${tab === 'world' ? 'active' : ''}`} onClick={() => setTab('world')} style={{ fontSize: 11 }}>世界观 ({worldRules.length})</button>
          <button className={`welcome-mode-btn ${tab === 'style' ? 'active' : ''}`} onClick={() => setTab('style')} style={{ fontSize: 11 }}>风格规则</button>
        </div>

        {tab === 'world' && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* 添加新规则 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 12 }}>
              <div className="sidebar-section-header" style={{ fontSize: 12, marginBottom: 8 }}>添加上世界观规则</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="分类（如：魔法体系、社会结构）"
                  style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 12 }}
                />
                <input value={newBoundary} onChange={e => setNewBoundary(e.target.value)} placeholder="边界限制"
                  style={{ width: 150, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 12 }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newRuleText} onChange={e => setNewRuleText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addWorldRule()}
                  placeholder="规则描述..."
                  style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 12 }}
                />
                <button className="welcome-mode-btn" onClick={addWorldRule}>添加</button>
              </div>
            </div>

            {/* 规则列表 */}
            {Object.keys(groupedRules).length === 0 ? (
              <div className="text-dim" style={{ marginTop: 40, textAlign: 'center' }}>暂无世界观规则</div>
            ) : (
              Object.entries(groupedRules).map(([cat, rules]) => (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <div className="sidebar-section-header" style={{ fontSize: 12, marginBottom: 6, color: 'var(--color-accent2)' }}>{cat}</div>
                  {rules.map((r, i) => {
                    const globalIdx = worldRules.indexOf(r)
                    return (
                      <div key={i} style={{
                        padding: '8px 12px', marginBottom: 4, borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                        display: 'flex', gap: 8, alignItems: 'flex-start',
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, lineHeight: 1.5 }}>{r.ruleText || r.rule_text || ''}</div>
                          {r.boundary && <div className="text-dim" style={{ fontSize: 11, marginTop: 2 }}>边界: {r.boundary}</div>}
                        </div>
                        <button onClick={() => removeWorldRule(globalIdx)}
                          style={{ background: 'none', border: 'none', color: 'var(--color-dim)', cursor: 'pointer', fontSize: 12, padding: 2, flexShrink: 0 }}>✕</button>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'style' && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* 散文风格 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 12 }}>
              <div className="sidebar-section-header" style={{ fontSize: 12, marginBottom: 6 }}>散文风格 ({styleRules.prose.length})</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input value={newProse} onChange={e => setNewProse(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (() => { if (newProse.trim()) { setStyleRules(prev => ({ ...prev, prose: [...prev.prose, newProse.trim()] })); setNewProse('') } })()}
                  placeholder="添加散文风格描述..."
                  style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 12 }}
                />
                <button className="welcome-mode-btn" onClick={() => { if (newProse.trim()) { setStyleRules(prev => ({ ...prev, prose: [...prev.prose, newProse.trim()] })); setNewProse('') } }}>添加</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {styleRules.prose.map((item, i) => (
                  <span key={i} style={{ padding: '2px 8px', background: 'rgba(126,197,216,0.15)', color: '#7ec5d8', borderRadius: 'var(--radius-sm)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {item}
                    <button onClick={() => setStyleRules(prev => ({ ...prev, prose: prev.prose.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', color: '#7ec5d8', cursor: 'pointer', padding: 0, fontSize: 12 }}>✕</button>
                  </span>
                ))}
              </div>
            </div>

            {/* 对白风格 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 12 }}>
              <div className="sidebar-section-header" style={{ fontSize: 12, marginBottom: 6 }}>对白风格 ({styleRules.dialogue.length})</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input value={newDialogue} onChange={e => setNewDialogue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (() => { if (newDialogue.trim()) { setStyleRules(prev => ({ ...prev, dialogue: [...prev.dialogue, newDialogue.trim()] })); setNewDialogue('') } })()}
                  placeholder="添加对白风格描述..."
                  style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 12 }}
                />
                <button className="welcome-mode-btn" onClick={() => { if (newDialogue.trim()) { setStyleRules(prev => ({ ...prev, dialogue: [...prev.dialogue, newDialogue.trim()] })); setNewDialogue('') } }}>添加</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {styleRules.dialogue.map((item, i) => {
                  if (typeof item === 'string') {
                    return <span key={i} style={{ padding: '2px 8px', background: 'rgba(94,184,163,0.15)', color: '#5fb8a3', borderRadius: 'var(--radius-sm)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>{item}
                      <button onClick={() => setStyleRules(prev => ({ ...prev, dialogue: prev.dialogue.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', color: '#5fb8a3', cursor: 'pointer', padding: 0, fontSize: 12 }}>✕</button>
                    </span>
                  }
                  return <span key={i} style={{ padding: '4px 10px', background: 'rgba(94,184,163,0.1)', color: '#5fb8a3', borderRadius: 'var(--radius-sm)', fontSize: 12, display: 'inline-block', marginBottom: 4 }}>
                    <strong>{item.name}</strong>: {(item.rules || []).join('；')}
                    <button onClick={() => setStyleRules(prev => ({ ...prev, dialogue: prev.dialogue.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', color: '#5fb8a3', cursor: 'pointer', padding: 0, fontSize: 12, marginLeft: 4 }}>✕</button>
                  </span>
                })}
              </div>
            </div>

            {/* 禁忌 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 14 }}>
              <div className="sidebar-section-header" style={{ fontSize: 12, marginBottom: 6 }}>禁忌 ({styleRules.taboos.length})</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input value={newTaboo} onChange={e => setNewTaboo(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (() => { if (newTaboo.trim()) { setStyleRules(prev => ({ ...prev, taboos: [...prev.taboos, newTaboo.trim()] })); setNewTaboo('') } })()}
                  placeholder="添加禁忌..."
                  style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 12 }}
                />
                <button className="welcome-mode-btn" onClick={() => { if (newTaboo.trim()) { setStyleRules(prev => ({ ...prev, taboos: [...prev.taboos, newTaboo.trim()] })); setNewTaboo('') } }}>添加</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {styleRules.taboos.map((item, i) => (
                  <span key={i} style={{ padding: '2px 8px', background: 'rgba(224,112,96,0.15)', color: '#e07060', borderRadius: 'var(--radius-sm)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {item}
                    <button onClick={() => setStyleRules(prev => ({ ...prev, taboos: prev.taboos.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', color: '#e07060', cursor: 'pointer', padding: 0, fontSize: 12 }}>✕</button>
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
