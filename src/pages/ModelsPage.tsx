import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ProviderEditPanel from '@/components/models/ProviderEditPanel'
import RoleAssignment from '@/components/models/RoleAssignment'

export type ProtocolType = 'openai' | 'anthropic'

export interface ProviderItem {
  key: string; name: string; type: ProtocolType
  baseUrl: string; apiKey: string; models: string[]; selectedModel: string
}

interface ProviderConfig {
  name?: string
  type?: ProtocolType
  base_url?: string
  api_key?: string
  models?: string[]
  model?: string
}

const PRESETS: ProviderItem[] = [
  { key: 'openai', name: 'OpenAI', type: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: '', models: [], selectedModel: '' },
  { key: 'anthropic', name: 'Anthropic', type: 'anthropic', baseUrl: 'https://api.anthropic.com', apiKey: '', models: [], selectedModel: '' },
  { key: 'openrouter', name: 'OpenRouter', type: 'openai', baseUrl: 'https://openrouter.ai/api/v1', apiKey: '', models: [], selectedModel: '' },
  { key: 'deepseek', name: 'DeepSeek', type: 'openai', baseUrl: 'https://api.deepseek.com', apiKey: '', models: [], selectedModel: '' },
  { key: 'gemini', name: 'Gemini', type: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', apiKey: '', models: [], selectedModel: '' },
  { key: 'qwen', name: 'Qwen（通义千问）', type: 'openai', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', apiKey: '', models: [], selectedModel: '' },
  { key: 'ollama', name: 'Ollama（本地）', type: 'openai', baseUrl: 'http://localhost:11434/v1', apiKey: '', models: [], selectedModel: '' },
]

const ROLES = [
  { key: '', label: '默认' }, { key: 'coordinator', label: '协调器' },
  { key: 'architect', label: '架构师' }, { key: 'writer', label: '写手' }, { key: 'editor', label: '编辑' },
]

const inputS: React.CSSProperties = {
  flex: 1, padding: '6px 10px', fontSize: 12,
  background: 'var(--color-surface-2)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-mono)', outline: 'none',
}

export default function ModelsPage() {
  const navigate = useNavigate()
  const [providers, setProviders] = useState<ProviderItem[]>([...PRESETS])
  const [customs, setCustoms] = useState<ProviderItem[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<string>('')
  const [fetching, setFetching] = useState<string | null>(null)
  const [fetchErr, setFetchErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addUrl, setAddUrl] = useState('')
  const [addKey, setAddKey] = useState('')
  const [addType, setAddType] = useState<ProtocolType>('openai')
  const [roleAssign, setRoleAssign] = useState<Record<string, { provider: string; model: string }>>({})
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (async () => {
      if (!window.electronAPI) return
      const cfg = await window.electronAPI.loadProviderConfig()
      if (!cfg) return
      if (cfg.providers) {
        setProviders(prev => prev.map(p => {
          const saved = cfg.providers[p.key]
          return saved ? { ...p, apiKey: saved.api_key || '', baseUrl: saved.base_url || p.baseUrl, models: saved.models || [] } : p
        }))
        const extra: ProviderItem[] = []
        for (const [k, v] of Object.entries(cfg.providers) as [string, ProviderConfig][]) {
          if (!PRESETS.find(p => p.key === k)) {
            extra.push({ key: k, name: v.name || k, type: v.type || 'openai', baseUrl: v.base_url || '', apiKey: v.api_key || '', models: v.models || [], selectedModel: v.model || '' })
          }
        }
        setCustoms(extra)
      }
      if (cfg.provider) setEnabled(cfg.provider)
    })()
  }, [])

  function itemByKey(key: string): ProviderItem | undefined {
    return [...providers, ...customs].find(p => p.key === key)
  }

  function updateItem(key: string, field: string, value: any) {
    setProviders(prev => prev.map(p => p.key === key ? { ...p, [field]: value } : p))
    setCustoms(prev => prev.map(p => p.key === key ? { ...p, [field]: value } : p))
  }

  function doFetch(key: string) {
    const item = itemByKey(key)
    if (!item || !item.apiKey || !window.electronAPI) return
    setFetching(key); setFetchErr('')
    window.electronAPI.fetchModels(item.baseUrl, item.apiKey, item.type).then(res => {
      if (res.error) { setFetchErr(`${item.name}: ${res.error}`) }
      else if (res.models) { updateItem(key, 'models', res.models); updateItem(key, 'selectedModel', res.models[0] || '') }
      setFetching(null)
    })
  }

  function handleSelect(key: string) {
    setSelected(selected === key ? null : key)
    setTimeout(() => { panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, 100)
  }

  async function handleSave() {
    if (!window.electronAPI) return
    setSaving(true); setSaveMsg('')
    const all = [...providers, ...customs]
    const providersCfg: Record<string, any> = {}
    for (const p of all) {
      if (!p.apiKey) continue
      const entry: any = { type: p.type, base_url: p.baseUrl, api_key: p.apiKey }
      if (p.models.length > 0) entry.models = p.models
      providersCfg[p.key] = entry
    }
    const active = itemByKey(enabled)
    const config: Record<string, any> = {
      provider: enabled, model: active?.selectedModel || '',
      reasoning_effort: 'medium', providers: providersCfg,
    }
    await window.electronAPI.saveProviderConfig(config)
    setSaveMsg('已保存')
    setSaving(false); setTimeout(() => setSaveMsg(''), 2500)
  }

  function removeCustom(key: string) {
    setCustoms(prev => prev.filter(p => p.key !== key))
    if (selected === key) setSelected(null)
    if (enabled === key) setEnabled('')
  }

  function addCustom() {
    if (!addUrl.trim()) return
    const key = 'custom-' + Date.now()
    const name = addName.trim() || addUrl.replace(/^https?:\/\//, '').split('/')[0] || '自定义'
    setCustoms(prev => [...prev, { key, name, type: addType, baseUrl: addUrl.trim(), apiKey: addKey.trim(), models: [], selectedModel: '' }])
    setSelected(key)
    setShowAdd(false); setAddName(''); setAddUrl(''); setAddKey('')
  }

  const allItems = [...providers, ...customs]
  const filtered = searchQuery
    ? allItems.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.models.some(m => m.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.key.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allItems

  return (
    <div className="p-24 flex-col" style={{ maxWidth: 800, margin: '0 auto', height: '100vh' }}>
      <div className="flex-row items-center gap-12 mb-12 flex-shrink-0">
        <button className="welcome-mode-btn" onClick={() => navigate('/settings')}>← 返回</button>
        <h2 className="mono text-accent m-0 text-lg">模型管理</h2>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索 Provider / 模型..."
          className="input-field text-xs" style={{ flex: 1, maxWidth: 240, padding: '4px 10px' }} />
        <div className="ml-auto flex-row items-center gap-8">
          {saveMsg && <span className="text-success text-sm">{saveMsg}</span>}
          <button className="welcome-mode-btn active text-sm" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      {fetchErr && <div className="text-error text-sm mb-8 flex-shrink-0">{fetchErr}</div>}

      <div className="flex-1 scroll-y" style={{ paddingRight: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
          {filtered.map(p => (
            <div key={p.key} className="card-sm" style={{ cursor: 'pointer', position: 'relative',
              background: selected === p.key ? 'var(--color-surface-2)' : 'var(--color-surface)',
              border: `1px solid ${selected === p.key ? 'var(--color-accent)' : 'var(--color-border)'}` }}
              onClick={() => handleSelect(p.key)}>
              <div className="flex-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div className="text-sm" style={{ fontWeight: 'bold', color: 'var(--color-accent2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.name}</div>
                <div onClick={e => { e.stopPropagation(); setEnabled(p.key) }}
                  style={{ width: 14, height: 14, borderRadius: '50%', flexShrink: 0, border: `2px solid ${enabled === p.key ? 'var(--color-accent)' : 'var(--color-dim)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  {enabled === p.key && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)' }} />}
                </div>
              </div>
              {enabled === p.key && <span className="text-xs text-accent">已启用</span>}
              <span className="text-xs tag-sm" style={{ background: p.type === 'openai' ? 'rgba(126,197,216,0.15)' : 'rgba(224,155,90,0.15)', color: p.type === 'openai' ? '#7ec5d8' : '#e09b5a' }}>{p.type}</span>
              {p.selectedModel && <div className="text-dim text-xs mt-4 truncate">{p.selectedModel}</div>}
            </div>
          ))}
        </div>

        {!showAdd ? (
          <button className="welcome-mode-btn w-full text-sm mb-12" onClick={() => setShowAdd(true)} style={{ padding: '8px 0' }}>
            + 自定义 Provider
          </button>
        ) : (
          <div className="card mb-12" style={{ borderColor: 'var(--color-accent)' }}>
            <div className="sidebar-section-header text-sm mb-8">自定义 Provider</div>
            <div className="flex-row gap-6 mb-8">
              <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="名称" style={inputS} />
              <input value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="Base URL" style={inputS} />
              <input value={addKey} onChange={e => setAddKey(e.target.value)} placeholder="API Key" style={{ ...inputS, maxWidth: 180 }} type="password" />
            </div>
            <div className="flex-row items-center gap-6">
              {(['openai', 'anthropic'] as ProtocolType[]).map(t => (
                <button key={t} className={`welcome-mode-btn ${addType === t ? 'active' : ''}`}
                  onClick={() => setAddType(t)} style={{ fontSize: 11, padding: '4px 10px' }}>{t === 'openai' ? 'OpenAI 协议' : 'Anthropic 协议'}</button>
              ))}
              <button className="welcome-mode-btn active ml-auto text-xs" onClick={addCustom}>添加</button>
              <button className="welcome-mode-btn text-xs" onClick={() => setShowAdd(false)}>取消</button>
            </div>
          </div>
        )}

        {selected && (() => {
          const item = itemByKey(selected)
          if (!item) return null
          return <div ref={panelRef}><ProviderEditPanel item={item} enabled={enabled} fetching={fetching} presets={PRESETS} onUpdate={updateItem} onFetch={doFetch} onSetEnabled={setEnabled} onRemoveCustom={removeCustom} /></div>
        })()}

        <RoleAssignment roles={ROLES} allItems={allItems} enabled={enabled} roleAssign={roleAssign} onChange={() => {}} />
      </div>
    </div>
  )
}
