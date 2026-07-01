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
    <div className="flex-row p-24" style={{ height: '100vh', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div className="flex-1 flex-col overflow-hidden" style={{ gap: 24 }}>
        {/* 顶栏 */}
        <div className="top-bar mb-8" style={{ padding: 0 }}><TopBar bookName={book?.name} /></div>

        {/* 主体内容 */}
        <div className="flex-1 flex-row overflow-hidden">
          {/* 状态侧栏 */}
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

          {/* 右侧详情 */}
          <div className="detail-panel"><DetailPanel /></div>
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
