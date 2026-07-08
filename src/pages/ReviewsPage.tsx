import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import { useBookId } from '@/hooks/useBookId'
import BackButton from '@/components/BackButton'
import ChapterDiff from '@/components/ChapterDiff'
import { confirmAction } from '@/components/ConfirmModal'
import { showToast } from '@/components/Toast'
import type { ApplyFixChange, ApplyFixSkip, ApplyFixSkipReason, ChapterAuditItem } from '@/shared/ipc'

type AuditProgress = { current: number; total: number; chapter: number; elapsed: number; remaining: number }
type AuditRunResult = {
  total: number; canceled?: boolean; stats?: { reviewed: number; skipped: number; errors: number }
  results?: { chapter: number; skipped?: boolean; reason?: string; error?: string }[]
}
type ApplyFixResult = {
  titleUpdated: number; contentFixed: number
  skipped?: ApplyFixSkip[]; skipStats?: Partial<Record<ApplyFixSkipReason, number>>
  applied?: ApplyFixChange[]
}

const SCORE_ITEMS: { key: keyof ChapterAuditItem['review']; label: string }[] = [
  { key: 'title_score', label: '标题' },
  { key: 'ai_flavor_score', label: 'AI味' },
  { key: 'pacing_score', label: '节奏' },
  { key: 'outline_alignment_score', label: '大纲' },
  { key: 'character_continuity_score', label: '角色' },
  { key: 'timeline_consistency_score', label: '时间线' },
  { key: 'plot_thread_score', label: '线索' },
]

async function sha256(text: string) {
  const buffer = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
}

function averageScore(audits: ChapterAuditItem[], key: keyof ChapterAuditItem['review']) {
  const values = audits.map(a => Number(a.review?.[key] || 0)).filter(Boolean)
  if (!values.length) return '-'
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)
}

function displayScore(value: ChapterAuditItem['review'][keyof ChapterAuditItem['review']]) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  return value ?? '-'
}

function countFixCandidates(audits: ChapterAuditItem[]) {
  return getFixCandidates(audits).length
}

function getFixCandidates(audits: ChapterAuditItem[]) {
  return audits.filter(a => !a.fixAppliedAt && (a.correctedContent || a.suggestedTitle))
}

function describeFix(audit: ChapterAuditItem) {
  const parts = []
  if (audit.suggestedTitle) parts.push('标题')
  if (audit.correctedContent) parts.push('正文')
  return parts.length ? parts.join('+') : '无'
}

const SKIP_LABELS: Record<ApplyFixSkipReason, string> = {
  already_applied: '已应用',
  no_fix: '无修复内容',
  missing_file: '文件缺失',
  stale: '需重审',
  unchanged: '无实际变化',
}

const AUDIT_SKIP_LABELS: Record<string, string> = {
  已审查: '内容未变化，已复用已有审查',
  用户取消: '用户取消',
  正文为空: '正文为空',
}

function formatSkipStats(stats?: Partial<Record<ApplyFixSkipReason, number>>) {
  return (Object.entries(stats || {}) as [ApplyFixSkipReason, number][])
    .filter(([, count]) => count > 0)
    .map(([reason, count]) => `${SKIP_LABELS[reason] || reason} ${count} 章`)
}

