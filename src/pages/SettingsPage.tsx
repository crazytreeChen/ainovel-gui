import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'
import type { ThemeMode } from '@/stores/useAppStore'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [dataDir, setDataDir] = useState('')
  const [binaryInfo, setBinaryInfo] = useState<{ available: boolean; version: string; path: string } | null>(null)
  const theme = useAppStore(s => s.theme)
  const setTheme = useAppStore(s => s.setTheme)

  // 更新状态
  const [updateChecking, setUpdateChecking] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadPath, setDownloadPath] = useState('')
  const [updateError, setUpdateError] = useState('')

  useEffect(() => {
    async function load() {
      if (!window.electronAPI) return
      const dir = await window.electronAPI.getGuiDataDir()
      setDataDir(dir)
      const bin = await window.electronAPI.checkBinary()
      setBinaryInfo(bin)
    }
    load()
  }, [])

  // 监听下载进度
  useEffect(() => {
    if (!window.electronAPI) return
    const cleanup = window.electronAPI.onDownloadProgress((data: any) => {
      setDownloadProgress(data.percent || 0)
    })
    return cleanup
  }, [])

  async function handleCheckUpdate() {
    if (!window.electronAPI) return
    setUpdateChecking(true)
    setUpdateError('')
    setUpdateInfo(null)
    try {
      const result = await window.electronAPI.checkUpdate()
      setUpdateInfo(result)
      if (result?.error) setUpdateError(result.error)
    } catch (e: any) {
      setUpdateError(e.message || '检查失败')
    }
    setUpdateChecking(false)
  }

  async function handleDownload() {
    if (!window.electronAPI || !updateInfo?.url) return
    setDownloading(true)
    setDownloadProgress(0)
    setUpdateError('')
    try {
      const result = await window.electronAPI.downloadUpdate(updateInfo.url, updateInfo.sha256 || '')
      if (result?.success) {
        setDownloadPath(result.path)
      } else {
        setUpdateError(result?.error || '下载失败')
      }
    } catch (e: any) {
      setUpdateError(e.message || '下载失败')
    }
    setDownloading(false)
  }

  async function handleInstall() {
    if (!window.electronAPI || !downloadPath) return
    await window.electronAPI.installUpdate(downloadPath)
  }

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="welcome-mode-btn" onClick={() => navigate('/')}>← 返回</button>
        <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>系统设置</h2>
      </div>

      {/* 数据存储 */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
        <div className="sidebar-section-header" style={{ marginBottom: 8 }}>数据存储</div>
        <div className="text-dim mono" style={{ fontSize: 12 }}>{dataDir || '~/.ainovel-gui/'}</div>
        <div style={{ marginTop: 6, fontSize: 11, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span className="text-dim">数据库: ~9.7 MB</span>
          <span className="text-dim">· 1 本书</span>
          <span className="text-dim">· 3,038 条记录</span>
        </div>
        <div className="text-dim" style={{ fontSize: 11, marginTop: 6 }}>
          💡 所有数据保存在 SQLite 中，可直接复制迁移
        </div>
      </div>

      {/* ainovel-cli 状态 */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
        <div className="sidebar-section-header" style={{ marginBottom: 8 }}>AI写作引擎</div>
        {binaryInfo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: binaryInfo.available ? '#7ec488' : '#e07060',
            }} />
            <span className={binaryInfo.available ? 'text-success' : 'text-error'} style={{ fontWeight: 'bold', fontSize: 13 }}>
              {binaryInfo.available ? 'ainovel-cli 已就绪' : '未检测到 ainovel-cli'}
            </span>
            <span className="text-dim" style={{ fontSize: 11 }}>v{binaryInfo.version || '-'}</span>
          </div>
        ) : (
          <div className="text-dim" style={{ fontSize: 12 }}>检测中...</div>
        )}
        <div className="text-dim mono" style={{ fontSize: 11, marginTop: 4 }}>路径: {binaryInfo?.path || '-'}</div>

        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)', fontSize: 12, lineHeight: 1.8 }}>
          <div className="text-dim" style={{ fontSize: 11, marginBottom: 4 }}>功能概览：</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            {([
              ['📚', '书籍管理', true] as const,
              ['📋', '大纲编辑', true] as const,
              ['✍️', '章节管理', true] as const,
              ['👤', '角色管理', true] as const,
              ['⏳', '时间线', true] as const,
              ['📊', '评审管理', true] as const,
              ['🤖', 'AI 写作', !!binaryInfo?.available] as const,
              ['🔍', '诊断', !!binaryInfo?.available] as const,
              ['📦', '导出', !!binaryInfo?.available] as const,
            ]).map(([icon, label, ok]) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <span style={{ color: ok ? '#7ec488' : '#e07060' }}>{ok ? '●' : '○'}</span>
                <span className="text-dim">{icon} {label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 版本更新 */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
        <div className="sidebar-section-header" style={{ marginBottom: 8 }}>版本更新</div>
        <div className="text-dim mono" style={{ fontSize: 12, marginBottom: 8 }}>当前版本: v0.2.0</div>

        <button
          className="welcome-mode-btn active"
          onClick={handleCheckUpdate}
          disabled={updateChecking || downloading}
          style={{ fontSize: 12, marginBottom: 8 }}
        >
          {updateChecking ? '检查中...' : '📥 检查更新'}
        </button>

        {updateError && (
          <div className="text-error" style={{ fontSize: 11, marginBottom: 6 }}>{updateError}</div>
        )}

        {updateInfo?.available && (
          <div style={{ marginTop: 8, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
            <div className="text-success" style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>
              v{updateInfo.latestVersion} 可用
            </div>
            {updateInfo.releaseDate && (
              <div className="text-dim" style={{ fontSize: 11, marginBottom: 6 }}>发布日期: {updateInfo.releaseDate}</div>
            )}
            {updateInfo.notes && (
              <div className="text-dim" style={{ fontSize: 11, lineHeight: 1.5, marginBottom: 8, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>
                {updateInfo.notes}
              </div>
            )}
            {!downloadPath ? (
              <button
                className="welcome-mode-btn active"
                onClick={handleDownload}
                disabled={downloading}
                style={{ fontSize: 12 }}
              >
                {downloading ? `下载中 ${downloadProgress}%` : '⬇ 下载更新'}
              </button>
            ) : (
              <div>
                <div className="text-success" style={{ fontSize: 11, marginBottom: 6 }}>✅ 已下载: {downloadPath.split('/').pop()}</div>
                <button className="welcome-mode-btn active" onClick={handleInstall} style={{ fontSize: 12 }}>
                  ▶ 安装更新
                </button>
              </div>
            )}
            {downloading && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 6, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${downloadProgress}%`, background: 'var(--color-accent)', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <div className="text-dim" style={{ fontSize: 10, marginTop: 2, textAlign: 'right' }}>{downloadProgress}%</div>
              </div>
            )}
          </div>
        )}

        {updateInfo && !updateInfo.available && !updateInfo.error && (
          <div className="text-success" style={{ fontSize: 12 }}>✅ 已是最新版本</div>
        )}
      </div>

      {/* 界面主题 */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
        <div className="sidebar-section-header" style={{ marginBottom: 8 }}>界面主题</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {([['dark', '暗黑'], ['light', '明亮'], ['system', '跟随系统']] as [ThemeMode, string][]).map(([key, label]) => (
            <button key={key}
              className={`welcome-mode-btn ${theme === key ? 'active' : ''}`}
              onClick={() => setTheme(key)}
              style={{ fontSize: 12 }}
            >{label}</button>
          ))}
        </div>
      </div>
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16 }}>
        <div className="sidebar-section-header" style={{ marginBottom: 8 }}>快捷导航</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Link to="/settings/models" style={{ color: 'var(--color-accent2)', textDecoration: 'none', fontSize: 13 }}>→ 模型管理（配置 Provider）</Link>
        </div>
      </div>

      <div className="text-dim" style={{ fontSize: 11, marginTop: 16, textAlign: 'center' }}>
        <div className="mono">AINovel GUI v0.2.0</div>
      </div>
    </div>
  )
}
