import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import BookCover from '@/components/BookCover'
import { getPhaseLabel } from '@/lib/utils/phaseLabel'
import { useBookId } from '@/hooks/useBookId'
import BackButton from '@/components/BackButton'

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
    if (!confirm('将批量清洗所有章节标题：\n- 移除描述性括号内容\n- 截断超长标题（≤30字）\n- 更新章节文件与数据库\n\n确认继续？')) return
    setCleaning(true)
    try {
      const result = await window.electronAPI.batchCleanTitles(id)
      alert(`清洗完成：${result.cleaned}/${result.total} 章标题已更新`)
      // 重新加载章节列表
      const chs = await window.electronAPI.getBookChapters(id)
      setChapters(chs || [])
    } catch (e: any) {
      alert('清洗失败: ' + (e.message || e))
    }
    setCleaning(false)
  }

  async function handleAuditBook() {
    if (!id || !window.electronAPI || auditing) return
    if (!confirm('将启动全书评审修复 Agent：\n\n' +
      '• 逐章检查：标题质量、AI 味、节奏、大纲对齐、字数\n' +
      '• 自动修复：不合格标题将被重写\n' +
      '• 标记问题：需重写或删减的章节会被标注\n' +
      '• 耗时较长：每章约 10-15 秒，50 章约 10 分钟\n\n' +
      '确认开始全面审查？')) return
    setAuditing(true)
    try {
      const result = await window.electronAPI.batchAuditBook(id)
      if (!result.success) {
        alert('审查失败: ' + (result.error || '未知错误'))
      } else {
        const s = result.stats
        let msg = `📊 全书审查报告\n\n`
        msg += `已审 ${s.reviewed}/${result.total} 章`
        if (s.skipped) msg += `（${s.skipped} 章跳过）`
        msg += `\n\n`
        msg += `📈 平均分\n`
        msg += `  标题质量:    ${s.avgTitleScore}/10\n`
        msg += `  AI 味:      ${s.avgAiFlavorScore}/10\n`
        msg += `  节奏结构:   ${s.avgPacingScore}/10\n`
        msg += `  大纲对齐:   ${s.avgOutlineScore}/10\n`
        msg += `  角色连续性: ${s.avgCharContinuityScore}/10\n`
        msg += `  时间线连贯: ${s.avgTimelineScore}/10\n`
        msg += `  线索管理:   ${s.avgPlotThreadScore}/10\n\n`
        msg += `🛠 处理结果\n`
        if (s.titleUpdated) msg += `  ✅ 标题已更新: ${s.titleUpdated} 章\n`
        if (s.needsRewrite) msg += `  ⚠️ 建议重写: ${s.needsRewrite} 章\n`
        if (s.needsTrimming) msg += `  ✂️ 建议删减: ${s.needsTrimming} 章\n`
        if (s.totalMissingIntros) msg += `  👤 缺角色交代: ${s.totalMissingIntros} 处\n`
        if (s.totalCharStateInconsistencies) msg += `  ☠️ 状态冲突(死而复生): ${s.totalCharStateInconsistencies} 处\n`
        if (s.totalTimelineGaps) msg += `  ⏱ 时间线跳跃: ${s.totalTimelineGaps} 处\n`
        if (s.totalDroppedThreads) msg += `  🧵 丢弃线索: ${s.totalDroppedThreads} 处\n`
        if (s.errors) msg += `  ❌ 失败: ${s.errors} 章\n`
        alert(msg)
      }
      // 重新加载章节列表
      const chs = await window.electronAPI.getBookChapters(id)
      setChapters(chs || [])
    } catch (e: any) {
      alert('审查失败: ' + (e.message || e))
    }
    setAuditing(false)
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
                <button className="welcome-mode-btn" onClick={handleBatchCleanTitles} disabled={cleaning} style={{ borderColor: 'var(--color-accent)' }}>
                  {cleaning ? '⏳ 清洗中...' : '🧹 清洗标题'}
                </button>
                <button className="welcome-mode-btn" onClick={handleAuditBook} disabled={auditing} style={{ borderColor: 'var(--color-success)' }}>
                  {auditing ? '⏳ 审查中...' : '🔍 全书审查'}
                </button>
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
    </div>
  )
}
