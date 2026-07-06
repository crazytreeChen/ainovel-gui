import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import BookCover from '@/components/BookCover'
import { getPhaseLabel } from '@/lib/utils/phaseLabel'
import { useBookId } from '@/hooks/useBookId'
import BackButton from '@/components/BackButton'
import { confirmAction } from '@/components/ConfirmModal'
import { showToast } from '@/components/Toast'

const PAGE_SIZE = 60

export default function BookIntroPage() {
  const id = useBookId()
  const navigate = useNavigate()
  const [book, setBook] = useState<any>(null)
  const [chapters, setChapters] = useState<{ num: number; title: string; wordCount: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [cleaning, setCleaning] = useState(false)
  const [auditing, setAuditing] = useState(false)
  const [auditStep, setAuditStep] = useState<'idle' | 'choose' | 'running' | 'done'>('idle')
  const [auditProgress, setAuditProgress] = useState<{ current: number; total: number; chapter: number; elapsed: number; remaining: number } | null>(null)
  const [auditResult, setAuditResult] = useState<any>(null)
  const [auditStartCh, setAuditStartCh] = useState('')
  const [auditEndCh, setAuditEndCh] = useState('')

  useEffect(() => {
    if (!id || !window.electronAPI) return
    Promise.all([
      window.electronAPI.listBooks(),
      window.electronAPI.getBookChapters(id),
    ]).then(([books, chs]) => {
      const b = books.find((x: any) => x.id === id)
      if (b) setBook(b)
      setChapters(chs || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  async function handleBatchCleanTitles() {
    if (!id || !window.electronAPI || cleaning) return
    const preview = await window.electronAPI.previewCleanTitles(id)
    if (preview.error) {
      showToast(`清洗预览失败: ${preview.error}`, 'error')
      return
    }
    if (preview.changes.length === 0) {
      showToast('没有需要清洗的标题', 'info')
      return
    }
    const sample = preview.changes.slice(0, 12).map(change => (
      `#${change.chapter} ${change.oldTitle} -> ${change.newTitle}`
    ))
    if (preview.changes.length > sample.length) sample.push(`...另有 ${preview.changes.length - sample.length} 章`)
    const confirmed = await confirmAction({
      title: '确认清洗章节标题',
      message: `将更新 ${preview.changes.length}/${preview.total} 章标题。此操作会写入数据库和章节文件。`,
      confirmText: '开始清洗',
      details: sample,
    })
    if (!confirmed) return
    setCleaning(true)
    try {
      const result = await window.electronAPI.batchCleanTitles(id)
      if (result.error) showToast(`清洗失败: ${result.error}`, 'error')
      else showToast(`清洗完成：${result.cleaned}/${result.total} 章标题已更新`, 'success')
      const chs = await window.electronAPI.getBookChapters(id)
      setChapters(chs || [])
    } catch (e: any) {
      showToast('清洗失败: ' + (e.message || e), 'error')
    }
    setCleaning(false)
  }

  async function handleAuditBook() {
    if (!id || !window.electronAPI || auditing) return
    setAuditStep('choose')
    setAuditResult(null)
    setAuditProgress(null)
  }

  async function startAudit(apply: boolean, force: boolean = false) {
    if (!id || !window.electronAPI) return
    setAuditing(true)
    setAuditStep('running')
    setAuditResult(null)
    const chStart = parseInt(auditStartCh) || 0
    const chEnd = parseInt(auditEndCh) || 0
    const cleanup = window.electronAPI.onAuditProgress((data) => {
      setAuditProgress(data)
    })
    try {
      const result = await window.electronAPI.batchAuditBook(id, apply, chStart, chEnd, force)
      cleanup()
      if (!result.success) {
        showToast('审查失败: ' + (result.error || '未知错误'), 'error')
      } else {
        setAuditResult(result)
        setAuditStep('done')
        showToast('全书审查完成，修复建议已保存', 'success')
      }
      const chs = await window.electronAPI.getBookChapters(id)
      setChapters(chs || [])
    } catch (e: any) {
      cleanup()
      showToast('审查失败: ' + (e.message || e), 'error')
    }
    setAuditing(false)
  }

  async function handleApplyFixes() {
    if (!id || !window.electronAPI || !auditResult) return
    const titleCount = auditResult.stats?.titleUpdated || 0
    const contentCount = auditResult.stats?.contentCorrected || 0
    const candidates = auditResult.results
      ?.filter((item: any) => item.newTitle || item.applied?.includes('content_corrected'))
      ?.slice(0, 12)
      ?.map((item: any) => item.newTitle
        ? `#${item.chapter} 标题: ${item.oldTitle} -> ${item.newTitle}`
        : `#${item.chapter} 正文修正`) || []
    const confirmed = await confirmAction({
      title: '确认应用审查修复',
      message: `将根据已保存的审查结果应用修复：标题 ${titleCount} 章，正文 ${contentCount} 章。`,
      confirmText: '应用修复',
      details: candidates,
    })
    if (!confirmed) return
    try {
      const result = await window.electronAPI.batchApplyFixes(id)
      if (!result.success) {
        showToast('应用修复失败: ' + (result.error || '未知错误'), 'error')
      } else {
        showToast(`修复完成：标题更新 ${result.titleUpdated} 章，正文修正 ${result.contentFixed} 章`, 'success')
        const chs = await window.electronAPI.getBookChapters(id)
        setChapters(chs || [])
        setAuditResult((prev: any) => prev ? { ...prev, stats: { ...prev.stats, fixApplied: true } } : prev)
      }
    } catch (e: any) {
      showToast('应用修复失败: ' + (e.message || e), 'error')
    }
  }

  async function handleCancelAudit() {
    if (window.electronAPI) {
      const ok = await window.electronAPI.cancelAudit()
      showToast(ok ? '已请求停止审查' : '停止审查失败', ok ? 'info' : 'error')
      setAuditStep('idle')
    }
  }

  function formatTime(seconds: number): string {
    if (seconds < 60) return `${seconds}秒`
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}分${s}秒`
  }

  const totalPages = Math.ceil(chapters.length / PAGE_SIZE)
  const start = (page - 1) * PAGE_SIZE
  const pageChapters = chapters.slice(start, start + PAGE_SIZE)

  if (loading) return <div className="text-dim p-32">加载中...</div>

  return (
    <div className="flex-row p-24" style={{ height: '100vh', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div className="flex-1 flex-col overflow-hidden">
        <div className="flex-row items-center gap-12 mb-16 flex-shrink-0">
          <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}/workspace?mode=writing`)}>← 工作台</button>
          <h2 className="mono text-accent m-0 text-lg">书籍简介</h2>
        </div>

        {book && (
          <div className="card flex-row gap-16 mb-16 flex-shrink-0" style={{ padding: 16 }}>
            <BookCover bookId={id || ''} size="medium" />
            <div className="flex-1">
              <div className="text-lg" style={{ fontWeight: 'bold', color: 'var(--color-text)', marginBottom: 4 }}>{book.name}</div>
              <div className="text-dim text-xs mono" style={{ lineHeight: 1.8 }}>
                <div>{getPhaseLabel(book.phase)} · {book.completedCount || 0} 章 · {(book.totalWordCount || 0).toLocaleString()} 字 · 风格: {book.style || 'default'}</div>
              </div>
              <div className="flex-row flex-wrap mt-8" style={{ gap: 6 }}>
                <button className="welcome-mode-btn active" onClick={() => navigate(`/books/${id}/workspace?mode=writing`)}>✍️ 开始创作</button>
                <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}/outline`)}>📋 大纲</button>
                <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}/characters`)}>👤 角色</button>
                <button className="welcome-mode-btn" onClick={() => navigate('/settings/models')}>⚙️ 模型</button>
                <button className="welcome-mode-btn" onClick={handleBatchCleanTitles} disabled={cleaning || auditing} style={{ borderColor: 'var(--color-accent)' }}>
                  {cleaning ? '⏳ 清洗中...' : auditing ? '审查中...' : '🧹 清洗标题'}
                </button>
                <button className="welcome-mode-btn" onClick={handleAuditBook} disabled={auditing || auditStep !== 'idle'} style={{ borderColor: 'var(--color-success)' }}>
                  {auditing || auditStep !== 'idle' ? '⏳ 审查中...' : '🔍 全书审查'}
                </button>
                {auditStep === 'running' && (
                  <div className="flex-row items-center gap-6 ml-auto mono text-xs" style={{ minWidth: 220 }}>
                    {auditProgress ? (
                      <>
                    <span className="text-dim">{auditProgress.current}/{auditProgress.total}</span>
                    <div className="flex-1" style={{ maxWidth: 100, height: 4, background: 'var(--color-surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        width: `${(auditProgress.current / auditProgress.total) * 100}%`,
                        height: '100%', background: 'var(--color-accent)',
                        borderRadius: 2, transition: 'width 0.5s',
                      }} />
                    </div>
                    <span className="text-dim">{Math.round((auditProgress.current / auditProgress.total) * 100)}%</span>
                    <span className="text-dim">{formatTime(auditProgress.elapsed)}</span>
                      </>
                    ) : (
                      <span className="text-dim">准备中...</span>
                    )}
                    <button className="welcome-mode-btn" onClick={handleCancelAudit}
                      style={{ padding: '1px 8px', fontSize: 10, borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
                      停止
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 scroll-y">
          <div className="sidebar-section-header text-sm mb-8">章节列表 ({chapters.length} 章)</div>

          {chapters.length === 0 ? (
            <div className="text-dim text-center p-32">暂无章节，进入工作台开始创作</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
                {pageChapters.map(ch => (
                  <div key={ch.num} className="cursor-clickable card-sm flex-row items-center gap-6 mono text-sm"
                    onClick={() => navigate(`/books/${id}/chapters/${ch.num}`)}>
                    <span className="text-accent" style={{ fontWeight: 'bold', minWidth: 28, flexShrink: 0 }}>#{ch.num}</span>
                    <span className="flex-1 truncate" style={{ color: 'var(--color-text)' }}>{ch.title}</span>
                    <span className="text-dim text-xs flex-shrink-0">{ch.wordCount.toLocaleString()}字</span>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex-row items-center justify-center gap-8 mt-12 p-8 flex-shrink-0">
                  <button className="welcome-mode-btn btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                    ← 上一页
                  </button>
                  <div className="text-dim mono text-sm">{page} / {totalPages}</div>
                  <button className="welcome-mode-btn btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    下一页 →
                  </button>
                  <span className="text-xs ml-8">
                    <select value={page} onChange={e => setPage(parseInt(e.target.value))}>
                      {Array.from({ length: totalPages }, (_, i) => (
                        <option key={i + 1} value={i + 1}>第{i + 1}页</option>
                      ))}
                    </select>
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 全书审查模态框 */}
      {auditStep === 'choose' && (
        <div className="modal-overlay" onClick={() => setAuditStep('idle')}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 420, maxWidth: 480 }}>
            <button className="modal-close" onClick={() => setAuditStep('idle')}>✕</button>
            <div className="modal-title">🔍 全书审查</div>
            <div className="mb-12 text-sm" style={{ lineHeight: 1.8 }}>
              <p>逐章检查以下 9 个维度：</p>
              <p className="text-dim text-xs">
                标题质量 · AI 味 · 节奏结构 · 大纲对齐 · 字数合规<br/>
                角色连续性（含死而复生） · 时间线连贯 · 线索管理 · 内容跨度
              </p>
              <div className="flex-row items-center gap-8 mt-8">
                <span className="text-dim text-xs">章节范围：</span>
                <input className="input-field mono text-xs" style={{ width: 60, padding: '2px 6px' }}
                  placeholder="起始" value={auditStartCh}
                  onChange={e => setAuditStartCh(e.target.value.replace(/\D/g, ''))} />
                <span className="text-dim text-xs">—</span>
                <input className="input-field mono text-xs" style={{ width: 60, padding: '2px 6px' }}
                  placeholder="结束" value={auditEndCh}
                  onChange={e => setAuditEndCh(e.target.value.replace(/\D/g, ''))} />
                <span className="text-dim text-xs">（留空=全部）</span>
              </div>
              <p className="text-dim text-xs mt-8">
                每章约 10-15 秒 · {chapters.length} 章预计约 {formatTime(chapters.length * 12)}
              </p>
              <p className="text-dim text-xs">
                预估消耗 ~{(chapters.length * 800).toLocaleString()} tokens (~${((chapters.length * 800 * 0.000002)).toFixed(4)})
              </p>
            </div>
            <div className="flex-row gap-8" style={{ justifyContent: 'flex-end' }}>
              <button className="welcome-mode-btn" onClick={() => setAuditStep('idle')}>取消</button>
              <button className="welcome-mode-btn active" onClick={() => startAudit(false, true)}
                style={{ background: 'var(--color-accent)', color: '#fff', border: '1px solid var(--color-accent)' }}>
                🔍 开始审查
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 审查报告 */}
      {auditStep === 'done' && auditResult && (
        <div className="modal-overlay" onClick={() => setAuditStep('idle')}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 440, maxWidth: 520, maxHeight: '80vh', overflow: 'auto' }}>
            <button className="modal-close" onClick={() => setAuditStep('idle')}>✕</button>
            <div className="modal-title">📊 全书审查报告</div>
            {(() => {
              const s = auditResult.stats
              return (
                <div className="text-sm" style={{ lineHeight: 1.8 }}>
                  <p className="text-dim">已审 {s.reviewed}/{auditResult.total} 章{s.skipped ? `（${s.skipped} 章跳过）` : ''}</p>
                  <div className="sidebar-section-header mt-12 mb-4">📈 平均分</div>
                  <div className="mono text-xs" style={{ columns: 2, columnGap: 16 }}>
                    <div>标题质量: {s.avgTitleScore}/10</div>
                    <div>AI 味: {s.avgAiFlavorScore}/10</div>
                    <div>节奏结构: {s.avgPacingScore}/10</div>
                    <div>大纲对齐: {s.avgOutlineScore}/10</div>
                    <div>角色连续性: {s.avgCharContinuityScore}/10</div>
                    <div>时间线连贯: {s.avgTimelineScore}/10</div>
                    <div>线索管理: {s.avgPlotThreadScore}/10</div>
                  </div>
                  {s.contentCorrected || s.titleUpdated || s.needsRewrite || s.needsTrimming || s.totalMissingIntros || s.totalCharStateInconsistencies || s.totalTimelineGaps || s.totalDroppedThreads || s.errors ? (
                    <>
                      <div className="sidebar-section-header mt-12 mb-4">🛠 可应用修复与风险</div>
                      <div className="text-xs">
                        {s.contentCorrected ? <div>📝 正文可修正: {s.contentCorrected} 章</div> : null}
                        {s.titleUpdated ? <div>✅ 标题可更新: {s.titleUpdated} 章</div> : null}
                        {s.needsRewrite ? <div>⚠️ 建议重写: {s.needsRewrite} 章</div> : null}
                        {s.needsTrimming ? <div>✂️ 建议删减: {s.needsTrimming} 章</div> : null}
                        {s.totalMissingIntros ? <div>👤 缺角色交代: {s.totalMissingIntros} 处</div> : null}
                        {s.totalCharStateInconsistencies ? <div>☠️ 状态冲突: {s.totalCharStateInconsistencies} 处</div> : null}
                        {s.totalTimelineGaps ? <div>⏱ 时间线跳跃: {s.totalTimelineGaps} 处</div> : null}
                        {s.totalDroppedThreads ? <div>🧵 丢弃线索: {s.totalDroppedThreads} 处</div> : null}
                        {s.errors ? <div>❌ 失败: {s.errors} 章</div> : null}
                      </div>
                    </>
                  ) : null}
                </div>
              )
            })()}
            <div className="flex-row mt-16" style={{ justifyContent: 'flex-end', gap: 8 }}>
              {!auditResult?.stats?.fixApplied && (auditResult?.stats?.titleUpdated > 0 || auditResult?.stats?.contentCorrected > 0) ? (
                <button className="welcome-mode-btn active" onClick={handleApplyFixes}
                  style={{ background: 'var(--color-accent)', color: '#fff', border: '1px solid var(--color-accent)' }}>
                  🔧 应用修复
                </button>
              ) : null}
              {auditResult?.stats?.fixApplied ? (
                <button className="welcome-mode-btn active" onClick={handleApplyFixes}
                  style={{ background: 'var(--color-accent)', color: '#fff', border: '1px solid var(--color-accent)' }}>
                  🔄 重新修复
                </button>
              ) : null}
              <button className="welcome-mode-btn" onClick={() => setAuditStep('idle')}>关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
