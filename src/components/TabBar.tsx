/**
 * 通用 Tab 切换栏 — 统一 6 个页面中的内联 tab 渲染模式
 */
export interface TabDef {
  key: string
  label: string
}

type TabItem = readonly [string, string] | TabDef

interface TabBarProps {
  tabs: readonly TabItem[]
  active: string
  onSelect: (key: string) => void
  className?: string
  style?: React.CSSProperties
}

function isTuple(t: TabItem): t is readonly [string, string] {
  return Array.isArray(t)
}

function getKey(item: TabItem): string {
  return isTuple(item) ? item[0] : item.key
}

function getLabel(item: TabItem): string {
  return isTuple(item) ? item[1] : item.label
}

export default function TabBar({ tabs, active, onSelect, className = 'mb-16 flex-row gap-6', style }: TabBarProps) {
  return (
    <div className={className} style={style}>
      {tabs.map((item) => {
        const k = getKey(item)
        const label = getLabel(item)
        return (
          <button
            key={k}
            className={`welcome-mode-btn text-xs ${active === k ? 'active' : ''}`}
            onClick={() => onSelect(k)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}
