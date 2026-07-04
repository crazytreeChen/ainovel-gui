import { AGENT_DISPLAY, AGENT_COLORS } from '@/types'

interface UsageStatsData {
  total_input?: number
  total_output?: number
  total_cost?: number
  total_saved?: number
  cache_read?: number
  cache_write?: number
  per_model?: Record<string, { input: number; output: number; cost: number }>
  per_agent?: Record<string, { input: number; output: number }>
}

interface UsageStatsProps {
  stats: UsageStatsData | null
}

/**
 * 用量统计组件 — 统一 DetailPanel 和 DashboardPage 的用量展示
 */
export default function UsageStats({ stats }: UsageStatsProps) {
  if (!stats) return null

  return (
    <div className="mono text-xs" style={{ lineHeight: 1.8 }}>
      <div className="usage-row">
        <span className="text-muted">输入 Token</span>
        <span>{(stats.total_input || 0).toLocaleString()}</span>
      </div>
      <div className="usage-row">
        <span className="text-muted">输出 Token</span>
        <span>{(stats.total_output || 0).toLocaleString()}</span>
      </div>
      <div className="usage-row">
        <span className="text-muted">总费用</span>
        <span>${(stats.total_cost || 0).toFixed(4)}</span>
      </div>
      {stats.total_saved != null && stats.total_saved > 0 && (
        <div className="usage-row">
          <span className="text-success">节省</span>
          <span className="text-success">${stats.total_saved.toFixed(4)}</span>
        </div>
      )}
      {(stats.cache_read || 0) > 0 && (
        <div className="usage-row">
          <span className="text-muted">缓存读取</span>
          <span>{(stats.cache_read || 0).toLocaleString()}</span>
        </div>
      )}
      {(stats.cache_write || 0) > 0 && (
        <div className="usage-row">
          <span className="text-muted">缓存写入</span>
          <span>{(stats.cache_write || 0).toLocaleString()}</span>
        </div>
      )}
      {stats.per_model && Object.keys(stats.per_model).length > 0 && (
        <>
          <div className="usage-row border-top mt-8" style={{ paddingTop: 4 }}>
            <span className="text-dim text-xs">按模型</span>
            <span></span>
          </div>
          {Object.entries(stats.per_model).slice(0, 5).map(([model, mStats]) => (
            <div key={model} className="usage-row">
              <span className="text-dim text-xs">{model.split('/').pop()}</span>
              <span className="text-dim text-xs">{(mStats.input || 0).toLocaleString()}</span>
            </div>
          ))}
        </>
      )}
      {stats.per_agent && Object.keys(stats.per_agent).length > 0 && (
        <>
          <div className="usage-row border-top mt-8" style={{ paddingTop: 4 }}>
            <span className="text-dim text-xs">按角色</span>
            <span></span>
          </div>
          {Object.entries(stats.per_agent).map(([agent, aStats]) => (
            <div key={agent} className="usage-row">
              <span style={{ fontSize: 11, color: AGENT_COLORS[agent] || 'var(--color-dim)', fontWeight: 'bold' }}>
                {AGENT_DISPLAY[agent] || agent}
              </span>
              <span className="text-dim text-xs">{(aStats.input || 0).toLocaleString()}</span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