export default function ReviewsPage() {
  const id = useBookId()
  const navigate = useNavigate()
  const auditListRef = useRef<HTMLDivElement | null>(null)
  const auditItemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [audits, setAudits] = useState<ChapterAuditItem[]>([])
  const [chapters, setChapters] = useState<{ num: number; title: string; wordCount: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [auditing, setAuditing] = useState(false)
  const [auditProgress, setAuditProgress] = useState<AuditProgress | null>(null)
  const [startChapter, setStartChapter] = useState('')
  const [endChapter, setEndChapter] = useState('')
  const [lastResult, setLastResult] = useState<AuditRunResult | null>(null)
  const [selectedFixChapters, setSelectedFixChapters] = useState<number[]>([])
  const [chapterContent, setChapterContent] = useState('')
  const [chapterLoading, setChapterLoading] = useState(false)
  const [chapterLoadError, setChapterLoadError] = useState('')
  const [staleChapters, setStaleChapters] = useState<number[]>([])
  const [lastApplyResult, setLastApplyResult] = useState<ApplyFixResult | null>(null)
  const [localElapsed, setLocalElapsed] = useState(0)
  const auditStartRef = useRef(0)

  // 审查期间本地递增计时器（每秒更新，不依赖后端推送）
  useEffect(() => {
    if (!auditing) { setLocalElapsed(0); return }
    auditStartRef.current = auditStartRef.current || Date.now()
    const timer = setInterval(() => {
      setLocalElapsed(Math.floor((Date.now() - auditStartRef.current) / 1000))
    }, 1000)
    return () => { clearInterval(timer); auditStartRef.current = 0 }
  }, [auditing])

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    if (!id || !window.electronAPI) return
    setLoading(true)
    const [auditData, chapterData] = await Promise.all([
      window.electronAPI.getBookAudits(id),
      window.electronAPI.getBookChapters(id),
    ])
    const normalizedAudits = auditData || []
    setAudits(normalizedAudits)
    setChapters(chapterData || [])
    const stale = await findStaleFixCandidates(normalizedAudits)
    setStaleChapters(stale)
    setSelectedFixChapters(getFixCandidates(normalizedAudits).filter(a => !stale.includes(a.chapter)).map(a => a.chapter))
    setSelectedIdx(0)
    setLoading(false)
  }

  async function findStaleFixCandidates(auditData: ChapterAuditItem[]) {
    if (!id || !window.electronAPI) return []
    const stale: number[] = []
    for (const audit of getFixCandidates(auditData)) {
      if (!audit.contentHash) continue
      try {
        const chapter = await window.electronAPI.getBookChapter(id, audit.chapter)
        const currentHash = await sha256(chapter?.content || '')
        if (currentHash !== audit.contentHash) stale.push(audit.chapter)
      } catch {
        stale.push(audit.chapter)
      }
    }
    return stale
  }

  async function loadSelectedChapterContent() {
    if (!id || !window.electronAPI || !selectedAudit?.chapter) {
      setChapterContent('')
      return
    }
    setChapterLoading(true)
    setChapterLoadError('')
    try {
      const chapter = await window.electronAPI.getBookChapter(id, selectedAudit.chapter)
      setChapterContent(chapter?.content || '')
    } catch (e: any) {
      setChapterContent('')
      setChapterLoadError(e.message || String(e))
    } finally {
      setChapterLoading(false)
    }
  }

  const selectedAudit = audits[selectedIdx]

  useEffect(() => { loadSelectedChapterContent() }, [id, selectedAudit?.chapter])

  const fixCandidates = useMemo(() => getFixCandidates(audits), [audits])
  const selectedFixSet = useMemo(() => new Set(selectedFixChapters), [selectedFixChapters])
  const staleFixSet = useMemo(() => new Set(staleChapters), [staleChapters])
  const summary = useMemo(() => ({
    total: audits.length,
    needsRewrite: audits.filter(a => a.needsRewrite).length,
    needsTrimming: audits.filter(a => a.needsTrimming).length,
    issueCount: audits.reduce((sum, a) => sum + a.issues.length, 0),
    fixCandidates: countFixCandidates(audits),
    applied: audits.filter(a => a.fixAppliedAt).length,
  }), [audits])

  function syncSelectedAuditFromScroll() {
    const container = auditListRef.current
    if (!container || !audits.length) return
    const targetTop = container.scrollTop + 8
    let nextIdx = 0
    for (let idx = 0; idx < audits.length; idx += 1) {
      const item = auditItemRefs.current[idx]
      if (!item) continue
      if (item.offsetTop <= targetTop) nextIdx = idx
      else break
    }
    setSelectedIdx(prev => (prev === nextIdx ? prev : nextIdx))
  }

  useEffect(() => {
    auditItemRefs.current = auditItemRefs.current.slice(0, audits.length)
  }, [audits])

  function toggleFixChapter(chapter: number) {
    setSelectedFixChapters(prev => prev.includes(chapter)
      ? prev.filter(item => item !== chapter)
      : [...prev, chapter].sort((a, b) => a - b))
  }

  function fillStaleReviewRange() {
    if (!staleChapters.length) return
    const sorted = [...staleChapters].sort((a, b) => a - b)
    setStartChapter(String(sorted[0]))
    setEndChapter(String(sorted[sorted.length - 1]))
    showToast(`已填入需重审范围：第 ${sorted[0]}-${sorted[sorted.length - 1]} 章`, 'info')
  }

  async function startAudit(force = false) {
    if (!id || !window.electronAPI || auditing) return
    const chStart = parseInt(startChapter) || 0
    const chEnd = parseInt(endChapter) || 0
    if (chStart > 0 && chEnd > 0 && chStart > chEnd) {
      showToast('章节范围不正确', 'error')
      return
    }
    const confirmed = await confirmAction({
      title: force ? '重新执行质量审查' : '执行质量审查',
      message: `将审查 ${chStart || '首章'} 到 ${chEnd || '末章'}。审查只保存建议，不会直接改正文。`,
      confirmText: force ? '重新审查' : '开始审查',
    })
    if (!confirmed) return
    setAuditing(true)
    setAuditProgress(null)
    setLastResult(null)
    setLastApplyResult(null)
    const cleanup = window.electronAPI.onAuditProgress(setAuditProgress)
    try {
      const result = await window.electronAPI.batchAuditBook(id, false, chStart, chEnd, force)
      setLastResult(result)
      if (!result.success) showToast('审查失败: ' + (result.error || '未知错误'), 'error')
      else {
        const skipped = result.stats?.skipped || 0
        const reviewed = result.stats?.reviewed || 0
        const suffix = skipped > 0 ? `，跳过 ${skipped} 章（可查看结果摘要）` : ''
        showToast(result.canceled ? '审查已停止，已保存完成部分' : `质量审查完成：新审查 ${reviewed} 章${suffix}`, result.canceled || skipped > 0 ? 'info' : 'success')
      }
      await loadData()
    } catch (e: any) {
      showToast('审查失败: ' + (e.message || e), 'error')
    } finally {
      cleanup()
      setAuditing(false)
    }
  }

  async function handleCancelAudit() {
    if (!window.electronAPI) return
    const ok = await window.electronAPI.cancelAudit()
    showToast(ok ? '已请求停止审查' : '停止审查失败', ok ? 'info' : 'error')
  }

  async function handleApplyFixes() {
    if (!id || !window.electronAPI) return
    const candidates = fixCandidates.filter(a => selectedFixSet.has(a.chapter))
    if (!fixCandidates.length) {
      showToast('没有可应用的审查修复', 'info')
      return
    }
    if (!candidates.length) {
      showToast('请先选择要应用的章节', 'info')
      return
    }
    const staleCandidates = candidates.filter(a => staleFixSet.has(a.chapter))
    if (staleCandidates.length) {
      showToast(`有 ${staleCandidates.length} 章正文已在审查后变更，请先重新审查`, 'error')
      return
    }
    const details = candidates.slice(0, 12).map(a => `#${a.chapter} ${describeFix(a)}修复`)
    if (candidates.length > details.length) details.push(`...另有 ${candidates.length - details.length} 章`)
    const confirmed = await confirmAction({
      title: '应用审查修复',
      message: `将根据已保存的审查建议修复 ${candidates.length} 章。已变更章节会被要求重新审查，不会直接写入。`,
      confirmText: '应用修复',
      details,
    })
    if (!confirmed) return
    const result = await window.electronAPI.batchApplyFixes(id, candidates.map(a => a.chapter))
    if (!result.success) showToast('应用修复失败: ' + (result.error || '未知错误'), 'error')
    else {
      setLastApplyResult(result)
      const skipSummary = formatSkipStats(result.skipStats)
      const message = `修复完成：标题 ${result.titleUpdated} 章，正文 ${result.contentFixed} 章${skipSummary.length ? `；跳过：${skipSummary.join('，')}` : ''}`
      showToast(message, skipSummary.length ? 'info' : 'success')
    }
    await loadData()
  }

  return (
    <div className="flex-row p-24" style={{ height: '100vh', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div className="flex-1 flex-col overflow-hidden" style={{ minHeight: 0 }}>
        <div className="flex-row items-center gap-12 mb-16 flex-shrink-0">
          <BackButton to={`/books/${id}/intro`} />
          <h2 className="mono text-accent m-0 text-lg">质量审查</h2>
          <span className="text-dim text-sm">{summary.total}/{chapters.length} 章已审查</span>
        </div>

        <div className="flex-1 scroll-y" style={{ minHeight: 0, paddingRight: 4 }}>
        <div className="card mb-16 flex-shrink-0" style={{ padding: 16 }}>
          <div className="flex-row items-center justify-between gap-12 flex-wrap">
            <div className="flex-row items-center gap-8 flex-wrap">
              <span className="sidebar-section-header text-xs">章节范围</span>
              <input className="input-field mono text-xs" style={{ width: 70, padding: '4px 8px' }}
                placeholder="起始" value={startChapter} onChange={e => setStartChapter(e.target.value.replace(/\D/g, ''))} />
              <span className="text-dim text-xs">—</span>
              <input className="input-field mono text-xs" style={{ width: 70, padding: '4px 8px' }}
                placeholder="结束" value={endChapter} onChange={e => setEndChapter(e.target.value.replace(/\D/g, ''))} />
              <button className="welcome-mode-btn active" disabled={auditing} onClick={() => startAudit(false)}>开始审查</button>
              <button className="welcome-mode-btn" disabled={auditing} onClick={() => startAudit(true)}>强制重审</button>
              <button className="welcome-mode-btn" disabled={auditing || selectedFixChapters.length === 0} onClick={handleApplyFixes}>应用所选修复</button>
              {auditing && <button className="welcome-mode-btn" onClick={handleCancelAudit} style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>停止</button>}
            </div>
            <div className="text-dim text-xs mono">共 {chapters.length} 章</div>
          </div>
          {auditProgress && (
            <div className="flex-row items-center gap-8 mt-12 mono text-xs">
              <span className="text-dim">#{auditProgress.chapter}</span>
              <div className="flex-1" style={{ height: 6, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${(auditProgress.current / auditProgress.total) * 100}%`, height: '100%', background: 'var(--color-accent)' }} />
              </div>
              <span className="text-dim">{auditProgress.current}/{auditProgress.total}</span>
              <span className="text-dim">已用 {formatTime(localElapsed)}</span>
            </div>
          )}
          {lastResult?.stats && (
            <AuditResultSummary result={lastResult} onForceRange={(start, end) => { setStartChapter(String(start)); setEndChapter(String(end)) }} />
          )}
          {lastApplyResult && <ApplyResultSummary result={lastApplyResult} />}
        </div>

        <div className="grid mb-16 flex-shrink-0" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(116px, 1fr))', gap: 8 }}>
          <Stat label="问题" value={summary.issueCount} />
          <Stat label="可修复" value={summary.fixCandidates} />
          <Stat label="已应用" value={summary.applied} />
          <Stat label="需重写" value={summary.needsRewrite} />
          <Stat label="需删减" value={summary.needsTrimming} />
          <Stat label="平均标题" value={averageScore(audits, 'title_score')} />
        </div>

        {fixCandidates.length > 0 && (
          <div className="card mb-16 flex-shrink-0" style={{ padding: 12 }}>
            <div className="flex-row items-center justify-between gap-12 mb-8">
              <div className="sidebar-section-header text-xs">待应用修复 ({selectedFixChapters.length}/{fixCandidates.length})</div>
              <div className="flex-row gap-6">
                <button className="welcome-mode-btn btn-sm" onClick={() => setSelectedFixChapters(fixCandidates.filter(a => !staleFixSet.has(a.chapter)).map(a => a.chapter))}>全选</button>
                <button className="welcome-mode-btn btn-sm" onClick={() => setSelectedFixChapters([])}>清空</button>
              </div>
            </div>
            {staleChapters.length > 0 && (
              <div className="flex-row items-center justify-between gap-12 mb-8 flex-wrap">
                <div className="text-dim text-xs">{staleChapters.length} 章正文已在审查后变更，已从默认应用范围排除。</div>
                <button className="welcome-mode-btn btn-sm" onClick={fillStaleReviewRange}>填入重审范围</button>
              </div>
            )}
            <div className="scroll-y" style={{ maxHeight: 104, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
              {fixCandidates.map(audit => (
                <label key={audit.chapter} className="cursor-clickable flex-row items-center gap-6 text-xs"
                  style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)' }}>
                  <input type="checkbox" disabled={staleFixSet.has(audit.chapter)} checked={selectedFixSet.has(audit.chapter)} onChange={() => toggleFixChapter(audit.chapter)} />
                  <span className="mono text-accent">#{audit.chapter}</span>
                  <span className="text-dim">{describeFix(audit)}</span>
                  {staleFixSet.has(audit.chapter) && <span className="text-dim">需重审</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        {loading ? <div className="text-dim">加载中...</div> : audits.length === 0 ? (
          <div className="text-dim text-center mt-60">暂无质量审查记录</div>
        ) : (
          <div className="flex-row gap-16" style={{ minHeight: 420 }}>
            <div
              ref={auditListRef}
              className="scroll-y border-right flex-shrink-0"
              style={{ width: 210, paddingRight: 8 }}
              onScroll={syncSelectedAuditFromScroll}
            >
              {audits.map((audit, idx) => (
                <button
                  key={audit.chapter}
                  ref={node => { auditItemRefs.current[idx] = node }}
                  className="cursor-clickable mono text-sm text-left"
                  onClick={() => setSelectedIdx(idx)}
                  style={{ width: '100%', padding: '7px 8px', borderRadius: 'var(--radius-sm)', marginBottom: 3, border: 0,
                    background: idx === selectedIdx ? 'var(--color-surface-2)' : 'transparent', color: 'var(--color-text)' }}>
                  <span className="text-accent">#{audit.chapter}</span>
                  <span className="text-dim ml-8">{audit.issues.length ? `${audit.issues.length} 问题` : '通过'}</span>
                  {staleFixSet.has(audit.chapter) && <span className="text-dim ml-8">需重审</span>}
                  {audit.fixAppliedAt && <span className="text-dim ml-8">已修复</span>}
                </button>
              ))}
            </div>

            {selectedAudit && (
              <div className="flex-1">
                <div className="flex-row items-center justify-between mb-12 gap-12">
                  <div>
                    <div className="mono text-accent text-lg fw-bold">第{selectedAudit.chapter}章</div>
                    <div className="text-dim text-xs">{new Date(selectedAudit.reviewedAt).toLocaleString()}</div>
                  </div>
                  <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}/chapters/${selectedAudit.chapter}`)}>打开章节</button>
                </div>

                <div className="grid mb-16" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
                  {SCORE_ITEMS.map(item => <Stat key={item.key} label={item.label} value={displayScore(selectedAudit.review?.[item.key])} />)}
                </div>

                {staleFixSet.has(selectedAudit.chapter) && <Panel title="修复提示">当前章节正文已在本次审查后发生变化，请重新审查后再应用修复。</Panel>}
                {selectedAudit.summary && <Panel title="摘要">{selectedAudit.summary}</Panel>}
                {selectedAudit.suggestedTitle && <Panel title="标题建议">{selectedAudit.suggestedTitle}</Panel>}
                {selectedAudit.fixAppliedAt && <Panel title="修复状态">{`已于 ${new Date(selectedAudit.fixAppliedAt).toLocaleString()} 应用修复`}</Panel>}
                {!selectedAudit.fixAppliedAt && selectedAudit.correctedContent && (
                  <DiffPanel
                    loading={chapterLoading}
                    error={chapterLoadError}
                    oldText={chapterContent}
                    newText={selectedAudit.correctedContent}
                  />
                )}

                <IssueList title="问题清单" items={selectedAudit.issues} />
                <IssueList title="角色缺失交代" items={selectedAudit.missingIntroductions} />
                <IssueList title="角色状态冲突" items={selectedAudit.characterStateInconsistencies} />
                <IssueList title="时间线跳跃" items={selectedAudit.timelineGaps} />
                <IssueList title="丢弃线索" items={selectedAudit.droppedThreads} />
                <IssueList title="优点" items={selectedAudit.strengths} muted />
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

function DiffPanel({ loading, error, oldText, newText }: { loading: boolean; error: string; oldText: string; newText: string }) {
  return (
    <div className="card mb-12" style={{ padding: 12 }}>
      <div className="flex-row items-center justify-between gap-12 mb-8">
        <div className="sidebar-section-header text-xs">修正文差异</div>
        <div className="text-dim text-xs">当前章节 vs 审查修正文</div>
      </div>
      {loading ? <div className="text-dim text-sm">加载章节内容...</div> : error ? (
        <div className="text-dim text-sm">章节内容读取失败：{error}</div>
      ) : (
        <div style={{ height: 360, display: 'flex' }}>
          <ChapterDiff oldText={oldText} newText={newText} />
        </div>
      )}
    </div>
  )
}

function ApplyResultSummary({ result }: { result: ApplyFixResult }) {
  const skipSummary = formatSkipStats(result.skipStats)
  const skipped = result.skipped || []
  return (
    <div className="mt-12" style={{ paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
      <div className="flex-row items-center gap-12 flex-wrap text-xs">
        <span className="sidebar-section-header text-xs">最近应用结果</span>
        <span className="text-dim">标题 {result.titleUpdated} 章</span>
        <span className="text-dim">正文 {result.contentFixed} 章</span>
        {skipSummary.length > 0 && <span className="text-dim">跳过：{skipSummary.join('，')}</span>}
      </div>
      {skipped.length > 0 && (
        <div className="mt-8 text-dim text-xs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
          {skipped.slice(0, 12).map(item => (
            <div key={`${item.chapter}-${item.reason}`} style={{ padding: '5px 8px', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)' }}>
              <span className="mono text-accent">#{item.chapter}</span>
              <span className="ml-8">{SKIP_LABELS[item.reason]}</span>
            </div>
          ))}
          {skipped.length > 12 && <div style={{ padding: '5px 8px' }}>另有 {skipped.length - 12} 章</div>}
        </div>
      )}
    </div>
  )
}

function AuditResultSummary({ result, onForceRange }: { result: AuditRunResult; onForceRange: (start: number, end: number) => void }) {
  const stats = result.stats || { reviewed: 0, skipped: 0, errors: 0 }
  const skipped = (result.results || []).filter(item => item.skipped)
  const errors = (result.results || []).filter(item => item.error)
  const skippedChapters = skipped.map(item => item.chapter).filter(Boolean).sort((a, b) => a - b)
  const canForceRange = skippedChapters.length > 0

  function fillRange() {
    if (!canForceRange) return
    onForceRange(skippedChapters[0], skippedChapters[skippedChapters.length - 1])
    showToast(`已填入强制重审范围：第 ${skippedChapters[0]}-${skippedChapters[skippedChapters.length - 1]} 章`, 'info')
  }

  return (
    <div className="mt-12" style={{ paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
      <div className="flex-row items-center gap-12 flex-wrap text-xs">
        <span className="sidebar-section-header text-xs">最近审查结果</span>
        <span className="text-dim">新审查 {stats.reviewed}/{result.total} 章</span>
        <span className="text-dim">跳过 {stats.skipped} 章</span>
        <span className="text-dim">错误 {stats.errors} 章</span>
        {result.canceled && <span className="text-dim">已停止</span>}
        {canForceRange && <button className="welcome-mode-btn btn-sm" onClick={fillRange}>填入强制重审范围</button>}
      </div>
      {skipped.length > 0 && (
        <div className="mt-8 text-dim text-xs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
          {skipped.slice(0, 12).map(item => (
            <div key={`skip-${item.chapter}-${item.reason}`} style={{ padding: '5px 8px', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)' }}>
              <span className="mono text-accent">#{item.chapter}</span>
              <span className="ml-8">{AUDIT_SKIP_LABELS[item.reason || ''] || item.reason || '已跳过'}</span>
            </div>
          ))}
          {skipped.length > 12 && <div style={{ padding: '5px 8px' }}>另有 {skipped.length - 12} 章</div>}
        </div>
      )}
      {errors.length > 0 && (
        <div className="mt-8 text-dim text-xs" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
          {errors.slice(0, 6).map(item => (
            <div key={`error-${item.chapter}`} style={{ padding: '5px 8px', background: 'var(--color-surface)', borderRadius: 'var(--radius-sm)' }}>
              <span className="mono text-accent">#{item.chapter}</span>
              <span className="ml-8">{item.error}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card flex-row items-center justify-between gap-8" style={{ padding: '8px 10px', minHeight: 38 }}>
      <div className="text-dim text-xs truncate">{label}</div>
      <div className="mono text-accent" style={{ fontSize: 18, fontWeight: 'bold', flexShrink: 0 }}>{value}</div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: string }) {
  return (
    <div className="card mb-12">
      <div className="sidebar-section-header text-xs mb-8">{title}</div>
      <div className="text-dim text-sm" style={{ lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}

function IssueList({ title, items, muted = false }: { title: string; items: string[]; muted?: boolean }) {
  if (!items?.length) return null
  return (
    <div className="mb-12">
      <div className="sidebar-section-header text-xs mb-8">{title} ({items.length})</div>
      {items.map((item, idx) => (
        <div key={`${title}-${idx}`} className="text-sm" style={{ padding: '8px 10px', marginBottom: 4,
          borderRadius: 'var(--radius-sm)', background: 'var(--color-surface)',
          borderLeft: `3px solid ${muted ? 'var(--color-accent)' : 'var(--color-error)'}` }}>
          {item}
        </div>
      ))}
    </div>
  )
}
