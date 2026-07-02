import type { ProviderItem } from '@/pages/ModelsPage'

interface RoleAssignmentProps {
  roles: { key: string; label: string }[]
  allItems: ProviderItem[]
  enabled: string
  roleAssign: Record<string, { provider: string; model: string }>
  onChange: (key: string, roleKey: string, value: { provider: string; model: string }) => void
}

export default function RoleAssignment({ roles, allItems, enabled, roleAssign, onChange }: RoleAssignmentProps) {
  const activeProvider = allItems.find(p => p.key === enabled)
  const apiProviders = allItems.filter(p => p.apiKey)

  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 24 }}>
      <div className="sidebar-section-header" style={{ margin: 0, marginBottom: 8 }}>角色模型分配（可选）</div>
      {roles.map(role => {
        const roleKey = role.key || 'default'
        const currentVal = roleAssign[roleKey] || { provider: '', model: '' }
        const selectedProv = apiProviders.find(p => p.key === currentVal.provider)
        return (
          <div key={role.key} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--color-border)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
            <span className="text-muted" style={{ minWidth: 50, fontWeight: 'bold' }}>{role.label}</span>
            <select value={currentVal.provider || ''} onChange={e => {
              const v = e.target.value
              onChange(enabled, roleKey, v ? { provider: v, model: '' } : { provider: '', model: '' })
            }} style={{ flex: 1, padding: '2px 4px', fontSize: 11, background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
              <option value="">继承默认（{activeProvider?.name || '未启用'}）</option>
              {apiProviders.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
            </select>
            {selectedProv && selectedProv.models.length > 0 && (
              <select value={currentVal.model} onChange={e => onChange(enabled, roleKey, { ...currentVal, model: e.target.value })}
                style={{ flex: 1, maxWidth: 180, padding: '2px 4px', fontSize: 11, background: 'var(--color-surface-2)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}>
                <option value="">选择模型</option>
                {selectedProv.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            )}
          </div>
        )
      })}
    </div>
  )
}
