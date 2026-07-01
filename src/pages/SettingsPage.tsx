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

  return (
    <div style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button className="welcome-mode-btn" onClick={() => navigate('/')}>← 返回</button>
        <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>系统设置</h2>
      </div>

      {/* 数据目录 */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
        <div className="sidebar-section-header" style={{ marginBottom: 8 }}>数据目录</div>
        <div className="text-dim mono" style={{ fontSize: 12 }}>{dataDir || '~/.ainovel-gui/'}</div>
        <div className="text-dim" style={{ fontSize: 11, marginTop: 6 }}>
          📁 所有书籍数据保存在此目录，可直接复制迁移
        </div>
      </div>

      {/* ainovel-cli 状态 */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 12 }}>
        <div className="sidebar-section-header" style={{ marginBottom: 8 }}>AI 写作引擎</div>
        {binaryInfo ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: binaryInfo.available ? '#7ec488' : '#e07060',
              }} />
              <span className={binaryInfo.available ? 'text-success' : 'text-error'} style={{ fontWeight: 'bold', fontSize: 13 }}>
                {binaryInfo.available ? 'ainovel-cli 已就绪' : '未检测到 ainovel-cli'}
              </span>
            </div>
            {binaryInfo.version && (
              <div className="text-dim mono" style={{ fontSize: 12, marginLeft: 16 }}>版本: {binaryInfo.version}</div>
            )}
            <div className="text-dim mono" style={{ fontSize: 12, marginLeft: 16 }}>路径: {binaryInfo.path || '-'}</div>
          </>
        ) : (
          <div className="text-dim" style={{ fontSize: 12 }}>检测中...</div>
        )}

        {/* 功能对照表 */}
        <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
          <div className="text-dim" style={{ fontSize: 11, marginBottom: 6 }}>功能依赖说明：</div>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
            <thead>
              <tr className="text-muted">
                <th style={{ textAlign: 'left', padding: '2px 4px', borderBottom: '1px solid var(--color-border)' }}>功能</th>
                <th style={{ textAlign: 'center', padding: '2px 4px', borderBottom: '1px solid var(--color-border)' }}>需要 ainovel-cli</th>
                <th style={{ textAlign: 'left', padding: '2px 4px', borderBottom: '1px solid var(--color-border)' }}>说明</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['书籍管理', '❌', '完全独立'],
                ['大纲编辑', '❌', '完全独立'],
                ['章节管理', '❌', '完全独立'],
                ['角色管理', '❌', '完全独立'],
                ['时间线管理', '❌', '完全独立'],
                ['评审管理', '❌', '完全独立'],
                ['AI 写作创作', '✅', '需要 ainovel-cli 作为引擎'],
                ['诊断 /diag', '✅', '需要 ainovel-cli 运行诊断'],
                ['导出 /export', '✅', '需要 ainovel-cli 执行导出'],
              ].map(([feature, need, note]) => (
                <tr key={feature} className="text-dim">
                  <td style={{ padding: '2px 4px', borderBottom: '1px solid var(--color-border)' }}>{feature}</td>
                  <td style={{ textAlign: 'center', padding: '2px 4px', borderBottom: '1px solid var(--color-border)' }}>{need}</td>
                  <td style={{ padding: '2px 4px', borderBottom: '1px solid var(--color-border)' }}>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 快捷导航 */}
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
        <div className="mono">AINovel GUI v0.1.0</div>
      </div>
    </div>
  )
}
