import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { useBookId } from '@/hooks/useBookId'
import BackButton from '@/components/BackButton'

export default function Workspace() {
  const id = useBookId()
  const navigate = useNavigate()
  const mode = useAppStore(s => s.mode)
  const setMode = useAppStore(s => s.setMode)
  const showHelp = useAppStore(s => s.showHelp)
  const showDiagnostics = useAppStore(s => s.showDiagnostics)
  const showModelSwitch = useAppStore(s => s.showModelSwitch)
  const showCoCreate = useAppStore(s => s.showCoCreate)
  const showExport = useAppStore(s => s.showExport)
  const snapshot = useAppStore(s => s.snapshot)
  const resumeWriting = useAppStore(s => s.resumeWriting)
  const pauseWriting = useAppStore(s => s.pauseWriting)
  const refreshSnapshot = useAppStore(s => s.refreshSnapshot)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [book, setBook] = useState<{ name: string; completedCount: number } | null>(null)

  useEffect(() => {
    if (!id || !window.electronAPI) return
    window.electronAPI.listBooks().then((books: any[]) => {
      const b = books.find((x: any) => x.id === id)
      if (b) setBook(b)
    }).catch(() => {})
  }, [id])

  // 组件挂载时同步运行状态（处理跨页面导航后状态丢失）
  useEffect(() => {
    if (!window.electronAPI) return
    refreshSnapshot().then(() => {
      const snap = useAppStore.getState().snapshot
      if (snap.isRunning && mode !== 'running') {
        setMode('running')
      }
    })
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleResume = async () => {
    if (!id) return
    const ok = await resumeWriting(id)
    if (!ok) alert('恢复失败，请检查控制台错误信息')
  }

  const processAlive = snapshot.runtimeState === 'running'
  const isRunning = mode === 'running' || processAlive
  const isComplete = snapshot.phase === 'complete'

  return (
    <div className={`flex-row p-24 ${fullscreen ? '' : ''}`} style={{ height: '100vh', gap: fullscreen ? 0 : 24 }}>
      {!fullscreen && <BookNavSidebar bookId={id || ''} />}
      <div className="flex-1 flex-col overflow-hidden" style={{ gap: fullscreen ? 0 : 24 }}>
        {/* 顶栏 */}
        <div className="top-bar mb-8" style={{ padding: 0 }}>
          <div className="flex-row items-center gap-8">
            <TopBar bookName={book?.name} />
            <button className="welcome-mode-btn text-xs" onClick={() => setFullscreen(s => !s)}
              style={{ flexShrink: 0 }}>
              {fullscreen ? '⊞ 退出全屏' : '⊟ 全屏写作'}
            </button>
          </div>
        </div>

        {/* 主体内容 */}
        <div className="flex-1 flex-row overflow-hidden">
          {/* 状态侧栏 — 全屏时隐藏 */}
          {!fullscreen && (<>
          {!isRunning && !isComplete && (
            <div className="state-panel">
              <button onClick={handleResume} className="btn btn-primary btn-block mb-8">
                ▶️ {book?.completedCount ? '继续创作' : '开始创作'}
              </button>
              <StatusSidebar />
            </div>
          )}
          {isRunning && (
            <div className="state-panel">
              <button onClick={() => pauseWriting()} className="btn btn-danger btn-block mb-8">
                ⏸ 暂停
              </button>
              <StatusSidebar />
            </div>
          )}

          {/* 中央：事件流 + 实时输出 */}
          <div className="center-panel">
            <div className="event-panel"><EventFlow /></div>
            <div className="stream-panel"><StreamOutput /></div>
          </div>

          {/* 右侧详情 — 全屏时隐藏 */}
          {!fullscreen && <div className="detail-panel"><DetailPanel /></div>}
          </>)}
        </div>

        {/* 底部输入 */}
        <div className="bottom-bar mt-8" style={{ padding: 0 }}><InputBox /></div>
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
