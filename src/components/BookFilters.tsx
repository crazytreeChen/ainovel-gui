interface BookFiltersProps {
  viewMode: 'card' | 'detail'
  setViewMode: (v: 'card' | 'detail') => void
  onNewBook: () => void
  onImport: () => void
}

export default function BookFilters({ viewMode, setViewMode, onNewBook, onImport }: BookFiltersProps) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 4, marginRight: 8 }}>
        <button className={`welcome-mode-btn ${viewMode === 'card' ? 'active' : ''}`}
          onClick={() => setViewMode('card')} style={{ fontSize: 11, padding: '4px 10px' }}>▦ 卡片</button>
        <button className={`welcome-mode-btn ${viewMode === 'detail' ? 'active' : ''}`}
          onClick={() => setViewMode('detail')} style={{ fontSize: 11, padding: '4px 10px' }}>☰ 详情</button>
      </div>
      <button className="welcome-mode-btn" onClick={onNewBook}>+ 新建书籍</button>
      <button className="welcome-mode-btn" onClick={onImport} title="从外部文件夹导入已有 ainovel 作品">📂 导入目录</button>
    </div>
  )
}
