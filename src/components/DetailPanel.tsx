import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBookStore } from '@/stores/useAppStore'
import BookCover from './BookCover'
import UsageStats from './UsageStats'
import { getPhaseLabel } from '@/lib/utils/phaseLabel'

export default function DetailPanel() {
  const snapshot = useBookStore((s) => s.snapshot)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [bookName, setBookName] = useState('')
  const [usageStats, setUsageStats] = useState<any>(null)
  const [runMeta, setRunMeta] = useState<any>(null)
  const [cast, setCast] = useState<any[]>([])
  const [chapterCount, setChapterCount] = useState(0)

  useEffect(() => {
    if (snapshot.novelName) setBookName(snapshot.novelName)
  }, [snapshot.novelName])

  useEffect(() => {
    if (!id || !window.electronAPI) return
    if (!bookName) {
      window.electronAPI.getBook(id).then((b: any) => {
        if (b?.name) setBookName(b.name)
      }).catch(() => {})
    }
    loadStats()
    refreshChapters()
  }, [id, bookName])

  async function loadStats() {
    if (!id || !window.electronAPI) return
    window.electronAPI.getUsageStats(id).then(setUsageStats).catch(() => {})
    window.electronAPI.getRunMeta(id).then(setRunMeta).catch(() => {})
    window.electronAPI.getBookCast(id).then(setCast).catch(() => {})
  }

  async function refreshChapters() {
    if (!id || !window.electronAPI) return
    const chs = await window.electronAPI.getBookChapters(id).catch(() => [])
    if (chs?.length) setChapterCount(chs.length)
  }

  return (
    <div>
      {id && (
        <div className="flex-row gap-12 mb-16 items-center">
          <BookCover bookId={id} size="small" />
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 14, color: 'var(--color-text)' }}>{bookName || snapshot.novelName || '未定书名'}</div>
            <div className="text-dim mono text-xs mt-8">{getPhaseLabel(snapshot.phase)} · {(chapterCount || snapshot.completedCount)} 章</div>
          </div>
        </div>
      )}

      {snapshot.outline.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">{snapshot.layered ? `大纲（${snapshot.currentVolumeArc || '动态规划'}）` : '大纲'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            {snapshot.outline.slice(-30).reverse().map((item) => {
              const isCompleted = snapshot.completedCount >= item.chapter
              const isCurrent = snapshot.inProgressChapter === item.chapter
              return (
                <div key={item.chapter} className="cursor-clickable flex-row items-center gap-4"
                  onClick={() => id && navigate(`/books/${id}/chapters/${item.chapter}`)}
                  style={{ padding: '2px 4px', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: 12, margin: '2px 0',
                    color: isCompleted ? 'var(--color-dim)' : isCurrent ? 'var(--color-accent)' : 'var(--color-muted)', fontWeight: isCurrent ? 'bold' : 'normal' }}>
                  <span>{isCompleted ? '●' : isCurrent ? '▸' : '○'}</span>
                  <span style={{ minWidth: 20, textAlign: 'right' }}>{item.chapter}</span>
                  <span className="truncate">{item.title}</span>
                  {isCurrent && <span className="text-accent text-xs ml-8" style={{ fontStyle: 'italic' }}>进行中</span>}
                </div>
              )
            })}
          </div>
          {snapshot.layered && (
            <div className="text-dim text-xs mono mt-8">
              <div>┄ 后续章节随创作推进自动生成</div>
              {snapshot.compassDirection && <div>→ 终局：{snapshot.compassDirection}</div>}
            </div>
          )}
        </div>
      )}

      {snapshot.characters.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">角色</div>
          {snapshot.characters.slice(0, 10).map((c) => (
            <div key={c} className="text-dim text-sm" style={{ margin: '2px 0' }}>· {c}</div>
          ))}
        </div>
      )}

      {cast.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">配角生态</div>
          <div className="text-sm" style={{ lineHeight: 1.8 }}>
            <div className="text-dim mb-8">共 {cast.length} 个配角 · {cast.filter(c => c.promoted).length} 个已晋级</div>
            <div className="flex-row flex-wrap gap-3">
              {[...cast].sort((a, b) => b.appearanceCount - a.appearanceCount).slice(0, 12).map((c) => (
                <span key={c.name} className="text-dim text-xs" style={{ padding: '1px 6px', background: 'var(--color-surface-2)', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4, border: c.promoted ? '1px solid var(--color-accent)' : 'none', color: c.promoted ? 'var(--color-accent)' : 'var(--color-dim)' }}>
                  {c.name}
                  <span className="mono text-2xs" style={{ opacity: 0.6 }}>{c.appearanceCount}</span>
                </span>
              ))}
            </div>
            <div className="text-dim text-xs mt-8">TOP 12 出场配角 · 点击角色管理查看完整生态</div>
          </div>
        </div>
      )}

      {snapshot.premise && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">前提</div>
          <div className="text-dim text-sm" style={{ lineHeight: 1.6 }}>{snapshot.premise.slice(0, 200)}</div>
        </div>
      )}

      {snapshot.lastCommitSummary && (
        <div className="sidebar-section">
          <div className="sidebar-section-header" style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>最近提交</div>
          <div className="text-dim text-sm">{snapshot.lastCommitSummary}</div>
        </div>
      )}

      {snapshot.lastReviewSummary && (
        <div className="sidebar-section">
          <div className="sidebar-section-header" style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>最近审阅</div>
          <div className="text-dim text-sm">{snapshot.lastReviewSummary}</div>
        </div>
      )}

      {usageStats && (
        <div className="sidebar-section">
          <div className="sidebar-section-header text-xs">用量统计</div>
          <UsageStats stats={usageStats} />
        </div>
      )}

      {runMeta && (
        <div className="sidebar-section">
          <div className="sidebar-section-header text-xs">运行信息</div>
          <div className="mono text-dim text-xs" style={{ lineHeight: 1.8 }}>
            {runMeta.provider && <div>Provider: {runMeta.provider}</div>}
            {runMeta.model && <div>模型: {runMeta.model}</div>}
            {runMeta.style && <div>风格: {runMeta.style}</div>}
            {runMeta.planning_tier && <div>规划: {({ short: '短篇', mid: '中篇', long: '长篇' } as Record<string, string>)[runMeta.planning_tier] || runMeta.planning_tier}</div>}
            {runMeta.started_at && <div>开始: {new Date(runMeta.started_at).toLocaleString('zh-CN')}</div>}
            {runMeta.pending_steer && <div style={{ color: 'var(--color-review)' }}>待处理: {runMeta.pending_steer}</div>}
          </div>
        </div>
      )}

      {snapshot.outline.length === 0 && snapshot.characters.length === 0 && !snapshot.premise && (
        <div className="text-dim mono text-sm text-center mt-40">暂无数据</div>
      )}
    </div>
  )
}
