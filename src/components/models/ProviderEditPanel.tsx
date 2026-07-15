import type { ProviderItem } from '@/pages/ModelsPage'

interface ProviderEditPanelProps {
  item: ProviderItem
  enabled: string
  fetching: string | null
  presets: ProviderItem[]
  onUpdate: (key: string, field: string, value: any) => void
  onFetch: (key: string) => void
  onSetEnabled: (key: string) => void
  onRemoveCustom: (key: string) => void
}

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '6px 10px', fontSize: 12,
  background: 'var(--color-surface-2)', color: 'var(--color-text)',
  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-mono)', outline: 'none',
}

export default function ProviderEditPanel({
  item, enabled, fetching, presets,
  onUpdate, onFetch, onSetEnabled, onRemoveCustom,
}: ProviderEditPanelProps) {
  return (
    <div className="card border-bottom" style={{ borderColor: 'var(--color-accent)', padding: 16, marginBottom: 12 }}>
      <div className="flex-row items-center justify-between mb-12">
        {!presets.find(p => p.key === item.key) ? (
          <input
            value={item.name}
            onChange={e => onUpdate(item.key, 'name', e.target.value)}
            placeholder="显示名称"
            style={{ ...inputStyle, fontSize: 16, fontWeight: 'bold', color: 'var(--color-accent2)', maxWidth: 280 }}
          />
        ) : (
          <span className="text-lg" style={{ fontWeight: 'bold', color: 'var(--color-accent2)' }}>{item.name}</span>
        )}
        <div className="flex-row items-center gap-8">
          <span className="text-muted text-xs">启用:</span>
          <div onClick={() => onSetEnabled(item.key)}
            style={{ width: 16, height: 16, borderRadius: '50%', cursor: 'pointer',
              border: `2px solid ${enabled === item.key ? 'var(--color-accent)' : 'var(--color-dim)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {enabled === item.key && <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-accent)' }} />}
          </div>
        </div>
      </div>
      <div className="text-dim mono text-xs mb-8">{item.baseUrl}</div>

      <div className="flex-row gap-6 mb-8">
        <input value={item.apiKey} onChange={e => onUpdate(item.key, 'apiKey', e.target.value)}
          placeholder="API Key" type="password" style={inputStyle} />
        <button className="welcome-mode-btn btn-sm" onClick={() => onFetch(item.key)}
          disabled={fetching === item.key || !item.apiKey}>
          {fetching === item.key ? '获取中...' : '获取模型'}
        </button>
      </div>

      {item.models.length > 0 && (
        <div className="flex-row items-center gap-6 mb-8">
          <span className="text-muted text-xs" style={{ whiteSpace: 'nowrap' }}>选择模型:</span>
          <select value={item.selectedModel} onChange={e => onUpdate(item.key, 'selectedModel', e.target.value)}
            className="flex-1 text-sm mono" style={{ padding: '4px 8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
            <option value="">选择模型</option>
            {item.models.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}

      {!presets.find(p => p.key === item.key) && (
        <button className="welcome-mode-btn btn-sm mt-8" onClick={() => onRemoveCustom(item.key)} style={{ color: 'var(--color-error)' }}>
          删除此 Provider
        </button>
      )}
    </div>
  )
}
