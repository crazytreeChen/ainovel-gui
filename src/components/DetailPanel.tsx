import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'
import BookCover from './BookCover'

export default function DetailPanel() {
  const snapshot = useAppStore((s) => s.snapshot)
  const { id } = useParams<{ id: string }>()
  const [bookName, setBookName] = useState('')
  const [usageStats, setUsageStats] = useState<any>(null)
  const [runMeta, setRunMeta] = useState<any>(null)

  useEffect(() => {
    if (snapshot.novelName) setBookName(snapshot.novelName)
  }, [snapshot.novelName])

  useEffect(() => {
    if (!id || !window.electronAPI) return
    window.electronAPI.getUsageStats(id).then(setUsageStats).catch(() => {})
    window.electronAPI.getRunMeta(id).then(setRunMeta).catch(() => {})
  }, [id])

  return (
    <div>
      {/* 封面 + 书名 */}
      {id && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <BookCover bookId={id} size="small" editable />
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 14, color: 'var(--color-text)' }}>{bookName || snapshot.novelName || '未定书名'}</div>
            <div className="text-dim mono" style={{ fontSize: 11, marginTop: 4 }}>
              {snapshot.phase} · {snapshot.completedCount} 章
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
          {snapshot.outline.slice(0, 30).map((item) => {
            const isCompleted = snapshot.completedCount >= item.chapter
            const isCurrent = snapshot.inProgressChapter === item.chapter
            return (
              <div
                key={item.chapter}
                className={`outline-item ${isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'}`}
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
          {snapshot.characters.slice(0, 10).map((c, i) => (
            <div key={i} className="text-dim" style={{ fontSize: 12, margin: '2px 0' }}>
              · {c}
            </div>
          ))}
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
            {runMeta.planning_tier && <div>规划: {runMeta.planning_tier}</div>}
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
