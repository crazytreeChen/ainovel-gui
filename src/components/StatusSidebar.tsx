import { useAppStore } from '@/stores/useAppStore'
import { PHASE_LABELS, FLOW_LABELS, AGENT_DISPLAY, AGENT_COLORS, AGENT_TASK_LABELS } from '@/types'

function formatNumber(n: number): string {
  if (n === 0) return '0'
  return n.toLocaleString()
}

function formatTokensCompact(n: number): string {
  if (n <= 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function formatCostUSD(usd: number): string {
  if (usd <= 0) return ''
  if (usd < 0.01) return `$${usd.toFixed(4)}`
  return `$${usd.toFixed(2)}`
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="sidebar-field">
      <span className="sidebar-label">{label}</span>
      <span className={highlight ? 'sidebar-highlight' : 'sidebar-value'}>{value}</span>
    </div>
  )
}

function agentStateColor(state: string): string {
  switch (state) {
    case 'running': return '#7ec488'
    case 'failed': return '#e07060'
    default: return '#8a8175'
  }
}

function agentStateIcon(state: string): string {
  switch (state) {
    case 'running': return '●'
    case 'failed': return '×'
    default: return '·'
  }
}

function agentStateLabel(state: string): string {
  switch (state) {
    case 'running': return '运行中'
    case 'failed': return '异常'
    default: return '待命'
  }
}

export default function StatusSidebar() {
  const snapshot = useAppStore((s) => s.snapshot)

  const agents = snapshot.agents || []
  const activeAgents = agents.filter((a) => a.state !== 'idle')
  const idleAgents = agents.filter((a) => a.state === 'idle')

  return (
    <div>
      {/* 概览 */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">概览</div>
        <Field label="运行态" value={snapshot.runtimeState === 'running' ? '运行中' : snapshot.runtimeState === 'paused' ? '已暂停' : '空闲'} />
        <Field label="阶段" value={PHASE_LABELS[snapshot.phase] || snapshot.phase || '-'} />
        <Field label="流程" value={FLOW_LABELS[snapshot.flow] || snapshot.flow || '-'} />
        {snapshot.layered ? (
          <>
            <Field label="已完成" value={`${snapshot.completedCount} 章`} />
            {snapshot.outline.length > 0 && (
              <Field label="已规划" value={`${snapshot.totalOutlineCount || snapshot.outline.length} 章`} />
            )}
          </>
        ) : snapshot.totalChapters > 0 ? (
          <Field label="进度" value={`${snapshot.completedCount} / ${snapshot.totalChapters} 章`} />
        ) : (
          <Field label="已完成" value={`${snapshot.completedCount} 章`} />
        )}
        <Field label="字数" value={formatNumber(snapshot.totalWordCount)} />
      </div>

      {/* 运行角色 */}
      {activeAgents.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">运行角色</div>
          {activeAgents.slice(0, 4).map((agent) => (
            <div key={agent.name} className="agent-line">
              <div className="agent-line-header">
                <span className="agent-state-icon" style={{ color: agentStateColor(agent.state) }}>
                  {agentStateIcon(agent.state)}
                </span>
                <span className="agent-name" style={{ color: AGENT_COLORS[agent.name] || '#e5b449' }}>
                  {AGENT_DISPLAY[agent.name] || agent.name.toUpperCase()}
                </span>
                <span className="agent-state-badge" style={{ color: agentStateColor(agent.state) }}>
                  {agentStateLabel(agent.state)}
                </span>
              </div>
              {agent.taskKind && (
                <div className="agent-task">
                  {AGENT_TASK_LABELS[agent.taskKind] || agent.taskKind}
                </div>
              )}
            </div>
          ))}
          {idleAgents.length > 0 && (
            <div className="text-dim mono" style={{ fontSize: 11, marginTop: 4 }}>
              待命: {idleAgents.map((a) => AGENT_DISPLAY[a.name] || a.name.toUpperCase()).join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* 返工 */}
      {snapshot.pendingRewrites.length > 0 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">返工</div>
          <Field label="队列" value={`[${snapshot.pendingRewrites.join(', ')}]`} highlight />
          {snapshot.rewriteReason && (
            <Field label="原因" value={snapshot.rewriteReason} />
          )}
        </div>
      )}

      {/* 干预 */}
      {snapshot.pendingSteer && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">干预</div>
          <Field label="待处理" value={snapshot.pendingSteer} highlight />
        </div>
      )}

      {/* 模型 */}
      {snapshot.provider && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">模型</div>
          <Field label="Provider" value={snapshot.provider} />
          {snapshot.modelName && <Field label="模型" value={snapshot.modelName} />}
        </div>
      )}

      {/* 用量 */}
      {(snapshot.totalInputTokens > 0 || snapshot.totalOutputTokens > 0 || snapshot.totalCostUSD > 0) && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">用量</div>
          <Field label="输入" value={formatTokensCompact(snapshot.totalInputTokens)} />
          <Field label="输出" value={formatTokensCompact(snapshot.totalOutputTokens)} />
          {snapshot.totalCostUSD > 0 && (
            <Field label="费用" value={`$${(snapshot.totalCostUSD).toFixed(2)}`} />
          )}
          {snapshot.totalSavedUSD > 0 && (
            <Field label="节省" value={`$${(snapshot.totalSavedUSD).toFixed(2)}`} />
          )}
        </div>
      )}

      {/* 缓存 */}
      {(snapshot.cacheReadTokens > 0 || snapshot.cacheWriteTokens > 0) && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">缓存</div>
          <Field label="读取" value={formatTokensCompact(snapshot.cacheReadTokens)} />
          <Field label="写入" value={formatTokensCompact(snapshot.cacheWriteTokens)} />
        </div>
      )}

      {/* 上下文 */}
      <div className="sidebar-section">
        <div className="sidebar-section-header">上下文</div>
        <Field label="占用" value={
          snapshot.contextWindow > 0
            ? `${snapshot.contextPercent.toFixed(0)}% · ${formatTokensCompact(snapshot.contextTokens)}/${formatTokensCompact(snapshot.contextWindow)}`
            : snapshot.contextTokens > 0
              ? `${formatTokensCompact(snapshot.contextTokens)} tokens`
              : '-'
        } />
      </div>
    </div>
  )
}
