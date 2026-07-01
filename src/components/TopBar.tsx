import { useAppStore } from '@/stores/useAppStore'
import { STATUS_CONFIG } from '@/types'

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export default function TopBar() {
  const snapshot = useAppStore((s) => s.snapshot)
  const version = '0.1.0'

  const spinnerClass = snapshot.isRunning ? 'status-spinner' : ''

  const novelName = snapshot.novelName || '未定书名'

  // 左侧信息
  const leftParts: string[] = []
  if (version) leftParts.push(`ainovel-gui ${version}`)
  if (snapshot.provider) leftParts.push(snapshot.provider)
  if (snapshot.modelName) leftParts.push(snapshot.modelName)
  leftParts.push('v0.1.0')
  const leftText = leftParts.join(' · ')

  // 右侧状态
  const statusCfg = STATUS_CONFIG[snapshot.statusLabel] || STATUS_CONFIG.READY
  const spinnerChar = snapshot.isRunning
    ? SPINNER_FRAMES[Math.floor(Date.now() / 120) % SPINNER_FRAMES.length]
    : statusCfg.icon

  return (
    <div className="top-bar-inner">
      <div className="top-bar-left truncate">{leftText}</div>
      <div className="top-bar-center truncate">{novelName}</div>
      <div className="top-bar-right">
        <span className="status-badge" style={{ color: statusCfg.color }}>
          {snapshot.isRunning && (
            <span className={spinnerClass}>{spinnerChar}</span>
          )}
          {!snapshot.isRunning && <span>{spinnerChar}</span>}
          <span>{statusCfg.label}</span>
        </span>
      </div>
    </div>
  )
}
