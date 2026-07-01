import { useNavigate, useLocation } from 'react-router-dom'

interface NavItem {
  path: string
  label: string
  icon: string
}

export default function BookNavSidebar({ bookId }: { bookId: string }) {
  const navigate = useNavigate()
  const location = useLocation()

  const items: NavItem[] = [
    { path: `/books/${bookId}`, label: '创作工作台', icon: '⚡' },
    { path: `/books/${bookId}/outline`, label: '大纲管理', icon: '📋' },
    { path: `/books/${bookId}/characters`, label: '角色管理', icon: '👤' },
    { path: `/books/${bookId}/timeline`, label: '时间线', icon: '⏳' },
    { path: `/books/${bookId}/reviews`, label: '评审管理', icon: '📊' },
    { path: `/books/${bookId}/simulation`, label: '仿写画像', icon: '🎨' },
    { path: `/books/${bookId}/rules`, label: '用户规则', icon: '📏' },
    { path: `/books/${bookId}/world`, label: '世界观/风格', icon: '🌍' },
  ]

  return (
    <div style={{
      width: 160, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--color-border)', background: 'var(--color-surface)',
      padding: '12px 0', overflow: 'auto',
    }}>
      {/* 标题 */}
      <div style={{
        padding: '0 14px 12px', borderBottom: '1px solid var(--color-border)',
        marginBottom: 8, fontSize: 11, fontFamily: 'var(--font-mono)',
        color: 'var(--color-dim)', letterSpacing: 1,
      }}>
        <div className="text-accent" style={{ fontWeight: 'bold', fontSize: 13 }}>📖 AINOVEL</div>
        <div style={{ fontSize: 10, marginTop: 2 }}>书籍导航</div>
      </div>

      {/* 导航项 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== `/books/${bookId}` && location.pathname.startsWith(item.path))
          return (
            <div
              key={item.path}
              className="cursor-clickable"
              onClick={() => navigate(item.path)}
              style={{
                padding: '8px 14px', margin: '0 6px', borderRadius: 'var(--radius-sm)',
                cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8,
                background: isActive ? 'var(--color-surface-2)' : 'transparent',
                color: isActive ? 'var(--color-accent)' : 'var(--color-text)',
                borderLeft: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--color-surface-2)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          )
        })}
      </div>

      {/* 底部 */}
      <div style={{
        padding: '8px 14px', borderTop: '1px solid var(--color-border)', marginTop: 8,
      }}>
        <div
          className="cursor-clickable text-dim"
          onClick={() => navigate('/')}
          style={{
            padding: '6px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            fontSize: 11, display: 'flex', alignItems: 'center', gap: 6,
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-text)'; e.currentTarget.style.background = 'var(--color-surface-2)' }}
          onMouseLeave={e => { e.currentTarget.style.color = ''; e.currentTarget.style.background = 'transparent' }}
        >
          <span>←</span>
          <span>返回书籍列表</span>
        </div>
      </div>
    </div>
  )
}
