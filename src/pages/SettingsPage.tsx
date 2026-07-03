import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'
import type { ThemeMode } from '@/stores/useAppStore'
import { showToast } from '@/components/Toast'
import BackButton from '@/components/BackButton'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [dataDir, setDataDir] = useState('')
  const [binaryInfo, setBinaryInfo] = useState<{ available: boolean; version: string; path: string } | null>(null)
  const theme = useAppStore(s => s.theme)
  const setTheme = useAppStore(s => s.setTheme)

  const [updateChecking, setUpdateChecking] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<any>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadPath, setDownloadPath] = useState('')
  const [updateError, setUpdateError] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [restoreBusy, setRestoreBusy] = useState(false)
  const [backupMsg, setBackupMsg] = useState('')
  const [restoreMsg, setRestoreMsg] = useState('')
  const [dailyGoal, setDailyGoal] = useState(2000)
  const [weeklyGoal, setWeeklyGoal] = useState(10000)
  const [goalLoaded, setGoalLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      if (!window.electronAPI) return
      const dir = await window.electronAPI.getGuiDataDir()
      setDataDir(dir)
      const bin = await window.electronAPI.checkBinary()
      setBinaryInfo(bin)
      // 加载写作目标
      const dg = await window.electronAPI.loadConfigValue('writing_daily_goal')
      if (dg) setDailyGoal(dg)
      const wg = await window.electronAPI.loadConfigValue('writing_weekly_goal')
      if (wg) setWeeklyGoal(wg)
      setGoalLoaded(true)
    }
    load()
  }, [])

  async function handleSaveGoal() {
    if (!window.electronAPI) return
    await window.electronAPI.saveConfigValue('writing_daily_goal', dailyGoal)
    await window.electronAPI.saveConfigValue('writing_weekly_goal', weeklyGoal)
    showToast('写作目标已保存', 'success')
  }

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
        setDownloadPath(result.path || '')
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

  async function handleBackup() {
    if (!window.electronAPI) return
    setBackupBusy(true)
    setBackupMsg('')
    try {
      const result = await window.electronAPI.backupData()
      if (result.success) setBackupMsg(`✅ 已备份到: ${result.path}`)
      else setBackupMsg(`❌ ${result.error}`)
    } catch (e: any) { setBackupMsg(`❌ ${e.message}`) }
    setBackupBusy(false)
  }

  async function handleRestore() {
    if (!window.electronAPI) return
    if (!confirm('⚠️ 恢复数据将覆盖当前所有数据，确认继续？')) return
    setRestoreBusy(true)
    setRestoreMsg('')
    try {
      const result = await window.electronAPI.restoreData()
      if (result.success) setRestoreMsg('✅ 数据已恢复，建议重启应用')
      else setRestoreMsg(`❌ ${result.error}`)
    } catch (e: any) { setRestoreMsg(`❌ ${e.message}`) }
    setRestoreBusy(false)
  }

  return (
    <div className="scroll-y p-24" style={{ maxWidth: 640, margin: '0 auto', height: '100vh' }}>
      <div className="flex-row items-center gap-12 mb-24">
        <BackButton to="/" />
        <h2 className="mono text-accent m-0 text-lg">系统设置</h2>
      </div>

      {/* 数据存储 */}
      <div className="card mb-12">
        <div className="sidebar-section-header mb-8">数据存储</div>
        <div className="text-dim mono text-sm">{dataDir || '~/.ainovel-gui/'}</div>
        <div className="mt-8 text-xs flex-row gap-12 flex-wrap">
          <span className="text-dim">数据库: ~9.7 MB</span>
          <span className="text-dim">· 1 本书</span>
          <span className="text-dim">· 3,038 条记录</span>
        </div>
        <div className="text-dim text-xs mt-8">
          💡 所有数据保存在 SQLite 中，可直接复制迁移
        </div>
      </div>

      {/* ainovel-cli 状态 */}
      <div className="card mb-12">
        <div className="sidebar-section-header mb-8">AI写作引擎</div>
        {binaryInfo ? (
          <div className="flex-row items-center gap-8 mb-8">
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: binaryInfo.available ? '#7ec488' : '#e07060' }} />
            <span className={binaryInfo.available ? 'text-success' : 'text-error'} style={{ fontWeight: 'bold', fontSize: 13 }}>
              {binaryInfo.available ? 'ainovel-cli 已就绪' : '未检测到 ainovel-cli'}
            </span>
            <span className="text-dim text-xs">v{binaryInfo.version || '-'}</span>
          </div>
        ) : (
          <div className="text-dim text-sm">检测中...</div>
        )}
        <div className="text-dim mono text-xs mt-8">路径: {binaryInfo?.path || '-'}</div>

        <div className="mt-10" style={{ paddingTop: 10, borderTop: '1px solid var(--color-border)', fontSize: 12, lineHeight: 1.8 }}>
          <div className="text-dim text-xs mb-8">功能概览：</div>
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
              <span key={label} className="flex-row items-center gap-3">
                <span style={{ color: ok ? '#7ec488' : '#e07060' }}>{ok ? '●' : '○'}</span>
                <span className="text-dim">{icon} {label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 版本更新 */}
      <div className="card mb-12">
        <div className="sidebar-section-header mb-8">版本更新</div>
        <div className="text-dim mono text-sm mb-8">当前版本: v{__APP_VERSION__}</div>

        <button className="welcome-mode-btn active text-sm mb-8"
          onClick={handleCheckUpdate}
          disabled={updateChecking || downloading}>
          {updateChecking ? '检查中...' : '📥 检查更新'}
        </button>

        {updateError && (
          <div className="text-error text-xs mb-8">{updateError}</div>
        )}

        {updateInfo?.available && (
          <div className="mt-8" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
            <div className="text-success" style={{ fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>
              v{updateInfo.latestVersion} 可用
            </div>
            {updateInfo.releaseDate && (
              <div className="text-dim text-xs mb-8">发布日期: {updateInfo.releaseDate}</div>
            )}
            {updateInfo.notes && (
              <div className="text-dim text-xs mb-8" style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>
                {updateInfo.notes}
              </div>
            )}
            {!downloadPath ? (
              <button className="welcome-mode-btn active text-sm"
                onClick={handleDownload}
                disabled={downloading}>
                {downloading ? `下载中 ${downloadProgress}%` : '⬇ 下载更新'}
              </button>
            ) : (
              <div>
                <div className="text-success text-xs mb-8">✅ 已下载: {downloadPath.split('/').pop()}</div>
                <button className="welcome-mode-btn active text-sm" onClick={handleInstall}>
                  ▶ 安装更新
                </button>
              </div>
            )}
            {downloading && (
              <div className="mt-8">
                <div style={{ height: 6, background: 'var(--color-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${downloadProgress}%`, background: 'var(--color-accent)', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <div className="text-dim text-xs mt-4 text-right">{downloadProgress}%</div>
              </div>
            )}
          </div>
        )}

        {updateInfo && !updateInfo.available && !updateInfo.error && (
          <div className="text-success text-sm">✅ 已是最新版本</div>
        )}
      </div>

      {/* 数据备份与恢复 */}
      <div className="card mb-12">
        <div className="sidebar-section-header mb-8">💾 数据备份与恢复</div>
        <div className="text-dim text-xs mb-8">
          导出当前所有数据为 ZIP 压缩包，或从备份 ZIP 恢复
        </div>
        <div className="flex-row gap-8">
          <button className="welcome-mode-btn active text-sm"
            onClick={handleBackup} disabled={backupBusy}>
            {backupBusy ? '导出中...' : '📤 导出数据快照'}
          </button>
          <button className="welcome-mode-btn text-sm"
            onClick={handleRestore} disabled={restoreBusy}
            style={{ color: 'var(--color-error)' }}>
            {restoreBusy ? '恢复中...' : '📥 从快照恢复'}
          </button>
        </div>
        {backupMsg && <div className="text-xs mt-8" style={{ color: backupMsg.startsWith('✅') ? 'var(--color-success)' : 'var(--color-error)' }}>{backupMsg}</div>}
        {restoreMsg && <div className="text-xs mt-8" style={{ color: restoreMsg.startsWith('✅') ? 'var(--color-success)' : 'var(--color-error)' }}>{restoreMsg}</div>}
        {backupMsg && backupMsg.includes('已备份') && (
          <div className="text-dim text-xs mt-8">
            💡 ZIP 文件包含 ainovel-gui/ 目录下的所有数据（数据库 + 书籍文件）
          </div>
        )}
      </div>

      {/* 写作目标 */}
      {goalLoaded && (
        <div className="card mb-12">
          <div className="sidebar-section-header mb-8">🎯 写作目标</div>
          <div className="flex-row gap-16 items-center">
            <div>
              <div className="text-dim text-xs mb-4">每日目标（字）</div>
              <input type="number" value={dailyGoal}
                onChange={e => setDailyGoal(Math.max(100, parseInt(e.target.value) || 0))}
                className="input-field" style={{ width: 120, padding: '6px 8px' }} min={100} step={100} />
            </div>
            <div>
              <div className="text-dim text-xs mb-4">每周目标（字）</div>
              <input type="number" value={weeklyGoal}
                onChange={e => setWeeklyGoal(Math.max(500, parseInt(e.target.value) || 0))}
                className="input-field" style={{ width: 120, padding: '6px 8px' }} min={500} step={500} />
            </div>
            <button className="welcome-mode-btn active text-sm mt-16" onClick={handleSaveGoal}>保存目标</button>
          </div>
          <div className="text-dim text-xs mt-8">
            💡 目标数据保存在本地，在工作台侧栏可查看进度
          </div>
        </div>
      )}

      {/* 界面主题 */}
      <div className="card mb-12">
        <div className="sidebar-section-header mb-8">界面主题</div>
        <div className="flex-row gap-8">
          {([['dark', '暗黑'], ['light', '明亮'], ['system', '跟随系统']] as [ThemeMode, string][]).map(([key, label]) => (
            <button key={key} className={`welcome-mode-btn text-sm ${theme === key ? 'active' : ''}`}
              onClick={() => setTheme(key)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="card mb-12">
        <div className="sidebar-section-header mb-8">快捷导航</div>
        <div className="flex-col gap-4">
          <Link to="/settings/models" style={{ color: 'var(--color-accent2)', textDecoration: 'none', fontSize: 13 }}>→ 模型管理（配置 Provider）</Link>
        </div>
      </div>

      <div className="text-dim text-xs mt-16 text-center">
        <div className="mono">AINovel GUI v{__APP_VERSION__}</div>
      </div>
    </div>
  )
}
