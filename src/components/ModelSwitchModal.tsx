import { useState } from 'react'
import { useAppStore } from '@/stores/useAppStore'

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

export default function ModelSwitchModal() {
  const toggleModelSwitch = useAppStore((s) => s.toggleModelSwitch)
  const [selectedRole, setSelectedRole] = useState('')
  const [provider, setProvider] = useState('openrouter')
  const [model, setModel] = useState('google/gemini-2.5-flash')
  const [thinking, setThinking] = useState('medium')

  return (
    <div className="modal-overlay" onClick={toggleModelSwitch}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 500 }}>
        <button className="modal-close" onClick={toggleModelSwitch}>✕</button>
        <div className="modal-title">模型切换</div>

        {/* 角色选择 */}
        <div style={{ marginBottom: 16 }}>
          <div className="sidebar-section-header" style={{ marginBottom: 8 }}>角色</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {ROLES.map((r) => (
              <button
                key={r.key}
                className={`welcome-mode-btn ${selectedRole === r.key ? 'active' : ''}`}
                onClick={() => setSelectedRole(r.key)}
                style={{ fontSize: 11 }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Provider */}
        <div style={{ marginBottom: 12 }}>
          <div className="sidebar-section-header" style={{ marginBottom: 4 }}>Provider</div>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--color-surface-2)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: '6px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
            }}
          >
            <option value="openrouter">OpenRouter</option>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
            <option value="deepseek">DeepSeek</option>
            <option value="qwen">Qwen</option>
            <option value="ollama">Ollama (本地)</option>
          </select>
        </div>

        {/* Model */}
        <div style={{ marginBottom: 12 }}>
          <div className="sidebar-section-header" style={{ marginBottom: 4 }}>模型</div>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--color-surface-2)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: '6px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
            }}
            placeholder="例如: google/gemini-2.5-flash"
          />
        </div>

        {/* 推理强度 */}
        <div style={{ marginBottom: 16 }}>
          <div className="sidebar-section-header" style={{ marginBottom: 4 }}>推理强度</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {THINKING_LEVELS.map((l) => (
              <button
                key={l.key}
                className={`welcome-mode-btn ${thinking === l.key ? 'active' : ''}`}
                onClick={() => setThinking(l.key)}
                style={{ fontSize: 11 }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-dim" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          切换后自动保存到 ~/.ainovel/config.json · 按角色可分别设置不同模型
        </div>
      </div>
    </div>
  )
}
