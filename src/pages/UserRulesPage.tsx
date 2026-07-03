import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import RulesEditor from '@/components/rules/RulesEditor'
import PreferencesEditor from '@/components/rules/PreferencesEditor'
import SourcesList from '@/components/rules/SourcesList'
import UncertainList from '@/components/rules/UncertainList'
import { useBookId } from '@/hooks/useBookId'
import { showToast } from '@/components/Toast'

interface WordRange { min: number; max: number }
interface UserRulesStructured {
  forbiddenCharacters: string[]; forbiddenPhrases: string[]
  wordCountRange: WordRange; fatigueWords: string[]
  stylePreferences: string; tabooTopics: string[]
  sources: string[]; uncertain: string[]
}
interface UserRulesData {
  rules: UserRulesStructured
  directives: any[]
}
interface Directive {
  chapter: number; text: string; active: boolean
}

export default function UserRulesPage() {
  const id = useBookId()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'rules' | 'prefs' | 'sources' | 'uncertain' | 'directives'>('rules')
  const [original, setOriginal] = useState<UserRulesStructured | null>(null)
  const [data, setData] = useState<UserRulesStructured>({
    forbiddenCharacters: [], forbiddenPhrases: [], wordCountRange: { min: 0, max: 0 },
    fatigueWords: [], stylePreferences: '', tabooTopics: [],
    sources: [], uncertain: [],
  })
  const [directives, setDirectives] = useState<Directive[]>([])

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    if (!id || !window.electronAPI) return
    setLoading(true)
    const [rulesResult, userRules] = await Promise.all([
      window.electronAPI.getUserRules(id),
      window.electronAPI.getUserDirectives(id),
    ])
    if (rulesResult?.rules) { setData(rulesResult.rules); setOriginal(JSON.parse(JSON.stringify(rulesResult.rules))) }
    if (rulesResult?.directives) setDirectives(rulesResult.directives)
    if (userRules?.length) setDirectives(userRules.map((d: any) => ({ chapter: d.chapter || 0, text: d.text || d.instruction || '', active: true })))
    setLoading(false)
  }

  async function handleSave() {
    if (!id || !window.electronAPI) return
    setSaving(true)
    await window.electronAPI.saveUserRules(id, { rules: data, directives })
    setOriginal(JSON.parse(JSON.stringify(data)))
    setSaving(false)
    showToast('用户规则已保存', 'success')
  }

  function updateStructured(updates: Partial<UserRulesStructured>) {
    setData(prev => ({ ...prev, ...updates }))
  }

  function addItem(field: 'sources' | 'uncertain', value: string) {
    if (!value.trim()) return
    setData(prev => ({ ...prev, [field]: [...prev[field], value.trim()] }))
  }

  function removeItem(field: 'sources' | 'uncertain', index: number) {
    setData(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }))
  }

  function addForbiddenChar() {
    const name = prompt('输入禁用的角色名/类型:')
    if (name) setData(prev => ({ ...prev, forbiddenCharacters: [...prev.forbiddenCharacters, name.trim()] }))
  }

  function removeForbiddenChar(index: number) {
    setData(prev => ({ ...prev, forbiddenCharacters: prev.forbiddenCharacters.filter((_, i) => i !== index) }))
  }

  function addForbiddenPhrase() {
    const phrase = prompt('输入禁用的短语:')
    if (phrase) setData(prev => ({ ...prev, forbiddenPhrases: [...prev.forbiddenPhrases, phrase.trim()] }))
  }

  function removeForbiddenPhrase(index: number) {
    setData(prev => ({ ...prev, forbiddenPhrases: prev.forbiddenPhrases.filter((_, i) => i !== index) }))
  }

  function addFatigueWord() {
    const word = prompt('输入易疲劳词:')
    if (word) setData(prev => ({ ...prev, fatigueWords: [...prev.fatigueWords, word.trim()] }))
  }

  function removeFatigueWord(word: string) {
    setData(prev => ({ ...prev, fatigueWords: prev.fatigueWords.filter(w => w !== word) }))
  }

  if (loading) return <div className="text-dim" style={{ padding: 32 }}>加载中...</div>

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
          <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回</button>
          <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>用户规则</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {([
              ['rules', '规则'],
              ['prefs', '偏好'],
              ['sources', '来源'],
              ['uncertain', '不确定性'],
              ['directives', '指令'],
            ] as const).map(([k, label]) => (
              <button key={k} className={`welcome-mode-btn ${tab === k ? 'active' : ''}`}
                onClick={() => setTab(k)} style={{ fontSize: 11 }}>{label}</button>
            ))}
          </div>
          <button className="welcome-mode-btn active" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.8 }}>
          {tab === 'rules' && (
            <RulesEditor
              data={data}
              onUpdate={updateStructured}
              onAddForbiddenChar={addForbiddenChar}
              onRemoveForbiddenChar={removeForbiddenChar}
              onAddForbiddenPhrase={addForbiddenPhrase}
              onRemoveForbiddenPhrase={removeForbiddenPhrase}
              onAddFatigueWord={addFatigueWord}
              onRemoveFatigueWord={removeFatigueWord}
            />
          )}
          {tab === 'prefs' && (
            <PreferencesEditor data={data} onUpdate={updateStructured} />
          )}
          {tab === 'sources' && (
            <SourcesList
              sources={data.sources}
              onAdd={(v) => addItem('sources', v)}
              onRemove={(i) => removeItem('sources', i)}
            />
          )}
          {tab === 'uncertain' && (
            <UncertainList
              items={data.uncertain}
              onAdd={(v) => addItem('uncertain', v)}
              onRemove={(i) => removeItem('uncertain', i)}
            />
          )}
          {tab === 'directives' && (
            <div>
              <div className="sidebar-section-header" style={{ marginBottom: 8 }}>用户指令历史</div>
              {directives.length === 0 ? (
                <div className="text-dim" style={{ textAlign: 'center', marginTop: 40 }}>暂无指令</div>
              ) : (
                directives.map((d, i) => (
                  <div key={`${d.chapter}-${d.text}-${i}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: 12 }}>
                    <span className="text-accent mono">{d.chapter ? `#${d.chapter}` : '—'}</span>
                    <span className="text-dim" style={{ flex: 1, fontSize: 12 }}>{d.text}</span>
                    <span style={{ fontSize: 11, color: d.active !== false ? 'var(--color-success)' : 'var(--color-dim)' }}>
                      {d.active !== false ? '活跃' : '非活跃'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
