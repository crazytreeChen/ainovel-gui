import { useNavigate, useLocation } from 'react-router-dom'
import { useUIStore } from '@/stores/useUIStore'

interface NavItem {
  path: string
  label: string
  icon: string
  action?: 'pushExport'
}

export default function BookNavSidebar({ bookId }: { bookId: string }) {
  const navigate = useNavigate()
  const location = useLocation()
  const pushModal = useUIStore((s) => s.pushModal)

  const items: NavItem[] = [
    { path: `/books/${bookId}/workspace?mode=writing`, label: '创作工作台', icon: '⚡' },
    { path: `/books/${bookId}/intro`, label: '书籍简介/章节', icon: '📖' },
    { path: `/books/${bookId}/outline`, label: '大纲管理', icon: '📋' },
    { path: `/books/${bookId}/characters`, label: '角色管理', icon: '👤' },
    { path: `/books/${bookId}/timeline`, label: '时间线', icon: '⏳' },
    { path: `/books/${bookId}/reviews`, label: '质量审查', icon: '📊' },
    { path: `/books/${bookId}/simulation`, label: '仿写画像', icon: '🎨' },
    { path: `/books/${bookId}/rules`, label: '用户规则', icon: '📏' },
    { path: `/books/${bookId}/world`, label: '世界观/风格', icon: '🌍' },
    { path: `/books/${bookId}/summaries`, label: '摘要', icon: '📝' },
    { path: `/books/${bookId}/dashboard`, label: '写作统计', icon: '📊' },
    { path: '', label: '导出管理', icon: '📤', action: 'pushExport' },
  ]

  return (
    <div className="nav-sidebar">
      {/* 标题 */}
      <div className="nav-sidebar-header">
        <div className="nav-sidebar-title">📖 AI小说管理</div>
        <div className="nav-sidebar-subtitle">书籍导航</div>
      </div>

      {/* 导航项 */}
      <div className="nav-sidebar-items">
        {items.map((item) => {
          const isActive = (() => {
            // 导出管理是弹窗，没有路由，绝不能因为 path 为空误判为高亮
            if (item.action === 'pushExport' || !item.path) return false
            // 导航项 path 可能带 query（如 workspace?mode=writing），只按 pathname 匹配
            const itemPath = item.path.split('?')[0]
            const pathname = location.pathname
            if (pathname === itemPath) return true
            if (pathname.startsWith(itemPath + '/')) return true
            // 章节详情页归入「书籍简介/章节」
            if (itemPath.endsWith('/intro') && pathname.startsWith(`/books/${bookId}/chapters`)) return true
            return false
          })()
          return (
            <div
              key={item.path || item.label}
              className="nav-sidebar-item cursor-clickable"
              onClick={() => {
                if (item.action === 'pushExport') {
                  pushModal('export', { id: bookId })
                } else {
                  navigate(item.path)
                }
              }}
              style={{
                background: isActive ? 'var(--color-surface-2)' : 'transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                borderLeft: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
              }}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          )
        })}
      </div>

      {/* 底部 */}
      <div className="nav-sidebar-footer">
        <div
          className="cursor-clickable text-dim nav-sidebar-item"
          style={{ padding: '6px 8px' }}
          onClick={() => navigate('/')}
        >
          <span>←</span>
          <span>返回书籍列表</span>
        </div>
      </div>
    </div>
  )
}
