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
  { key: 'coordinator', label: '协调器' },
  { key: 'architect', label: '架构师' },
  { key: 'writer', label: '写手' },
  { key: 'editor', label: '编辑' },
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
  const [imageProvider, setImageProvider] = useState('')
  const [imageModel, setImageModel] = useState('')
  const [imageFormat, setImageFormat] = useState('agnes')
  const [imageSaving, setImageSaving] = useState(false)
  const [imageSaveMsg, setImageSaveMsg] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (async () => {
      if (!window.electronAPI) return
      const cfg = await window.electronAPI.loadProviderConfig()
      if (!cfg) return
      if (cfg.providers) {
        setProviders(prev => prev.map(p => {
          const saved = cfg.providers[p.key]
          return saved ? {
            ...p,
            apiKey: saved.api_key || '',
            baseUrl: saved.base_url || p.baseUrl,
            models: saved.models || [],
            selectedModel: saved.model || p.selectedModel || '',
            // 预设保留中文显示名；若配置里有自定义 name 也允许覆盖
            name: saved.name || p.name,
          } : p
        }))
        const extra: ProviderItem[] = []
        for (const [k, v] of Object.entries(cfg.providers) as [string, ProviderConfig][]) {
          if (!PRESETS.find(p => p.key === k)) {
            // 显示名优先用保存的 name，绝不默认展示 custom-时间戳（除非用户真没起名）
            const displayName = (v.name && String(v.name).trim()) || (k.startsWith('custom-') ? '自定义 Provider' : k)
            extra.push({
              key: k,
              name: displayName,
              type: v.type || 'openai',
              baseUrl: v.base_url || '',
              apiKey: v.api_key || '',
              models: v.models || [],
              selectedModel: v.model || '',
            })
          }
        }
        setCustoms(extra)
      }
      if (cfg.provider) setEnabled(cfg.provider)
      if (cfg.image_provider) setImageProvider(cfg.image_provider)
      if (cfg.image_model) setImageModel(cfg.image_model)
      if (cfg.image_format) setImageFormat(cfg.image_format)
      // 角色分配：仅合法 role key
      if (cfg.roles && typeof cfg.roles === 'object') {
        const next: Record<string, { provider: string; model: string }> = {}
        for (const [k, v] of Object.entries(cfg.roles as Record<string, any>)) {
          if (!['coordinator', 'architect', 'writer', 'editor'].includes(k)) continue
          if (!v || typeof v !== 'object') continue
          next[k] = {
            provider: String(v.provider || ''),
            model: String(v.model || ''),
          }
        }
        setRoleAssign(next)
      }
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
    try {
      // 与磁盘合并，避免整包覆盖冲掉 reasoning/roles/其它字段
      const prev = (await window.electronAPI.loadProviderConfig()) || {}
      const all = [...providers, ...customs]
      const providersCfg: Record<string, any> = { ...(prev.providers || {}) }

      // 更新 UI 中有 key 的项；明确清空 key 的项从配置删除
      const uiKeys = new Set(all.map(p => p.key))
      for (const p of all) {
        if (!p.apiKey) {
          if (providersCfg[p.key]) delete providersCfg[p.key]
          continue
        }
        const entry: any = {
          ...(providersCfg[p.key] || {}),
          name: p.name,
          type: p.type,
          base_url: p.baseUrl,
          api_key: p.apiKey,
        }
        if (p.models.length > 0) entry.models = p.models
        if (p.selectedModel) entry.model = p.selectedModel
        providersCfg[p.key] = entry
      }

      // 自定义已从 UI 删除的，从配置移除（预设 key 无 key 时上面已删）
      for (const key of Object.keys(providersCfg)) {
        if (!uiKeys.has(key) && String(key).startsWith('custom-')) {
          delete providersCfg[key]
        }
      }

      const active = itemByKey(enabled)
      if (!enabled || !active?.apiKey) {
        setSaveMsg('请先选择并配置启用的 Provider')
        setSaving(false)
        return
      }

      const roles: Record<string, { provider?: string; model?: string }> = {}
      for (const [k, v] of Object.entries(roleAssign)) {
        if (!['coordinator', 'architect', 'writer', 'editor'].includes(k)) continue
        if (!v?.provider) continue
        roles[k] = { provider: v.provider, model: v.model || '' }
      }

      const config: Record<string, any> = {
        ...prev,
        provider: enabled,
        model: active.selectedModel || prev.model || '',
        reasoning_effort: prev.reasoning_effort || 'medium',
        providers: providersCfg,
      }
      if (Object.keys(roles).length > 0) config.roles = roles
      else delete config.roles
      delete config.role_models

      await window.electronAPI.saveProviderConfig(config)

      const { useBookStore } = await import('@/stores/useBookStore')
      const bookId = useBookStore.getState().activeBookId
      if (bookId && window.electronAPI.applyProviderToBook) {
        await window.electronAPI.applyProviderToBook(bookId)
      }

      setSaveMsg('已保存')
      setTimeout(() => setSaveMsg(''), 2500)
    } catch (e: any) {
      setSaveMsg(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  function removeCustom(key: string) {
    setCustoms(prev => prev.filter(p => p.key !== key))
    if (selected === key) setSelected(null)
    if (enabled === key) setEnabled('')
  }

  function addCustom() {
    if (!addUrl.trim()) return
    const name = addName.trim() || addUrl.replace(/^https?:\/\//, '').split('/')[0] || '自定义'
    // key 仅作内部 id；卡片显示始终用 name
    // 尽量用可读 slug，冲突时再追加时间戳
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff_-]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'custom'
    const used = new Set([...providers, ...customs].map(p => p.key))
    let key = slug
    if (used.has(key) || PRESETS.some(p => p.key === key)) {
      key = `${slug}-${Date.now()}`
    }
    setCustoms(prev => [...prev, {
      key,
      name,
      type: addType,
      baseUrl: addUrl.trim(),
      apiKey: addKey.trim(),
      models: [],
      selectedModel: '',
    }])
    setSelected(key)
    setShowAdd(false); setAddName(''); setAddUrl(''); setAddKey('')
  }

  async function handleSaveImageConfig() {
    if (!window.electronAPI) return
    setImageSaving(true); setImageSaveMsg('')
    await window.electronAPI.saveImageProviderConfig(imageProvider, imageModel, imageFormat)
    setImageSaveMsg('已保存')
    setImageSaving(false); setTimeout(() => setImageSaveMsg(''), 2500)
  }

  // 从当前 provider 获取模型列表（用于图片模型选择）
  const imageProviderModels = (() => {
    const item = itemByKey(imageProvider)
    return item?.models || []
  })()

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

        {/* ── 图片生成配置 ── */}
        <div className="card mb-12" style={{ borderColor: 'var(--color-accent2)' }}>
          <div className="sidebar-section-header text-sm mb-8">🖼️ 图片生成模型</div>
          <div className="text-dim text-xs mb-12">
            选择用于 AI 生成封面和角色头像的模型与接口格式。不同供应商的接口格式不同，请根据实际情况选择。
          </div>
          <div className="flex-row gap-8 items-end flex-wrap">
            <div className="flex-col" style={{ minWidth: 160 }}>
              <label className="text-muted text-xs mb-4 d-block">接口格式</label>
              <select value={imageFormat} onChange={e => setImageFormat(e.target.value)}
                className="text-sm" style={{ padding: '6px 8px', width: '100%' }}>
                <option value="agnes">Agnes AI / LiteLLM</option>
                <option value="openai">OpenAI 标准 (DALL·E)</option>
              </select>
            </div>
            <div className="flex-col" style={{ minWidth: 160 }}>
              <label className="text-muted text-xs mb-4 d-block">Provider</label>
              <select value={imageProvider} onChange={e => { setImageProvider(e.target.value); setImageModel('') }}
                className="text-sm" style={{ padding: '6px 8px', width: '100%' }}>
                <option value="">未选择</option>
                {allItems.filter(p => p.apiKey).map(p => (
                  <option key={p.key} value={p.key}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-col" style={{ minWidth: 220 }}>
              <label className="text-muted text-xs mb-4 d-block">图片模型</label>
              {imageProviderModels.length > 0 ? (
                <select value={imageModel} onChange={e => setImageModel(e.target.value)}
                  className="text-sm" style={{ padding: '6px 8px', width: '100%' }}>
                  <option value="">请选择模型</option>
                  {imageProviderModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input value={imageModel} onChange={e => setImageModel(e.target.value)}
                  placeholder="手动输入模型名（如 dall-e-3）"
                  className="input-field text-sm" style={{ padding: '6px 10px' }} />
              )}
            </div>
            <div className="flex-row items-center gap-8">
              {imageSaveMsg && <span className="text-success text-xs">{imageSaveMsg}</span>}
              <button className="welcome-mode-btn active text-sm" onClick={handleSaveImageConfig} disabled={imageSaving}>
                {imageSaving ? '保存中...' : '保存图片配置'}
              </button>
            </div>
          </div>
          {imageProvider && imageModel && (
            <div className="text-success text-xs mt-8">
              已配置：{itemByKey(imageProvider)?.name || imageProvider} / {imageModel}（{imageFormat === 'openai' ? 'OpenAI 标准' : 'Agnes AI'} 格式）
            </div>
          )}
        </div>

        <RoleAssignment roles={ROLES} allItems={allItems} enabled={enabled} roleAssign={roleAssign} onChange={(_en, roleKey, value) => { if (!roleKey) return; setRoleAssign(prev => { if (!value.provider) { const next = { ...prev }; delete next[roleKey]; return next }; return { ...prev, [roleKey]: value } }) }} />
      </div>
    </div>
  )
}
