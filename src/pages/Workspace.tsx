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
    <div className="app-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 顶栏 */}
      <div className="top-bar"><TopBar bookName={book?.name} /></div>

      {/* 主体 */}
      <div className="main-body" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 导航侧栏（可折叠） */}
        {sidebarVisible && <BookNavSidebar bookId={id || ''} />}
        <div
          className="cursor-clickable"
          onClick={() => setSidebarVisible(!sidebarVisible)}
          style={{
            width: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRight: '1px solid var(--color-border)', cursor: 'pointer',
            fontSize: 10, color: 'var(--color-dim)', userSelect: 'none',
          }}
          title={sidebarVisible ? '隐藏侧栏' : '显示侧栏'}
        >
          {sidebarVisible ? '◀' : '▶'}
        </div>

        {/* 状态侧栏（原四画面左侧）*/}
        <div className="state-panel">
          {!isRunning && !isComplete && (
            <div style={{ marginBottom: 8 }}>
              <button
                onClick={handleResume}
                className="welcome-mode-btn active"
                style={{ width: '100%', fontSize: 12, padding: '6px 0', textAlign: 'center' }}
              >
                ▶️ {book?.completedCount ? '继续创作' : '开始创作'}
              </button>
            </div>
          )}
          {isRunning && (
            <div style={{ marginBottom: 8 }}>
              <button
                onClick={() => pauseWriting()}
                className="welcome-mode-btn"
                style={{
                  width: '100%', fontSize: 12, padding: '6px 0', textAlign: 'center',
                  borderColor: 'var(--color-error)', color: 'var(--color-error)',
                }}
              >
                ⏸ 暂停
              </button>
            </div>
          )}
          <StatusSidebar />
        </div>

        {/* 中央：事件流 + 实时输出 */}
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
