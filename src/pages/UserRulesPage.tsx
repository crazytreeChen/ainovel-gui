import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'

interface WordRange { min: number; max: number }

interface UserRulesStructured {
  genre?: string
  chapterWords?: WordRange
  forbiddenChars: string[]
  forbiddenPhrases: string[]
  fatigueWords: Record<string, number>
}

interface UserRulesData {
  version: number
  status: 'ready' | 'degraded'
  structured: UserRulesStructured
  preferences: string
  sources: string[]
  uncertain: string[]
}

const defaultStructured: UserRulesStructured = {
  genre: '',
  chapterWords: { min: 1000, max: 3000 },
  forbiddenChars: [],
  forbiddenPhrases: [],
  fatigueWords: {},
}

export default function UserRulesPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [rules, setRules] = useState<UserRulesData>({
    version: 1, status: 'ready', structured: { ...defaultStructured },
    preferences: '', sources: [], uncertain: [],
  })
  const [tab, setTab] = useState<'overview' | 'structure' | 'preferences'>('overview')

  // 新规则输入
  const [newChar, setNewChar] = useState('')
  const [newPhrase, setNewPhrase] = useState('')
  const [newFatigueWord, setNewFatigueWord] = useState('')
  const [newFatigueCount, setNewFatigueCount] = useState(3)
  const [newSource, setNewSource] = useState('')
  const [newUncertain, setNewUncertain] = useState('')

  useEffect(() => { loadRules() }, [id])

  async function loadRules() {
    if (!id || !window.electronAPI) return
    setLoading(true)
    const data = await window.electronAPI.getUserRules(id)
    if (data) {
      setRules({
        version: data.version || 1,
        status: data.status || 'ready',
        structured: {
          genre: data.structured?.genre || '',
          chapterWords: data.structured?.chapterWords || { min: 1000, max: 3000 },
          forbiddenChars: data.structured?.forbiddenChars || [],
          forbiddenPhrases: data.structured?.forbiddenPhrases || [],
          fatigueWords: data.structured?.fatigueWords || {},
        },
        preferences: data.preferences || '',
        sources: data.sources || [],
        uncertain: data.uncertain || [],
      })
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!id || !window.electronAPI) return
    setSaving(true)
    const ok = await window.electronAPI.saveUserRules(id, rules)
    setSaving(false)
    setStatusMsg(ok ? '已保存' : '保存失败')
    setTimeout(() => setStatusMsg(''), 2000)
  }

  function updateStructured(updates: Partial<UserRulesStructured>) {
    setRules(prev => ({
      ...prev,
      structured: { ...prev.structured, ...updates },
    }))
  }

  function addItem(field: 'sources' | 'uncertain', value: string) {
    if (!value.trim()) return
    setRules(prev => ({
      ...prev,
      [field]: [...prev[field], value.trim()],
    }))
  }

  function removeItem(field: 'sources' | 'uncertain', index: number) {
    setRules(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }))
  }

  function addForbiddenChar() {
    if (!newChar.trim()) return
    updateStructured({ forbiddenChars: [...rules.structured.forbiddenChars, newChar.trim()] })
    setNewChar('')
  }

  function removeForbiddenChar(index: number) {
    updateStructured({ forbiddenChars: rules.structured.forbiddenChars.filter((_, i) => i !== index) })
  }

  function addForbiddenPhrase() {
    if (!newPhrase.trim()) return
    updateStructured({ forbiddenPhrases: [...rules.structured.forbiddenPhrases, newPhrase.trim()] })
    setNewPhrase('')
  }

  function removeForbiddenPhrase(index: number) {
    updateStructured({ forbiddenPhrases: rules.structured.forbiddenPhrases.filter((_, i) => i !== index) })
  }

  function addFatigueWord() {
    if (!newFatigueWord.trim()) return
    updateStructured({ fatigueWords: { ...rules.structured.fatigueWords, [newFatigueWord.trim()]: newFatigueCount } })
    setNewFatigueWord('')
    setNewFatigueCount(3)
  }

  function removeFatigueWord(word: string) {
    const { [word]: _, ...rest } = rules.structured.fatigueWords
    updateStructured({ fatigueWords: rest })
  }

  if (loading) return <div className="text-dim" style={{ padding: 32 }}>加载中...</div>

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 导航 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回</button>
        <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>用户规则</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {statusMsg && <span className="text-success" style={{ fontSize: 12 }}>{statusMsg}</span>}
          <button className="welcome-mode-btn active" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* 状态条 */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12, flexShrink: 0,
        padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)', fontSize: 12,
      }}>
        <span>版本: v{rules.version}</span>
        <span style={{
          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 'bold',
          background: rules.status === 'ready' ? 'rgba(126,196,136,0.2)' : 'rgba(224,112,96,0.2)',
          color: rules.status === 'ready' ? '#7ec488' : '#e07060',
        }}>
          {rules.status === 'ready' ? '就绪' : '降级'}
        </span>
        <span className="text-dim">{rules.sources.length} 来源 · {rules.uncertain.length} 不确定项</span>
      </div>

      {/* 标签切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
        {([
          ['overview', '概览'],
          ['structure', '结构化规则'],
          ['preferences', '偏好说明'],
        ] as const).map(([k, label]) => (
          <button key={k} className={`welcome-mode-btn ${tab === k ? 'active' : ''}`}
            onClick={() => setTab(k as any)} style={{ fontSize: 11 }}>{label}</button>
        ))}
      </div>

      {/* 内容 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'overview' && (
          <div>
            {/* 结构化规则摘要 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
              <div className="sidebar-section-header" style={{ marginBottom: 8 }}>结构化规则概览</div>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <div><span className="text-dim">类型:</span> {rules.structured.genre || '（未设置）'}</div>
                <div><span className="text-dim">章节字数:</span> {rules.structured.chapterWords?.min || 1000} - {rules.structured.chapterWords?.max || 3000}</div>
                <div><span className="text-dim">禁用字:</span> {rules.structured.forbiddenChars.length > 0 ? rules.structured.forbiddenChars.join(' · ') : '（无）'}</div>
                <div><span className="text-dim">禁用短语:</span> {rules.structured.forbiddenPhrases.length > 0 ? rules.structured.forbiddenPhrases.join(' · ') : '（无）'}</div>
                <div><span className="text-dim">疲劳词:</span> {Object.keys(rules.structured.fatigueWords).length > 0
                  ? Object.entries(rules.structured.fatigueWords).map(([w, c]) => `${w}(${c})`).join(' · ')
                  : '（无）'}</div>
              </div>
            </div>

            {/* 来源列表 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
              <div className="sidebar-section-header" style={{ marginBottom: 8 }}>规则来源 ({rules.sources.length})</div>
              {rules.sources.length > 0 ? (
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                  {rules.sources.map((s, i) => (
                    <div key={i} className="text-dim" style={{ padding: '2px 0', display: 'flex', gap: 8 }}>
                      <span className="text-accent2">{i + 1}.</span>
                      <span>{s}</span>
                      <button onClick={() => removeItem('sources', i)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-dim)', cursor: 'pointer', marginLeft: 'auto', fontSize: 11 }}>✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-dim" style={{ fontSize: 12 }}>暂无来源记录</div>
              )}
            </div>

            {/* 不确定项列表 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16 }}>
              <div className="sidebar-section-header" style={{ marginBottom: 8 }}>不确定项 ({rules.uncertain.length})</div>
              {rules.uncertain.length > 0 ? (
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                  {rules.uncertain.map((u, i) => (
                    <div key={i} className="text-dim" style={{ padding: '2px 0', display: 'flex', gap: 8 }}>
                      <span style={{ color: '#e09b5a' }}>⚠</span>
                      <span>{u}</span>
                      <button onClick={() => removeItem('uncertain', i)}
                        style={{ background: 'none', border: 'none', color: 'var(--color-dim)', cursor: 'pointer', marginLeft: 'auto', fontSize: 11 }}>✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-dim" style={{ fontSize: 12 }}>暂无不确定项</div>
              )}
            </div>
          </div>
        )}

        {tab === 'structure' && (
          <div>
            {/* 体裁 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
              <div className="sidebar-section-header" style={{ marginBottom: 8 }}>体裁 / 类型</div>
              <input
                value={rules.structured.genre || ''}
                onChange={e => updateStructured({ genre: e.target.value })}
                placeholder="例: 玄幻、悬疑、言情..."
                style={{
                  width: '100%', padding: '8px 12px', background: 'var(--color-bg)',
                  color: 'var(--color-text)', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)', outline: 'none', fontSize: 13,
                }}
              />
            </div>

            {/* 章节字数范围 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
              <div className="sidebar-section-header" style={{ marginBottom: 8 }}>章节字数范围</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div>
                  <div className="text-dim" style={{ fontSize: 11, marginBottom: 4 }}>最少</div>
                  <input type="number" value={rules.structured.chapterWords?.min || 1000}
                    onChange={e => updateStructured({ chapterWords: { ...rules.structured.chapterWords || { min: 1000, max: 3000 }, min: parseInt(e.target.value) || 0 } })}
                    style={{ width: 100, padding: '6px 8px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 13 }}
                  />
                </div>
                <span className="text-dim">—</span>
                <div>
                  <div className="text-dim" style={{ fontSize: 11, marginBottom: 4 }}>最多</div>
                  <input type="number" value={rules.structured.chapterWords?.max || 3000}
                    onChange={e => updateStructured({ chapterWords: { ...rules.structured.chapterWords || { min: 1000, max: 3000 }, max: parseInt(e.target.value) || 0 } })}
                    style={{ width: 100, padding: '6px 8px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 13 }}
                  />
                </div>
              </div>
            </div>

            {/* 禁用字 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
              <div className="sidebar-section-header" style={{ marginBottom: 8 }}>禁用字 ({rules.structured.forbiddenChars.length})</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={newChar} onChange={e => setNewChar(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addForbiddenChar()}
                  placeholder="输入禁用字..."
                  style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 12 }}
                />
                <button className="welcome-mode-btn" onClick={addForbiddenChar}>添加</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {rules.structured.forbiddenChars.map((c, i) => (
                  <span key={i} style={{
                    padding: '2px 8px', background: 'rgba(224,112,96,0.15)', color: '#e07060',
                    borderRadius: 'var(--radius-sm)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {c}
                    <button onClick={() => removeForbiddenChar(i)}
                      style={{ background: 'none', border: 'none', color: '#e07060', cursor: 'pointer', padding: 0, fontSize: 12 }}>✕</button>
                  </span>
                ))}
              </div>
            </div>

            {/* 禁用短语 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
              <div className="sidebar-section-header" style={{ marginBottom: 8 }}>禁用短语 ({rules.structured.forbiddenPhrases.length})</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={newPhrase} onChange={e => setNewPhrase(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addForbiddenPhrase()}
                  placeholder="输入禁用短语..."
                  style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 12 }}
                />
                <button className="welcome-mode-btn" onClick={addForbiddenPhrase}>添加</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {rules.structured.forbiddenPhrases.map((p, i) => (
                  <span key={i} style={{
                    padding: '2px 8px', background: 'rgba(224,112,96,0.15)', color: '#e07060',
                    borderRadius: 'var(--radius-sm)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {p}
                    <button onClick={() => removeForbiddenPhrase(i)}
                      style={{ background: 'none', border: 'none', color: '#e07060', cursor: 'pointer', padding: 0, fontSize: 12 }}>✕</button>
                  </span>
                ))}
              </div>
            </div>

            {/* 疲劳词 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
              <div className="sidebar-section-header" style={{ marginBottom: 8 }}>疲劳词 ({Object.keys(rules.structured.fatigueWords).length})</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={newFatigueWord} onChange={e => setNewFatigueWord(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addFatigueWord()}
                  placeholder="输入疲劳词..."
                  style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 12 }}
                />
                <input type="number" value={newFatigueCount} onChange={e => setNewFatigueCount(parseInt(e.target.value) || 3)}
                  style={{ width: 60, padding: '6px 8px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 12 }}
                  title="每次出现计数"
                />
                <button className="welcome-mode-btn" onClick={addFatigueWord}>添加</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.entries(rules.structured.fatigueWords).map(([word, count]) => (
                  <span key={word} style={{
                    padding: '2px 8px', background: 'rgba(224,155,90,0.15)', color: '#e09b5a',
                    borderRadius: 'var(--radius-sm)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {word}({count})
                    <button onClick={() => removeFatigueWord(word)}
                      style={{ background: 'none', border: 'none', color: '#e09b5a', cursor: 'pointer', padding: 0, fontSize: 12 }}>✕</button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'preferences' && (
          <div>
            {/* 偏好说明 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
              <div className="sidebar-section-header" style={{ marginBottom: 8 }}>偏好说明</div>
              <textarea
                value={rules.preferences}
                onChange={e => setRules(prev => ({ ...prev, preferences: e.target.value }))}
                placeholder="用自然语言描述你的写作偏好、风格要求、需要 AI 注意的事项..."
                style={{
                  width: '100%', minHeight: 150, resize: 'vertical', padding: 12,
                  background: 'var(--color-bg)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                  outline: 'none', fontSize: 13, lineHeight: 1.6, fontFamily: 'var(--font-mono)',
                }}
              />
            </div>

            {/* 添加来源 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
              <div className="sidebar-section-header" style={{ marginBottom: 8 }}>添加规则来源</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newSource} onChange={e => setNewSource(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addItem('sources', newSource)}
                  placeholder="描述规则来源..."
                  style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 12 }}
                />
                <button className="welcome-mode-btn" onClick={() => { addItem('sources', newSource); setNewSource('') }}>添加</button>
              </div>
            </div>

            {/* 添加不确定项 */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16 }}>
              <div className="sidebar-section-header" style={{ marginBottom: 8 }}>添加不确定项</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newUncertain} onChange={e => setNewUncertain(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addItem('uncertain', newUncertain)}
                  placeholder="描述不确定的规则..."
                  style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', outline: 'none', fontSize: 12 }}
                />
                <button className="welcome-mode-btn" onClick={() => { addItem('uncertain', newUncertain); setNewUncertain('') }}>添加</button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
