import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

type ProtocolType = 'openai' | 'anthropic'

interface ProviderItem {
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
      // 合并已保存配置到预制列表
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
    // 滚动到维护面板
    setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
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
      provider: enabled,
      model: active?.selectedModel || '',
      reasoning_effort: 'medium',
      providers: providersCfg,
    }
    await window.electronAPI.saveProviderConfig(config)
    setSaveMsg('已保存')
    setSaving(false); setTimeout(() => setSaveMsg(''), 2500)
  }

  // 删除自定义
  function removeCustom(key: string) {
    setCustoms(prev => prev.filter(p => p.key !== key))
    if (selected === key) setSelected(null)
    if (enabled === key) setEnabled('')
  }

  // 添加自定义
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
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexShrink: 0 }}>
        <button className="welcome-mode-btn" onClick={() => navigate('/settings')}>← 返回</button>
        <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>模型管理</h2>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="搜索 Provider / 模型..."
          style={{
            flex: 1, maxWidth: 240, padding: '4px 10px', fontSize: 12,
            background: 'var(--color-surface-2)', color: 'var(--color-text)',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
            fontFamily: 'var(--font-mono)', outline: 'none',
          }} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {saveMsg && <span className="text-success" style={{ fontSize: 12 }}>{saveMsg}</span>}
          <button className="welcome-mode-btn active" onClick={handleSave} disabled={saving} style={{ fontSize: 12 }}>
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      {fetchErr && <div className="text-error" style={{ fontSize: 12, marginBottom: 8, flexShrink: 0 }}>{fetchErr}</div>}

      <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
        {/* ── 卡片网格 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 12 }}>
          {filtered.map(p => (
            <div key={p.key} style={{
              background: selected === p.key ? 'var(--color-surface-2)' : 'var(--color-surface)',
              border: `1px solid ${selected === p.key ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: 'var(--radius)', padding: '10px 10px 6px',
              cursor: 'pointer', position: 'relative',
            }} onClick={() => handleSelect(p.key)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 12, fontWeight: 'bold', color: 'var(--color-accent2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.name}</div>
                {/* 启用 radio */}
                <div onClick={e => { e.stopPropagation(); setEnabled(p.key) }} style={{
                  width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${enabled === p.key ? 'var(--color-accent)' : 'var(--color-dim)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}>
                  {enabled === p.key && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)' }} />}
                </div>
              </div>
              {enabled === p.key && <span style={{ fontSize: 9, color: 'var(--color-accent)' }}>已启用</span>}
              <span style={{ fontSize: 8, padding: '0 3px', borderRadius: 2, background: p.type === 'openai' ? 'rgba(126,197,216,0.15)' : 'rgba(224,155,90,0.15)', color: p.type === 'openai' ? '#7ec5d8' : '#e09b5a', fontFamily: 'var(--font-mono)' }}>{p.type}</span>
              {p.selectedModel && <div className="text-dim" style={{ fontSize: 9, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.selectedModel}</div>}
            </div>
          ))}
        </div>

        {/* ── 自定义入口 ── */}
        {!showAdd ? (
          <button className="welcome-mode-btn" onClick={() => setShowAdd(true)} style={{ fontSize: 12, marginBottom: 12, width: '100%', padding: '8px 0' }}>
            + 自定义 Provider
          </button>
        ) : (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 12 }}>
            <div className="sidebar-section-header" style={{ fontSize: 12, marginBottom: 8 }}>自定义 Provider</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="名称" style={inputS} />
              <input value={addUrl} onChange={e => setAddUrl(e.target.value)} placeholder="Base URL" style={inputS} />
              <input value={addKey} onChange={e => setAddKey(e.target.value)} placeholder="API Key" style={{ ...inputS, maxWidth: 180 }} type="password" />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {(['openai', 'anthropic'] as ProtocolType[]).map(t => (
                <button key={t} className={`welcome-mode-btn ${addType === t ? 'active' : ''}`}
                  onClick={() => setAddType(t)} style={{ fontSize: 11, padding: '4px 10px' }}>{t === 'openai' ? 'OpenAI 协议' : 'Anthropic 协议'}</button>
              ))}
              <button className="welcome-mode-btn active" onClick={addCustom} style={{ fontSize: 11, marginLeft: 'auto' }}>添加</button>
              <button className="welcome-mode-btn" onClick={() => setShowAdd(false)} style={{ fontSize: 11 }}>取消</button>
            </div>
          </div>
        )}

        {/* ── 展开的维护面板 ── */}
        {selected && (() => {
          const item = itemByKey(selected)
          if (!item) return null
          return (
            <div ref={panelRef} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 'bold', fontSize: 15, color: 'var(--color-accent2)' }}>{item.name}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="text-muted" style={{ fontSize: 11 }}>启用:</span>
                  <div onClick={() => setEnabled(selected)} style={{
                    width: 16, height: 16, borderRadius: '50%', cursor: 'pointer',
                    border: `2px solid ${enabled === selected ? 'var(--color-accent)' : 'var(--color-dim)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {enabled === selected && <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-accent)' }} />}
                  </div>
                </div>
              </div>
              <div className="text-dim mono" style={{ fontSize: 11, marginBottom: 8 }}>{item.baseUrl}</div>
              {/* API Key */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input value={item.apiKey} onChange={e => updateItem(selected, 'apiKey', e.target.value)}
                  placeholder="API Key" type="password"
                  style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', outline: 'none' }} />
                <button className="welcome-mode-btn" onClick={() => doFetch(selected)} disabled={fetching === selected || !item.apiKey}
                  style={{ fontSize: 11, padding: '4px 14px', whiteSpace: 'nowrap' }}>
                  {fetching === selected ? '获取中...' : '获取模型'}
                </button>
              </div>
              {/* 模型选择 */}
              {item.models.length > 0 && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                  <span className="text-muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>选择模型:</span>
                  <select value={item.selectedModel} onChange={e => updateItem(selected, 'selectedModel', e.target.value)}
                    style={{ flex: 1, padding: '4px 8px', fontSize: 12, background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)' }}>
                    <option value="">选择模型</option>
                    {item.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              )}
              {/* 删除自定义 */}
              {!PRESETS.find(p => p.key === selected) && (
                <button className="welcome-mode-btn" onClick={() => removeCustom(selected)} style={{ fontSize: 11, color: 'var(--color-error)', marginTop: 4 }}>
                  删除此 Provider
                </button>
              )}
            </div>
          )
        })()}

        {/* ── 角色分配 ── */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 24 }}>
          <div className="sidebar-section-header" style={{ margin: 0, marginBottom: 8 }}>角色模型分配（可选）</div>
          {ROLES.map(role => {
            const activeProvider = itemByKey(enabled)
            const apiProviders = allItems.filter(p => p.apiKey)
            const roleKey = role.key || 'default'
            const currentVal = roleAssign[roleKey] || { provider: '', model: '' }
            const selectedProv = apiProviders.find(p => p.key === currentVal.provider)
            return (
              <div key={role.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--color-border)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                <span className="text-muted" style={{ minWidth: 50, fontWeight: 'bold' }}>{role.label}</span>
                <select value={currentVal.provider || ''} onChange={e => {
                  const v = e.target.value
                  setRoleAssign(r => ({ ...r, [roleKey]: v ? { provider: v, model: '' } : { provider: '', model: '' } }))
                }} style={{ flex: 1, padding: '2px 4px', fontSize: 11, background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                  <option value="">继承默认（{activeProvider?.name || '未启用'}）</option>
                  {apiProviders.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
                {selectedProv && selectedProv.models.length > 0 && (
                  <select value={currentVal.model} onChange={e => setRoleAssign(r => ({ ...r, [roleKey]: { ...currentVal, model: e.target.value } }))}
                    style={{ flex: 1, maxWidth: 180, padding: '2px 4px', fontSize: 11, background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                    <option value="">选择模型</option>
                    {selectedProv.models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const inputS: React.CSSProperties = {
  flex: 1, padding: '6px 10px', fontSize: 12,
  background: 'var(--color-surface-2)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-mono)', outline: 'none',
}
