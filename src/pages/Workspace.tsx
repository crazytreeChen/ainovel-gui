import { useState, useEffect } from 'react'
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
import BookNavSidebar from '@/components/BookNavSidebar'
import { useAppStore } from '@/stores/useAppStore'
import { showToast } from '@/components/Toast'

export default function Workspace() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const mode = useAppStore(s => s.mode)
  const showHelp = useAppStore(s => s.showHelp)
  const showDiagnostics = useAppStore(s => s.showDiagnostics)
  const showModelSwitch = useAppStore(s => s.showModelSwitch)
  const showCoCreate = useAppStore(s => s.showCoCreate)
  const showExport = useAppStore(s => s.showExport)
  const snapshot = useAppStore(s => s.snapshot)
  const resumeWriting = useAppStore(s => s.resumeWriting)
  const pauseWriting = useAppStore(s => s.pauseWriting)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [book, setBook] = useState<{ name: string; completedCount: number } | null>(null)

  useEffect(() => {
    if (!id || !window.electronAPI) return
    window.electronAPI.listBooks().then((books: any[]) => {
      const b = books.find((x: any) => x.id === id)
      if (b) setBook(b)
    }).catch(() => {})
  }, [id])

  const handleResume = async () => {
    if (!id) return
    console.log('resumeWriting called for bookId:', id)
    const ok = await resumeWriting(id)
    console.log('resumeWriting result:', ok)
    if (!ok) alert('恢复失败，请检查控制台错误信息')
  }

  const isRunning = mode === 'running'
  const isComplete = snapshot.phase === 'complete'

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 顶栏 */}
        <div className="top-bar" style={{ padding: 0, marginBottom: 8 }}><TopBar bookName={book?.name} /></div>

        {/* 主体内容 */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* 状态侧栏 */}
          {!isRunning && !isComplete && (
            <div style={{ marginBottom: 8, flexShrink: 0, width: '23%', minWidth: 240, borderRight: '1px solid var(--color-border)', paddingRight: 8, overflow: 'auto' }}>
              <button onClick={handleResume} className="welcome-mode-btn active"
                style={{ width: '100%', fontSize: 12, padding: '6px 0', textAlign: 'center', marginBottom: 8 }}>
                ▶️ {book?.completedCount ? '继续创作' : '开始创作'}
              </button>
              <StatusSidebar />
            </div>
          )}
          {isRunning && (
            <div style={{ flexShrink: 0, width: '23%', minWidth: 240, borderRight: '1px solid var(--color-border)', paddingRight: 8, overflow: 'auto' }}>
              <button onClick={() => pauseWriting()} className="welcome-mode-btn"
                style={{ width: '100%', fontSize: 12, padding: '6px 0', textAlign: 'center', borderColor: 'var(--color-error)', color: 'var(--color-error)', marginBottom: 8 }}>
                ⏸ 暂停
              </button>
              <StatusSidebar />
            </div>
          )}

          {/* 中央：事件流 + 实时输出 */}
          <div className="center-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 8px' }}>
            <div className="event-panel" style={{ flex: 4, overflow: 'auto', padding: 8, borderBottom: '1px solid var(--color-border)' }}>
              <EventFlow />
            </div>
            <div className="stream-panel" style={{ flex: 6, overflow: 'auto', padding: 8 }}>
              <StreamOutput />
            </div>
          </div>

          {/* 右侧详情 */}
          <div className="detail-panel" style={{ width: '27%', minWidth: 280, borderLeft: '1px solid var(--color-border)', paddingLeft: 8, overflow: 'auto' }}>
            <DetailPanel />
          </div>
        </div>

        {/* 底部输入 */}
        <div className="bottom-bar" style={{ padding: 0, marginTop: 8 }}><InputBox /></div>
      </div>

      {/* 模态框 */}
      {showHelp && <HelpModal />}
      {showDiagnostics && <DiagnosticsModal />}
      {showModelSwitch && <ModelSwitchModal />}
      {showCoCreate && <CoCreateModal />}
      {showExport && <ExportModal />}
    </div>
  )
}
