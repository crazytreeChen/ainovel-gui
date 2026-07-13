import { useUIStore } from '@/stores/useAppStore'

const COMMANDS = [
  { cmd: '/help', desc: '查看命令列表', group: 'system' },
  { cmd: '/model [role]', desc: '切换默认或角色模型', group: 'system' },
  { cmd: '/diag', desc: '诊断小说创作健康度', group: 'analysis' },
  { cmd: '/import <path>', desc: '反推外部小说续写', group: 'writing' },
  { cmd: '/export [path]', desc: '导出已完成章节为 TXT/EPUB', group: 'writing' },
  { cmd: '/cocreate', desc: '暂停创作，共创规划后续阶段走向', group: 'writing' },
  { cmd: '/simulate', desc: '读取 ./simulate 生成或增量更新仿写画像', group: 'writing' },
  { cmd: '/importsim <file>', desc: '导入已有仿写画像', group: 'writing' },
  { cmd: '/clear', desc: '清空实时输出面板', group: 'system' },
]

interface HelpModalProps {
  onClose?: () => void
}

export default function HelpModal({ onClose }: HelpModalProps) {
  const toggleHelp = useUIStore((s) => s.toggleHelp)
  const handleClose = onClose || toggleHelp

  const groups = [...new Set(COMMANDS.map((c) => c.group))]

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 500 }}>
        <button className="modal-close" onClick={handleClose}>✕</button>
        <div className="modal-title">命令帮助</div>

        {groups.map((group) => (
          <div key={group} style={{ marginBottom: 16 }}>
            <div
              className="text-muted mono"
              style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' }}
            >
              {group}
            </div>
            {COMMANDS.filter((c) => c.group === group).map((cmd) => (
              <div key={cmd.cmd} style={{ display: 'flex', margin: '4px 0', fontSize: 13 }}>
                <span className="text-accent mono" style={{ minWidth: 160 }}>{cmd.cmd}</span>
                <span className="text-dim">{cmd.desc}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
