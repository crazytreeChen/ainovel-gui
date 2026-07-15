import { useEffect, useMemo, useState } from 'react'
import { useUIStore, useBookStore } from '@/stores/useAppStore'

const ROLES = [
  { key: '', label: '默认' },
  { key: 'coordinator', label: '协调器' },
  { key: 'architect', label: '架构师' },
  { key: 'writer', label: '写手' },
  { key: 'editor', label: '编辑' },
]

const THINKING_LEVELS = [
  { key: 'off', label: '关闭' },
  { key: 'low', label: '低' },
  { key: 'medium', label: '中' },
  { key: 'high', label: '高' },
  { key: 'xhigh', label: '极高' },
  { key: 'max', label: '最大' },
]

const PRESET_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  deepseek: 'DeepSeek',
  gemini: 'Gemini',
  qwen: 'Qwen（通义千问）',
  ollama: 'Ollama（本地）',
}

interface ProviderOption {
  key: string
  name: string
  models: string[]
  model: string
  hasKey: boolean
}

interface ModelSwitchModalProps {
  onClose?: () => void
}

export default function ModelSwitchModal({ onClose }: ModelSwitchModalProps) {
  const toggleModelSwitch = useUIStore((s) => s.toggleModelSwitch)
  const addToast = useUIStore((s) => s.addToast)
  const handleClose = onClose || toggleModelSwitch

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [providers, setProviders] = useState<ProviderOption[]>([])
  const [rawConfig, setRawConfig] = useState<any>(null)
  const [selectedRole, setSelectedRole] = useState('')
  const [provider, setProvider] = useState('')
  const [model, setModel] = useState('')
  const [thinking, setThinking] = useState('medium')
  const [roleMap, setRoleMap] = useState<Record<string, { provider?: string; model?: string }>>({})

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!window.electronAPI?.loadProviderConfig) {
        setLoading(false)
        return
      }
      try {
        const cfg = await window.electronAPI.loadProviderConfig()
        if (cancelled) return
        setRawConfig(cfg || {})

        const list: ProviderOption[] = []
        const src = cfg?.providers || {}
        for (const [key, v] of Object.entries(src) as [string, any][]) {
          const name =
            (v?.name && String(v.name).trim()) ||
            PRESET_NAMES[key] ||
            (key.startsWith('custom-') ? '自定义 Provider' : key)
          list.push({
            key,
            name,
            models: Array.isArray(v?.models) ? v.models : [],
            model: String(v?.model || ''),
            hasKey: !!v?.api_key,
          })
        }
        // 有 key 的排前面；自定义也保留
        list.sort((a, b) => Number(b.hasKey) - Number(a.hasKey) || a.name.localeCompare(b.name, 'zh'))
        setProviders(list)

        const roles = cfg?.roles || cfg?.role_models || {}
        setRoleMap(typeof roles === 'object' && roles ? roles : {})

        const currentProvider = String(cfg?.provider || list.find((p) => p.hasKey)?.key || list[0]?.key || '')
        const currentModel =
          String(cfg?.model || '') ||
          list.find((p) => p.key === currentProvider)?.model ||
          list.find((p) => p.key === currentProvider)?.models?.[0] ||
          ''
        setProvider(currentProvider)
        setModel(currentModel)
        setThinking(String(cfg?.reasoning_effort || 'medium'))
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const current = useMemo(
    () => providers.find((p) => p.key === provider) || null,
    [providers, provider],
  )

  const modelOptions = current?.models || []

  function applyRole(roleKey: string) {
    setSelectedRole(roleKey)
    const mapKey = roleKey || 'default'
    const assigned = roleMap[mapKey] || roleMap[roleKey]
    if (assigned?.provider) {
      setProvider(assigned.provider)
      setModel(assigned.model || '')
      return
    }
    // 默认角色：用全局 provider/model
    if (!roleKey && rawConfig) {
      setProvider(String(rawConfig.provider || provider))
      setModel(String(rawConfig.model || model))
    }
  }

  function onProviderChange(key: string) {
    setProvider(key)
    const p = providers.find((x) => x.key === key)
    const nextModel = p?.model || p?.models?.[0] || ''
    setModel(nextModel)
  }

  async function handleSave() {
    if (!window.electronAPI?.saveProviderConfig) return
    if (!provider) {
      addToast?.({ id: Date.now(), message: '请选择 Provider', type: 'error' })
      return
    }
    setSaving(true)
    try {
      const cfg = { ...(rawConfig || {}) }
      if (!cfg.providers) cfg.providers = {}

      // 确保当前 provider 条目存在，并写入选中模型
      if (!cfg.providers[provider]) cfg.providers[provider] = {}
      cfg.providers[provider] = {
        ...cfg.providers[provider],
        model: model || cfg.providers[provider].model || '',
      }

      // CLI 只接受 coordinator/architect/writer/editor，禁止写入 default
      const VALID_ROLES = new Set(['coordinator', 'architect', 'writer', 'editor'])
      const prevRoles = { ...(cfg.roles || cfg.role_models || {}) }
      const nextRoleMap: Record<string, { provider?: string; model?: string }> = {}
      for (const [k, v] of Object.entries(prevRoles)) {
        if (VALID_ROLES.has(k)) nextRoleMap[k] = v as any
      }

      if (selectedRole && VALID_ROLES.has(selectedRole)) {
        // 按角色分配
        nextRoleMap[selectedRole] = { provider, model }
        cfg.roles = nextRoleMap
      } else {
        // 默认：只改全局 provider/model，不写 roles.default（CLI 会报错）
        cfg.provider = provider
        cfg.model = model
        cfg.reasoning_effort = thinking
        if (Object.keys(nextRoleMap).length > 0) cfg.roles = nextRoleMap
        else {
          delete cfg.roles
          delete cfg.role_models
        }
      }

      await window.electronAPI.saveProviderConfig(cfg)
      setRawConfig(cfg)
      setRoleMap(nextRoleMap)

      // 同步到当前打开的书籍（run_meta + run.json），避免点开始又回到旧模型
      try {
        const bookId = useBookStore.getState().activeBookId
        if (bookId && window.electronAPI.applyProviderToBook) {
          await window.electronAPI.applyProviderToBook(bookId)
        }
      } catch {}

      // 立刻更新顶栏/侧栏展示（覆盖旧 run_meta 残留）
      try {
        const displayName = current?.name || provider
        await useBookStore.getState().refreshSnapshot()
        const prev = useBookStore.getState().snapshot
        useBookStore.setState({
          snapshot: {
            ...prev,
            provider: displayName,
            modelName: model || prev.modelName || '',
          },
        })
      } catch {}

      addToast?.({
        id: Date.now(),
        message: selectedRole
          ? `已保存角色「${ROLES.find((r) => r.key === selectedRole)?.label || selectedRole}」模型`
          : `已切换到 ${current?.name || provider} / ${model || '未选模型'}`,
        type: 'success',
      })
      handleClose()
    } catch (e: any) {
      addToast?.({ id: Date.now(), message: e?.message || '保存失败', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 520 }}>
        <button className="modal-close" onClick={handleClose}>✕</button>
        <div className="modal-title">模型切换</div>

        {loading ? (
          <div className="text-dim text-sm">加载配置中…</div>
        ) : (
          <>
            <div className="mb-16">
              <div className="sidebar-section-header mb-8">角色</div>
              <div className="flex-row flex-wrap" style={{ gap: 6 }}>
                {ROLES.map((r) => (
                  <button
                    key={r.key}
                    className={`welcome-mode-btn text-xs ${selectedRole === r.key ? 'active' : ''}`}
                    onClick={() => applyRole(r.key)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-12">
              <div className="sidebar-section-header mb-8">Provider</div>
              <select
                value={provider}
                onChange={(e) => onProviderChange(e.target.value)}
                className="w-full text-sm mono"
                style={{
                  padding: '6px 8px',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                }}
              >
                {providers.length === 0 && <option value="">暂无已配置 Provider</option>}
                {providers.map((p) => (
                  <option key={p.key} value={p.key} disabled={!p.hasKey}>
                    {p.name}{p.hasKey ? '' : '（未填 API Key）'}
                  </option>
                ))}
              </select>
              {current && (
                <div className="text-dim text-xs mt-4 mono">id: {current.key}</div>
              )}
            </div>

            <div className="mb-12">
              <div className="sidebar-section-header mb-8">模型</div>
              {modelOptions.length > 0 ? (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full text-sm mono"
                  style={{
                    padding: '6px 8px',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <option value="">选择模型</option>
                  {modelOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full text-sm mono"
                  style={{
                    padding: '6px 8px',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                  }}
                  placeholder="手动输入模型名，如 deepseek-v4-flash-free"
                />
              )}
            </div>

            {!selectedRole && (
              <div className="mb-16">
                <div className="sidebar-section-header mb-8">推理强度</div>
                <div className="flex-row flex-wrap gap-4">
                  {THINKING_LEVELS.map((l) => (
                    <button
                      key={l.key}
                      className={`welcome-mode-btn text-xs ${thinking === l.key ? 'active' : ''}`}
                      onClick={() => setThinking(l.key)}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-row gap-8 items-center">
              <button className="welcome-mode-btn active" onClick={() => void handleSave()} disabled={saving || !provider}>
                {saving ? '保存中…' : '保存并切换'}
              </button>
              <button className="welcome-mode-btn" onClick={handleClose}>取消</button>
            </div>
            <div className="text-dim text-xs mono mt-12">
              列表来自模型管理已保存配置（含自定义 Provider）· 按角色可分别设置
            </div>
          </>
        )}
      </div>
    </div>
  )
}
