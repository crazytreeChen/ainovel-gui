import { useAppStore } from '@/stores/useAppStore'

export default function Welcome() {
  const startupMode = useAppStore((s) => s.startupMode)
  const setStartupMode = useAppStore((s) => s.setStartupMode)
  const setInputValue = useAppStore((s) => s.setInputValue)

  const examples = [
    '写一部 12 章都市悬疑小说，主角是一名女法医',
    '创作一部仙侠长篇，主角从凡人修炼至飞升',
    '写一个科幻短篇，讲述 AI 觉醒后的伦理困境',
  ]

  return (
    <div className="welcome-container">
      <div className="welcome-title">A I N O V E L</div>
      <div className="welcome-subtitle">AI-Powered Novel Creation Engine</div>
      <hr className="welcome-divider" />

      {/* 特性展示 */}
      <div className="welcome-features">
        <div className="welcome-feature">
          <div className="welcome-feature-icon">&gt;&gt;</div>
          <div className="welcome-feature-title">多模型协作</div>
          <div className="welcome-feature-desc">Architect 规划 / Writer 创作 / Editor 审阅</div>
        </div>
        <div className="welcome-feature">
          <div className="welcome-feature-icon">::</div>
          <div className="welcome-feature-title">断点恢复</div>
          <div className="welcome-feature-desc">崩溃或中断后从上次进度自动续写</div>
        </div>
        <div className="welcome-feature">
          <div className="welcome-feature-icon">&lt;&gt;</div>
          <div className="welcome-feature-title">实时干预</div>
          <div className="welcome-feature-desc">创作过程中随时调整剧情走向</div>
        </div>
        <div className="welcome-feature">
          <div className="welcome-feature-icon">##</div>
          <div className="welcome-feature-title">分层长篇</div>
          <div className="welcome-feature-desc">支持卷-弧-章分层结构的长篇创作</div>
        </div>
      </div>

      <hr className="welcome-divider" />

      {/* 启动模式切换 */}
      <div className="welcome-mode-bar">
        <button
          className={`welcome-mode-btn ${startupMode === 'quick' ? 'active' : ''}`}
          onClick={() => setStartupMode('quick')}
        >
          快速开始 · 一句话直接创作
        </button>
        <button
          className={`welcome-mode-btn ${startupMode === 'cocreate' ? 'active' : ''}`}
          onClick={() => setStartupMode('cocreate')}
        >
          共创规划 · 多轮对话澄清需求
        </button>
      </div>
      <div className="text-dim" style={{ fontSize: 12, fontFamily: 'var(--font-mono)', marginBottom: 16 }}>
        {startupMode === 'quick'
          ? '输入一句话需求，Enter 直接开始创作'
          : '与 AI 多轮对话整理创作指令，Ctrl+S 开始创作'}
      </div>

      {/* 示例 */}
      <div className="welcome-examples">
        <div className="text-dim" style={{ marginBottom: 4 }}>示例：</div>
        {examples.map((ex, i) => (
          /* index acceptable: static constant array, never changes */
          <div
            key={i}
            className="welcome-example"
            onClick={() => setInputValue(ex)}
          >
            . {ex}
          </div>
        ))}
      </div>
    </div>
  )
}
