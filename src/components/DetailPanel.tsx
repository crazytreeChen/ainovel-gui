import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'
import BookCover from './BookCover'
import { AGENT_DISPLAY, AGENT_COLORS } from '@/types'
import { getPhaseLabel } from '@/lib/utils/phaseLabel'

export default function DetailPanel() {
  const snapshot = useAppStore((s) => s.snapshot)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [bookName, setBookName] = useState('')
  const [usageStats, setUsageStats] = useState<any>(null)
  const [runMeta, setRunMeta] = useState<any>(null)
  const [cast, setCast] = useState<any[]>([])

  useEffect(() => {
    if (snapshot.novelName) setBookName(snapshot.novelName)
  }, [snapshot.novelName])

  useEffect(() => {
    if (!id || !window.electronAPI) return
    // 从数据库读取书名（兜底）
    if (!bookName) {
      window.electronAPI.listBooks().then((books: any[]) => {
        const b = books.find((x: any) => x.id === id)
        if (b?.name) setBookName(b.name)
      }).catch(() => {})
    }
    window.electronAPI.getUsageStats(id).then(setUsageStats).catch(() => {})
    window.electronAPI.getRunMeta(id).then(setRunMeta).catch(() => {})
    window.electronAPI.getBookCast(id).then(setCast).catch(() => {})
  }, [id, bookName])

  return (
    <div>
      {/* 封面 + 书名 */}
      {id && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <BookCover bookId={id} size="small" />
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 14, color: 'var(--color-text)' }}>{bookName || snapshot.novelName || '未定书名'}</div>
            <div className="text-dim mono" style={{ fontSize: 11, marginTop: 4 }}>
              {getPhaseLabel(snapshot.phase)} · {snapshot.completedCount} 章
            </div>
          </div>
        </div>
      )}

      {/* 大纲 */}
      {snapshot.outline.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            {snapshot.layered ? `大纲（${snapshot.currentVolumeArc || '动态规划'}）` : '大纲'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          {snapshot.outline.slice(-30).reverse().map((item) => {
            const isCompleted = snapshot.completedCount >= item.chapter
            const isCurrent = snapshot.inProgressChapter === item.chapter
            return (
              <div
                key={item.chapter}
                className="cursor-clickable"
                onClick={() => id && navigate(`/books/${id}/chapters/${item.chapter}`)}
                style={{
                  display: 'flex', gap: 4, alignItems: 'center', padding: '2px 4px', borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-mono)', fontSize: 12, margin: '2px 0',
                  color: isCompleted ? 'var(--color-dim)' : isCurrent ? 'var(--color-accent)' : 'var(--color-muted)',
                  fontWeight: isCurrent ? 'bold' : 'normal',
                }}
              >
                <span>{isCompleted ? '●' : isCurrent ? '▸' : '○'}</span>
                <span style={{ minWidth: 20, textAlign: 'right' }}>{item.chapter}</span>
                <span className="truncate">{item.title}</span>
                {isCurrent && (
                  <span className="text-accent" style={{ fontSize: 10, marginLeft: 4, fontStyle: 'italic' }}>
                    进行中
                  </span>
                )}
              </div>
            )
          })}
          </div>
          {snapshot.layered && (
            <div className="text-dim" style={{ fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              <div>┄ 后续章节随创作推进自动生成</div>
              {snapshot.compassDirection && (
                <div>→ 终局：{snapshot.compassDirection}</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 角色 */}
      {snapshot.characters.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">角色</div>
          {snapshot.characters.slice(0, 10).map((c) => (
            <div key={c} className="text-dim" style={{ fontSize: 12, margin: '2px 0' }}>
              · {c}
            </div>
          ))}
        </div>
      )}

      {/* 配角生态 */}
      {cast.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">配角生态</div>
          <div style={{ fontSize: 12, lineHeight: 1.8 }}>
            <div className="text-dim" style={{ marginBottom: 4 }}>
              共 {cast.length} 个配角 · {cast.filter(c => c.promoted).length} 个已晋级
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {[...cast]
                .sort((a, b) => b.appearanceCount - a.appearanceCount)
                .slice(0, 12)
                .map((c, i) => (
                  <span key={c.name} className="text-dim" style={{
                    padding: '1px 6px', background: 'var(--color-surface-2)',
                    borderRadius: 8, fontSize: 11, display: 'inline-flex',
                    alignItems: 'center', gap: 4,
                    border: c.promoted ? '1px solid var(--color-accent)' : 'none',
                    color: c.promoted ? 'var(--color-accent)' : 'var(--color-dim)',
                  }}>
                    {c.name}
                    <span className="mono" style={{ fontSize: 9, opacity: 0.6 }}>{c.appearanceCount}</span>
                  </span>
                ))}
            </div>
            <div className="text-dim" style={{ fontSize: 10, marginTop: 4 }}>
              TOP 12 出场配角 · 点击角色管理查看完整生态
            </div>
          </div>
        </div>
      )}

      {/* 前提 */}
      {snapshot.premise && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">前提</div>
          <div className="text-dim" style={{ fontSize: 12, lineHeight: 1.6 }}>
            {snapshot.premise.slice(0, 200)}
          </div>
        </div>
      )}

      {/* 最近提交 */}
      {snapshot.lastCommitSummary && (
        <div className="sidebar-section">
          <div className="sidebar-section-header" style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>最近提交</div>
          <div className="text-dim" style={{ fontSize: 12 }}>{snapshot.lastCommitSummary}</div>
        </div>
      )}

      {/* 最近审阅 */}
      {snapshot.lastReviewSummary && (
        <div className="sidebar-section">
          <div className="sidebar-section-header" style={{ color: 'var(--color-muted)', fontStyle: 'italic' }}>最近审阅</div>
          <div className="text-dim" style={{ fontSize: 12 }}>{snapshot.lastReviewSummary}</div>
        </div>
      )}

      {/* 用量统计 */}
      {usageStats && (
        <div className="sidebar-section">
          <div className="sidebar-section-header" style={{ fontSize: 11 }}>用量统计</div>
          <div className="mono" style={{ fontSize: 11, lineHeight: 1.8 }}>
            <div className="usage-row">
              <span className="text-muted">输入 Token</span>
              <span>{(usageStats.total_input || 0).toLocaleString()}</span>
            </div>
            <div className="usage-row">
              <span className="text-muted">输出 Token</span>
              <span>{(usageStats.total_output || 0).toLocaleString()}</span>
            </div>
            <div className="usage-row">
              <span className="text-muted">总费用</span>
              <span>${(usageStats.total_cost || 0).toFixed(4)}</span>
            </div>
            {usageStats.total_saved > 0 && (
              <div className="usage-row">
                <span className="text-success">节省</span>
                <span className="text-success">${usageStats.total_saved.toFixed(4)}</span>
              </div>
            )}
            {/* 缓存 */}
            {(usageStats.cache_read || 0) > 0 && (
              <div className="usage-row">
                <span className="text-muted">缓存读取</span>
                <span>{(usageStats.cache_read || 0).toLocaleString()}</span>
              </div>
            )}
            {(usageStats.cache_write || 0) > 0 && (
              <div className="usage-row">
                <span className="text-muted">缓存写入</span>
                <span>{(usageStats.cache_write || 0).toLocaleString()}</span>
              </div>
            )}
            {/* 按模型统计 */}
            {usageStats.per_model && Object.keys(usageStats.per_model).length > 0 && (
              <>
                <div className="usage-row" style={{ borderTop: '1px solid var(--color-border)', marginTop: 4, paddingTop: 4 }}>
                  <span className="text-dim" style={{ fontSize: 10 }}>按模型</span>
                  <span></span>
                </div>
                {Object.entries(usageStats.per_model).slice(0, 5).map(([model, stats]: [string, any]) => (
                  <div key={model} className="usage-row">
                    <span className="text-dim" style={{ fontSize: 10 }}>{model.split('/').pop()}</span>
                    <span className="text-dim" style={{ fontSize: 10 }}>{(stats.input || 0).toLocaleString()}</span>
                  </div>
                ))}
              </>
            )}
            {/* 按角色统计 */}
            {usageStats.per_agent && Object.keys(usageStats.per_agent).length > 0 && (
              <>
                <div className="usage-row" style={{ borderTop: '1px solid var(--color-border)', marginTop: 4, paddingTop: 4 }}>
                  <span className="text-dim" style={{ fontSize: 10 }}>按角色</span>
                  <span></span>
                </div>
                {Object.entries(usageStats.per_agent).map(([agent, stats]: [string, any]) => (
                  <div key={agent} className="usage-row">
                    <span style={{ fontSize: 11, color: AGENT_COLORS[agent] || 'var(--color-dim)', fontWeight: 'bold' }}>
                      {AGENT_DISPLAY[agent] || agent}
                    </span>
                    <span className="text-dim" style={{ fontSize: 10 }}>{(stats.input || 0).toLocaleString()}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* 运行元信息 */}
      {runMeta && (
        <div className="sidebar-section">
          <div className="sidebar-section-header" style={{ fontSize: 11 }}>运行信息</div>
          <div className="mono text-dim" style={{ fontSize: 11, lineHeight: 1.8 }}>
            {runMeta.provider && <div>Provider: {runMeta.provider}</div>}
            {runMeta.model && <div>模型: {runMeta.model}</div>}
            {runMeta.style && <div>风格: {runMeta.style}</div>}
            {runMeta.planning_tier && <div>规划: {({ short: '短篇', mid: '中篇', long: '长篇' } as Record<string, string>)[runMeta.planning_tier] || runMeta.planning_tier}</div>}
            {runMeta.started_at && <div>开始: {new Date(runMeta.started_at).toLocaleString('zh-CN')}</div>}
            {runMeta.pending_steer && <div style={{ color: 'var(--color-review)' }}>待处理: {runMeta.pending_steer}</div>}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {snapshot.outline.length === 0 && snapshot.characters.length === 0 && !snapshot.premise && (
        <div className="text-dim" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 40, textAlign: 'center' }}>
          暂无数据
        </div>
      )}
    </div>
  )
}
