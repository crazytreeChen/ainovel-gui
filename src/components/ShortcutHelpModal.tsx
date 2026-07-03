import { useUIStore } from '@/stores/useAppStore'

const SHORTCUTS = [
  { keys: 'Cmd/Ctrl + K', desc: '全局搜索', group: '导航' },
  { keys: 'Cmd/Ctrl + S', desc: '保存当前章节', group: '编辑' },
  { keys: 'Escape', desc: '关闭当前模态框/面板', group: '通用' },
  { keys: '?', desc: '打开快捷键帮助', group: '通用' },
  { keys: '↑ / ↓', desc: '选择搜索结果项', group: '搜索' },
  { keys: 'Enter', desc: '跳转到选中结果', group: '搜索' },
]

const GROUPS = [...new Set(SHORTCUTS.map(s => s.group))]

export default function ShortcutHelpModal() {
  const toggleHelp = useUIStore((s) => s.toggleHelp)

  return (
    <div className="modal-overlay" onClick={toggleHelp}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 420, maxWidth: 480 }}>
        <button className="modal-close" onClick={toggleHelp}>✕</button>
        <div className="modal-title">⌨️ 快捷键</div>
        {GROUPS.map(group => (
          <div key={group} style={{ marginBottom: 14 }}>
            <div className="text-muted mono text-xs fw-bold mb-8">{group}</div>
            {SHORTCUTS.filter(s => s.group === group).map(s => (
              <div key={s.keys} className="flex-row items-center gap-12" style={{ margin: '4px 0', fontSize: 13 }}>
                <kbd className="mono text-accent" style={{ minWidth: 150, padding: '2px 6px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', fontSize: 11, textAlign: 'center' }}>{s.keys}</kbd>
                <span className="text-dim">{s.desc}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
