import { useState, useEffect } from 'react'
import TopBar from '@/components/TopBar'
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
import { useBookId } from '@/hooks/useBookId'

export default function Workspace() {
  const id = useBookId()
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
  const [fullscreen, setFullscreen] = useState(false)

  // 同步运行状态
  useEffect(() => {
    if (!window.electronAPI) return
    refreshSnapshot().then(() => {
      const snap = useAppStore.getState().snapshot
      if (snap.isRunning && mode !== 'running') setMode('running')
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
    <div className="flex-row p-24" style={{ height: '100vh', gap: fullscreen ? 0 : 16 }}>
      {!fullscreen && <BookNavSidebar bookId={id || ''} />}
      <div className="flex-1 flex-col overflow-hidden" style={{ gap: 8 }}>

        {/* 顶栏 */}
        <TopBar bookName={snapshot.novelName} />

        {/* 控制栏 — 替代旧的 state-panel */}
        <div className="flex-row items-center gap-8 flex-shrink-0" style={{ padding: '4px 0', borderBottom: '1px solid var(--color-border)', minHeight: 32 }}>
          {!fullscreen && (
            <button className="welcome-mode-btn text-xs" onClick={() => setFullscreen(true)}>⊟ 全屏</button>
          )}
          {fullscreen && (
            <button className="welcome-mode-btn text-xs" onClick={() => setFullscreen(false)}>⊞ 退出全屏</button>
          )}
          {isRunning && (
            <button onClick={() => pauseWriting()} className="btn btn-danger btn-sm">⏸ 暂停</button>
          )}
          {!isRunning && !isComplete && (
            <button onClick={handleResume} className="btn btn-primary btn-sm">
              ▶️ {snapshot.completedCount ? '继续' : '开始'}
            </button>
          )}
          <span className="text-dim text-xs ml-auto mono">
            {snapshot.totalWordCount > 0 && `${snapshot.totalWordCount.toLocaleString()} 字`}
            {snapshot.totalWordCount > 0 && snapshot.completedCount > 0 && ' · '}
            {snapshot.completedCount > 0 && `${snapshot.completedCount} 章`}
          </span>
        </div>

        {/* 精简状态条 — 替代旧的 StateSidebar */}
        <div className="flex-row items-center gap-12 flex-shrink-0 text-xs" style={{ padding: '2px 0', minHeight: 22, color: 'var(--color-dim)' }}>
          <span className="mono">
            {snapshot.runtimeState === 'running' ? '● 运行中' : snapshot.runtimeState === 'paused' ? '⏸ 已暂停' : '○ 空闲'}
          </span>
          {snapshot.provider && <span>{snapshot.provider}/{snapshot.modelName || '-'}</span>}
          {snapshot.agents?.length > 0 && (
            <span>
              {snapshot.agents.filter(a => a.state !== 'idle').map(a => (a as any).displayName || a.name).join(' · ')}
            </span>
          )}
          {snapshot.pendingRewrites?.length > 0 && (
            <span style={{ color: 'var(--color-error)' }}>返工 [{snapshot.pendingRewrites.join(',')}]</span>
          )}
          <span className="ml-auto">
            {snapshot.contextPercent > 0 && `上下文 ${snapshot.contextPercent.toFixed(0)}%`}
          </span>
        </div>

        {/* 主体：2 列（中央 + 右侧详情） */}
        <div className="flex-1 flex-row overflow-hidden" style={{ gap: 12 }}>
          {/* 中央：事件流 + 实时输出 */}
          <div className="flex-1 flex-col overflow-hidden" style={{ gap: 4 }}>
            <div className="event-panel" style={{ flex: 3 }}><EventFlow /></div>
            <div className="stream-panel" style={{ flex: 5 }}><StreamOutput /></div>
          </div>

          {/* 右侧详情（含 StatusSidebar 全部内容） — 全屏时隐藏 */}
          {!fullscreen && (
            <div className="detail-panel">
              <DetailPanel />
            </div>
          )}
        </div>

        {/* 底部输入 */}
        <InputBox />
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
