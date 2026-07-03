interface PreferencesEditorProps {
  data: {
    stylePreferences: string
    tabooTopics: string[]
  }
  onUpdate: (updates: any) => void
}

export default function PreferencesEditor({ data, onUpdate }: PreferencesEditorProps) {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div className="sidebar-section-header mb-6">风格偏好</div>
        <textarea value={data.stylePreferences} onChange={e => onUpdate({ stylePreferences: e.target.value })}
          style={{ width: '100%', minHeight: 100, padding: 10, background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.6, resize: 'vertical' }}
          placeholder="描述你对写作风格的具体偏好、喜好和避免的写法..." />
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="sidebar-section-header mb-6">禁忌主题</div>
        <div className="text-dim" style={{ fontSize: 12, marginBottom: 4 }}>
          {data.tabooTopics?.length > 0 ? data.tabooTopics.join('、') : '（未设置）'}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <input id="taboo-input" placeholder="输入禁忌主题，回车添加" style={{ flex: 1, padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 12, outline: 'none' }}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const input = document.getElementById('taboo-input') as HTMLInputElement
                if (input?.value.trim()) {
                  onUpdate({ tabooTopics: [...(data.tabooTopics || []), input.value.trim()] })
                  input.value = ''
                }
              }
            }} />
        </div>
      </div>
    </div>
  )
}
