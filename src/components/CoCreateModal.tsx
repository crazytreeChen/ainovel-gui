import { useAppStore } from '@/stores/useAppStore'

export default function CoCreateModal() {
  const toggleCoCreate = useAppStore((s) => s.toggleCoCreate)
  const setInputValue = useAppStore((s) => s.setInputValue)

  const suggestions = [
    '我想写一部现代都市背景的悬疑小说',
    '主角是一名退役刑警，性格沉稳',
    '我希望故事节奏紧凑，每章都有反转',
  ]

  return (
    <div className="modal-overlay" onClick={toggleCoCreate}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 600, minHeight: 400, display: 'flex', flexDirection: 'column' }}
      >
        <button className="modal-close" onClick={toggleCoCreate}>✕</button>
        <div className="modal-title">共创规划</div>

        <div
          style={{
            flex: 1,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: 12,
            marginBottom: 12,
            minHeight: 200,
            maxHeight: 300,
            overflow: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <div className="text-dim" style={{ marginBottom: 8 }}>
            ✎ AI：你好！我来帮你规划小说创作。请告诉我你的想法——比如题材、背景、主角设定，或者任何你感兴趣的元素。
          </div>
          <div className="text-dim" style={{ marginBottom: 8 }}>
            你可以按数字键 1/2/3 快速填入建议，或者直接输入你的想法。
          </div>

          {/* 建议 */}
          <div style={{ marginTop: 16 }}>
            <div className="text-muted" style={{ marginBottom: 4 }}>建议方向：</div>
            {suggestions.map((s, i) => (
              /* index acceptable: static constant array, never changes */
              <div
                key={i}
                className="text-accent cursor-clickable"
                style={{ padding: '2px 0', cursor: 'pointer' }}
                onClick={() => setInputValue(s)}
              >
                [{i + 1}] {s}
              </div>
            ))}
          </div>
        </div>

        <div className="text-dim" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          Enter 发送 · 数字键 1-3 快速填入建议 · Ctrl+S 保存并开始创作 · Esc 退出
        </div>
      </div>
    </div>
  )
}
