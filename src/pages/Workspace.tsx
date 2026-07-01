import { useParams, useNavigate } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import StatusSidebar from '@/components/StatusSidebar'
import EventFlow from '@/components/EventFlow'
import StreamOutput from '@/components/StreamOutput'
import DetailPanel from '@/components/DetailPanel'
import InputBox from '@/components/InputBox'
import HelpModal from '@/components/HelpModal'
import DiagnosticsModal from '@/components/DiagnosticsModal'
import ModelSwitchModal from '@/components/ModelSwitchModal'
import CoCreateModal from '@/components/CoCreateModal'
import ExportModal from '@/components/ExportModal'
import { useAppStore } from '@/stores/useAppStore'

export default function Workspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const showHelp = useAppStore(s => s.showHelp)
  const showDiagnostics = useAppStore(s => s.showDiagnostics)
  const showModelSwitch = useAppStore(s => s.showModelSwitch)
  const showCoCreate = useAppStore(s => s.showCoCreate)
  const showExport = useAppStore(s => s.showExport)

  return (
    <div className="app-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏 */}
      <div className="top-bar"><TopBar /></div>

      {/* 主体 */}
      <div className="main-body" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左侧状态栏 */}
        <div className="state-panel"><StatusSidebar /></div>
        {/* 中央区域 */}
        <div className="center-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="event-panel" style={{ flex: 4, overflow: 'auto', padding: 8, borderBottom: '1px solid var(--color-border)' }}>
            <EventFlow />
          </div>
          <div className="stream-panel" style={{ flex: 6, overflow: 'auto', padding: 8 }}>
            <StreamOutput />
          </div>
        </div>
        {/* 右侧详情 */}
        <div className="detail-panel"><DetailPanel /></div>
      </div>

      {/* 底部输入 */}
      <div className="bottom-bar"><InputBox /></div>

      {/* 模态框 */}
      {showHelp && <HelpModal />}
      {showDiagnostics && <DiagnosticsModal />}
      {showModelSwitch && <ModelSwitchModal />}
      {showCoCreate && <CoCreateModal />}
      {showExport && <ExportModal />}
    </div>
  )
}
