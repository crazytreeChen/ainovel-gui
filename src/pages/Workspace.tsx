import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import StatusSidebar from '@/components/StatusSidebar'
import EventFlow from '@/components/EventFlow'
import StreamOutput from '@/components/StreamOutput'
import DetailPanel from '@/components/DetailPanel'
import InputBox from '@/components/InputBox'
import ExportModal from '@/components/ExportModal'
import BookNavSidebar from '@/components/BookNavSidebar'
import { useAppStore } from '@/stores/useAppStore'
import { useUIStore } from '@/stores/useUIStore'
import { useWritingStore } from '@/stores/useWritingStore'
import { useBookId } from '@/hooks/useBookId'
import { showToast } from '@/components/Toast'

export default function Workspace() {
  const id = useBookId()
  const [searchParams, setSearchParams] = useSearchParams()
  const pushModal = useUIStore(s => s.pushModal)
  const mode = useAppStore(s => s.mode)
  const setMode = useAppStore(s => s.setMode)
  const showExport = useAppStore(s => s.showExport)
  const snapshot = useAppStore(s => s.snapshot)
  const setActiveBookId = useAppStore(s => s.setActiveBookId)
  const resumeWriting = useWritingStore(s => s.resumeWriting)
  const pauseWriting = useWritingStore(s => s.pauseWriting)
  const stopWriting = useWritingStore(s => s.stopWriting)
  const confirmContinueWriting = useWritingStore(s => s.confirmContinueWriting)
  const refreshSnapshot = useAppStore(s => s.refreshSnapshot)
  const refreshEvents = useAppStore(s => s.refreshEvents)
  const refreshChapters = useAppStore(s => s.refreshChapters)
  const clearEvents = useAppStore(s => s.clearEvents)
  const clearStreamOutput = useWritingStore(s => s.clearStreamOutput)
  const [fullscreen, setFullscreen] = useState(false)
  const [showStatus, setShowStatus] = useState(false)
  const [resuming, setResuming] = useState(false)

  // ── 规划完成确认 ──
  const [planningComplete, setPlanningComplete] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // 监听规划完成事件
  useEffect(() => {
    if (!window.electronAPI) return
    const cleanup = window.electronAPI.onPlanningComplete((data) => {
      if (!id || data.bookId !== id) return
      setPlanningComplete(true)
      showToast('大纲/角色等规划数据已生成，请确认后继续创作', 'info')
    })
    return cleanup
  }, [id])

  const handleConfirmContinue = useCallback(async () => {
    if (!id || confirming) return
    setConfirming(true)
    try {
      const result = await confirmContinueWriting(id)
      if (result.ok) {
        setPlanningComplete(false)
        showToast('继续创作中...', 'success')
      }
      // 失败时 store 已 toast 真实错误
    } catch (e: any) {
      showToast('恢复创作失败: ' + e.message, 'error')
    }
    setConfirming(false)
  }, [id, confirming, confirmContinueWriting])

  const handleDecline = useCallback(async () => {
    setPlanningComplete(false)
    await stopWriting()
  }, [stopWriting])

  // 同步运行状态：切书时清空实时输出，并按当前 bookId 重载快照/事件/章节
  useEffect(() => {
    if (!id || !window.electronAPI) return
    setActiveBookId(id)
    clearStreamOutput()
    Promise.all([
      refreshSnapshot(),
      refreshEvents(),
      refreshChapters(),
    ]).then(() => {
      // 再次确认仍在同一本书
      if (useAppStore.getState().activeBookId !== id) return
      const snap = useAppStore.getState().snapshot
      if (snap.isRunning) setMode('running')
      else if (mode === 'running' || mode === 'welcome') setMode('idle')
    })
  }, [id, setActiveBookId, clearStreamOutput, refreshSnapshot, refreshEvents, refreshChapters, setMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // 新建书籍「共创规划」入口：?cocreate=1 时自动打开共创窗
  useEffect(() => {
    if (!id) return
    if (searchParams.get('cocreate') !== '1') return
    pushModal('coCreate')
    // 去掉 query，避免刷新重复弹窗
    const next = new URLSearchParams(searchParams)
    next.delete('cocreate')
    setSearchParams(next, { replace: true })
  }, [id, searchParams, setSearchParams, pushModal])

  const handleResume = async () => {
    if (!id || resuming) return
    setResuming(true)
    try {
      const result = await resumeWriting(id)
      // 失败时 store 已 toast 真实错误；成功再提示
      if (result.ok) showToast('创作已恢复', 'success')
    } finally {
      setResuming(false)
    }
  }

  const handleStop = async () => {
    await stopWriting()
    showToast('创作已停止', 'info')
  }

  const processAlive = snapshot.runtimeState === 'running'
  const isRunning = mode === 'running' || processAlive
  const isComplete = snapshot.phase === 'complete'

  return (
    <div className="workspace-container" style={{ gap: fullscreen ? 0 : 16 }}>
      {!fullscreen && <BookNavSidebar bookId={id || ''} />}
      <div className="workspace-main">

        {/* 顶栏 */}
        <TopBar bookName={snapshot.novelName} />

        {/* 控制栏 */}
        <div className="workspace-control-bar">
          {!fullscreen && (
            <button className="welcome-mode-btn text-xs" onClick={() => setFullscreen(true)}>⊟ 全屏</button>
          )}
          {fullscreen && (
            <button className="welcome-mode-btn text-xs" onClick={() => setFullscreen(false)}>⊞ 退出全屏</button>
          )}
          {isRunning && (
            <>
              <button onClick={() => pauseWriting()} className="btn btn-danger btn-sm">⏸ 暂停</button>
              <button onClick={handleStop} className="btn btn-danger btn-sm" title="完全停止引擎进程">⏹ 停止</button>
            </>
          )}
          {!isRunning && !isComplete && (
            <button onClick={handleResume} disabled={resuming} className="btn btn-primary btn-sm"
              style={{ opacity: resuming ? 0.6 : 1 }}>
              ▶️ {snapshot.completedCount ? '继续' : '开始'}
            </button>
          )}
          <button className="welcome-mode-btn text-xs" onClick={() => { clearEvents(); clearStreamOutput(); }}
            title="清空事件流和实时输出">✕ 清屏</button>
          <span className="text-dim text-xs ml-auto mono">
            {snapshot.totalWordCount > 0 && `${snapshot.totalWordCount.toLocaleString()} 字`}
            {snapshot.totalWordCount > 0 && snapshot.completedCount > 0 && ' · '}
            {snapshot.completedCount > 0 && `${snapshot.completedCount} 章`}
          </span>
        </div>

        {/* 精简状态条 */}
        <div className="workspace-status-bar">
          <span className="mono">
            {snapshot.runtimeState === 'running' ? '● 运行中' : snapshot.runtimeState === 'paused' ? '⏸ 已暂停' : '○ 空闲'}
          </span>
          <span className="mono" style={{ color: snapshot.flow === 'polishing' ? 'var(--color-accent)' : undefined }}>
            {snapshot.flow === 'writing' ? '写作中' : snapshot.flow === 'polishing' ? '打磨中' : snapshot.flow || ''}
          </span>
          {snapshot.provider && <span>{snapshot.provider}/{snapshot.modelName || '-'}</span>}
          {snapshot.agents?.length > 0 && (
            <span>
              {snapshot.agents.filter(a => a.state !== 'idle').map(a => (a as any).displayName || a.name).join(' · ')}
            </span>
          )}
          {snapshot.pendingRewrites?.length > 0 && (
            <span style={{ color: 'var(--color-error)' }}>待打磨 [{snapshot.pendingRewrites.join(',')}]</span>
          )}
          <span className="ml-auto">
            {snapshot.contextPercent > 0 && `上下文 ${snapshot.contextPercent.toFixed(0)}%`}
            {snapshot.contextPercent > 80 && <span className="text-error"> ⚠️ 接近上限</span>}
          </span>
          <button className={`welcome-mode-btn text-xs ${showStatus ? 'active' : ''}`}
            onClick={() => setShowStatus(s => !s)}>
            📊 详情
          </button>
        </div>

        {/* 可折叠状态面板 */}
        {showStatus && (
          <div className="flex-shrink-0" style={{ maxHeight: 300, overflow: 'auto', borderBottom: '1px solid var(--color-border)', marginBottom: 4 }}>
            <StatusSidebar />
          </div>
        )}

        {/* 主体：2 列（中央 + 右侧详情） */}
        <div className="workspace-content">
          {/* 中央：事件流 + 实时输出 */}
          <div className="workspace-center">
            <div className="event-panel" style={{ flex: 3 }}><EventFlow /></div>
            <div className="stream-panel" style={{ flex: 5 }}><StreamOutput /></div>
          </div>

          {/* 右侧详情（全屏时隐藏） */}
          {!fullscreen && (
            <div className="detail-panel">
              <DetailPanel />
            </div>
          )}
        </div>

        {/* 底部输入 */}
        <InputBox />
      </div>

      {/* ── 规划完成确认弹窗 ── */}
      {planningComplete && (
        <div className="modal-overlay" onClick={handleDecline}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 440, maxWidth: 520 }}>
            <div className="modal-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              📋 规划已完成
              <button className="modal-close" onClick={handleDecline} style={{ position: 'static' }}>✕</button>
            </div>

            <div className="mb-16 text-sm" style={{ lineHeight: 1.8 }}>
              <p>AI 已为作品生成以下规划数据：</p>
              <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
                <li><strong>书名</strong>：{snapshot.novelName || '—'}</li>
                <li><strong>大纲</strong>：{snapshot.totalChapters || '...'} 章规划</li>
                <li><strong>角色</strong>：{snapshot.characters?.length || '...'} 位</li>
                <li><strong>指南针</strong>：{snapshot.compassDirection || '—'}{snapshot.compassScale ? `（${snapshot.compassScale}）` : ''}</li>
              </ul>
              <p className="text-dim mt-12" style={{ fontSize: 12 }}>
                你可以通过左侧导航栏查看大纲、角色、时间线等详细信息。
                确认无误后，AI 将开始章节创作。
              </p>
            </div>

            <div className="flex-row gap-10" style={{ justifyContent: 'flex-end' }}>
              <button className="welcome-mode-btn" onClick={handleDecline}>
                🔍 再调整
              </button>
              <button className="welcome-mode-btn active" onClick={handleConfirmContinue} disabled={confirming}
                style={{ fontSize: 13, padding: '8px 24px', opacity: confirming ? 0.6 : 1 }}>
                {confirming ? '继续中...' : '✅ 确认，开始写作'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 模态框（ExportModal 需要 route params） */}
      {showExport && <ExportModal id={id || undefined} />}
    </div>
  )
}
