import { useState } from 'react'
import { useUIStore } from '@/stores/useAppStore'

const ROLES = [
  { key: '', label: '默认' }, { key: 'coordinator', label: '协调器' },
  { key: 'architect', label: '架构师' }, { key: 'writer', label: '写手' }, { key: 'editor', label: '编辑' },
]

const THINKING_LEVELS = [
  { key: 'off', label: '关闭' }, { key: 'low', label: '低' },
  { key: 'medium', label: '中' }, { key: 'high', label: '高' },
  { key: 'xhigh', label: '极高' }, { key: 'max', label: '最大' },
]

export default function ModelSwitchModal() {
  const toggleModelSwitch = useUIStore((s) => s.toggleModelSwitch)
  const [selectedRole, setSelectedRole] = useState('')
  const [provider, setProvider] = useState('openrouter')
  const [model, setModel] = useState('google/gemini-2.5-flash')
  const [thinking, setThinking] = useState('medium')

  return (
    <div className="modal-overlay" onClick={toggleModelSwitch}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 500 }}>
        <button className="modal-close" onClick={toggleModelSwitch}>✕</button>
        <div className="modal-title">模型切换</div>

        <div className="mb-16">
          <div className="sidebar-section-header mb-8">角色</div>
          <div className="flex-row flex-wrap" style={{ gap: 6 }}>
            {ROLES.map((r) => (
              <button key={r.key} className={`welcome-mode-btn text-xs ${selectedRole === r.key ? 'active' : ''}`}
                onClick={() => setSelectedRole(r.key)}>{r.label}</button>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <div className="sidebar-section-header mb-8">Provider</div>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}
            className="w-full text-sm mono" style={{ padding: '6px 8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}>
            <option value="openrouter">OpenRouter</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
            <option value="deepseek">DeepSeek</option>
            <option value="qwen">Qwen</option>
            <option value="ollama">Ollama (本地)</option>
          </select>
        </div>

        <div className="mb-12">
          <div className="sidebar-section-header mb-8">模型</div>
          <input type="text" value={model} onChange={(e) => setModel(e.target.value)}
            className="w-full text-sm mono" style={{ padding: '6px 8px', background: 'var(--color-surface-2)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)' }}
            placeholder="例如: google/gemini-2.5-flash" />
        </div>

        <div className="mb-16">
          <div className="sidebar-section-header mb-8">推理强度</div>
          <div className="flex-row flex-wrap gap-4">
            {THINKING_LEVELS.map((l) => (
              <button key={l.key} className={`welcome-mode-btn text-xs ${thinking === l.key ? 'active' : ''}`}
                onClick={() => setThinking(l.key)}>{l.label}</button>
            ))}
          </div>
        </div>

        <div className="text-dim text-xs mono">切换后自动保存到 ~/.ainovel/config.json · 按角色可分别设置不同模型</div>
      </div>
    </div>
  )
}
