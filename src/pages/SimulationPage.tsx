import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import SimOverview from '@/components/SimOverview'
import SimSources from '@/components/SimSources'
import SimSynthesis from '@/components/SimSynthesis'
import type { SimulationProfile } from '@/types/simulation'

export default function SimulationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<SimulationProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'sources' | 'synthesis'>('overview')

  useEffect(() => { loadProfile() }, [id])

  async function loadProfile() {
    if (!id || !window.electronAPI) return
    setLoading(true)
    const data = await window.electronAPI.getSimulationProfile(id)
    setProfile(data || null)
    setLoading(false)
  }

  async function handleRunSimulate() {
    if (!window.electronAPI) return
    await window.electronAPI.runSimulate(id || '')
    setTimeout(loadProfile, 3000)
  }

  function formatDate(s: string) {
    if (!s) return '-'
    try { return new Date(s).toLocaleString('zh-CN') } catch { return s }
  }

  if (loading) return <div className="text-dim" style={{ padding: 32 }}>加载中...</div>

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
          <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回</button>
          <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>仿写画像</h2>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="welcome-mode-btn active" onClick={handleRunSimulate}>
              运行 /simulate
            </button>
          </div>
        </div>

        {!profile ? (
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 60, textAlign: 'center' }}>
            <div className="text-dim" style={{ fontSize: 14, marginBottom: 8 }}>尚未生成仿写画像</div>
            <div className="text-dim" style={{ fontSize: 12 }}>需要先运行 ainovel-cli 的 /simulate 命令生成数据</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12, flexShrink: 0, padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              <span className="text-dim">{profile.version || 'v1'}</span>
              <span className="text-dim">创建: {formatDate(profile.createdAt)}</span>
              {profile.updatedAt && <span className="text-dim">更新: {formatDate(profile.updatedAt)}</span>}
              <span className="text-dim">语料: {profile.corpus?.sources?.length || 0} 篇</span>
              {profile.corpus?.sourceDir && <span className="text-dim">来源: {profile.corpus.sourceDir}</span>}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0 }}>
              {([
                ['overview', '概览'],
                ['sources', `语料分析 (${profile.sourceReports?.length || 0})`],
                ['synthesis', '综合画像'],
              ] as const).map(([k, label]) => (
                <button key={k} className={`welcome-mode-btn ${tab === k ? 'active' : ''}`}
                  onClick={() => setTab(k)} style={{ fontSize: 11 }}>{label}</button>
              ))}
            </div>

            <div style={{ flex: 1, overflow: 'auto' }}>
              {tab === 'overview' && <SimOverview profile={profile} />}
              {tab === 'sources' && <SimSources profile={profile} />}
              {tab === 'synthesis' && <SimSynthesis profile={profile} />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
