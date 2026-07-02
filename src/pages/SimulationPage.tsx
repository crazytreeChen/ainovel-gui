import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'

// ── 类型定义 ──

interface SimulationSource { relativePath: string; title: string; sizeBytes: number }

interface SimulationSourceReport {
  relativePath: string; sha256: string; title: string; summary: string
  styleObservations: string[]; commonWords: string[]; plotPatterns: string[]
  hookPatterns: string[]; pacingNotes: string[]; readerAppeal: string[]
  reusableTechniques: string[]; warnings: string[]
}

type SynthesisKey = 'style' | 'lexicon' | 'plotDesign' | 'hookDesign' | 'pacingDensity' | 'readerEngagement' | 'roleGuidance'

interface SimulationProfile {
  version: string; createdAt: string; updatedAt: string
  corpus: { sourceDir: string; sources: SimulationSource[] }
  sourceReports: SimulationSourceReport[]
  synthesis?: Record<SynthesisKey, Record<string, string[]>>
}

// ── 分类元数据 ──

const SYNTHESIS_TABS: ReadonlyArray<{ key: SynthesisKey; label: string; color: string }> = [
  { key: 'style', label: '风格', color: '#7ec5d8' },
  { key: 'lexicon', label: '词汇', color: '#7ec488' },
  { key: 'plotDesign', label: '情节设计', color: '#e09b5a' },
  { key: 'hookDesign', label: '钩子设计', color: '#e5b449' },
  { key: 'pacingDensity', label: '节奏密度', color: '#a890d8' },
  { key: 'readerEngagement', label: '读者互动', color: '#e07060' },
  { key: 'roleGuidance', label: 'Agent 指南', color: '#5fb8a3' },
]

const FIELD_LABELS: Record<string, Record<string, string>> = {
  style: { narrativeVoice: '叙事视角', sentenceRhythm: '句子节奏', proseTexture: '描写质感', perspective: '视点', mood: '情绪基调', doNotCopy: '禁止模仿' },
  lexicon: { commonWords: '常用词汇', emotionWords: '情感词汇', sceneWords: '场景词汇', transitionWords: '过渡表达', signaturePhrases: '标志短语' },
  plotDesign: { openingPatterns: '开篇模式', escalationPatterns: '升级模式', turningPointPatterns: '转折模式', payoffPatterns: '收束模式' },
  hookDesign: { hookTypes: '钩子类型', placement: '放置位置', cliffhangerPatterns: '悬念模式', payoffRules: '收束规则' },
  pacingDensity: { sceneDensity: '场景密度', informationRelease: '信息释放', dialogueActionRatio: '对白动作比', compressionRules: '压缩规则' },
  readerEngagement: { methods: '方法', emotionalDrivers: '情感驱动', progressionRewards: '进度奖励', antiPatterns: '反模式' },
  roleGuidance: { coordinator: '协调 Agent', architect: '架构 Agent', writer: '写作 Agent', editor: '编辑 Agent' },
}

// ── 辅助组件 ──

function TagList({ items, color }: { items: string[]; color: string }) {
  if (!items || items.length === 0) return <span className="text-dim" style={{ fontSize: 12 }}>（无）</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {items.map((item, i) => (
        <span key={i} style={{
          padding: '2px 8px', background: `${color}15`, color,
          borderRadius: 'var(--radius-sm)', fontSize: 12, lineHeight: 1.6,
        }}>{item}</span>
      ))}
    </div>
  )
}

function SectionCard({ title, children, borderColor }: { title: string; children: React.ReactNode; borderColor?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)', border: `1px solid ${borderColor || 'var(--color-border)'}`,
      borderRadius: 'var(--radius)', padding: 14, marginBottom: 10,
    }}>
      <div className="sidebar-section-header" style={{ marginBottom: 8, fontSize: 12 }}>{title}</div>
      {children}
    </div>
  )
}

// ── 主页面 ──

export default function SimulationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<SimulationProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'sources' | 'synthesis'>('overview')
  const [synthTab, setSynthTab] = useState('style')
  const [expandedSource, setExpandedSource] = useState<number | null>(null)

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
    // 重新加载
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
      {/* 导航 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回</button>
        <h2 className="mono text-accent" style={{ margin: 0, fontSize: 18 }}>仿写画像</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="welcome-mode-btn active" onClick={handleRunSimulate}>
            运行 /simulate
          </button>
        </div>
      </div>

      {/* 如果不存在画像 */}
      {!profile ? (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)', padding: 60, textAlign: 'center',
        }}>
          <div className="text-dim" style={{ fontSize: 14, marginBottom: 8 }}>尚未生成仿写画像</div>
          <div className="text-dim" style={{ fontSize: 12, marginBottom: 16 }}>
            需要先运行 ainovel-cli 的 /simulate 命令生成数据
          </div>
        </div>
      ) : (
        <>
          {/* 元信息 */}
          <div style={{
            display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12, flexShrink: 0,
            padding: '8px 12px', background: 'var(--color-surface)',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
            fontSize: 11, fontFamily: 'var(--font-mono)',
          }}>
            <span className="text-dim">{profile.version || 'v1'}</span>
            <span className="text-dim">创建: {formatDate(profile.createdAt)}</span>
            {profile.updatedAt && <span className="text-dim">更新: {formatDate(profile.updatedAt)}</span>}
            <span className="text-dim">语料: {profile.corpus?.sources?.length || 0} 篇</span>
            {profile.corpus?.sourceDir && <span className="text-dim">来源: {profile.corpus.sourceDir}</span>}
          </div>

          {/* 标签切换 */}
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

          {/* 内容 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {tab === 'overview' && (
              <div>
                {/* 来源概览 */}
                <SectionCard title="语料来源">
                  <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                    {(profile.corpus?.sources || []).map((src, i) => (
                      <div key={i} className="text-dim" style={{ padding: '2px 0' }}>
                        <span className="text-accent" style={{ fontWeight: 'bold' }}>{src.title || src.relativePath}</span>
                        <span style={{ marginLeft: 8, fontSize: 11 }}>
                          {src.sizeBytes ? `${(src.sizeBytes / 1024).toFixed(0)}KB` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* 各维度概要 */}
                {profile.synthesis && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                    {SYNTHESIS_TABS.map(({ key, label, color }) => {
                      const data = profile.synthesis?.[key] || {}
                      const fields = Object.keys(data)
                      return (
                        <div key={key} style={{
                          background: 'var(--color-surface)',
                          border: `1px solid ${color}40`,
                          borderRadius: 'var(--radius)', padding: 14,
                        }}>
                          <div style={{
                            color, fontWeight: 'bold', fontSize: 13, marginBottom: 8,
                            fontFamily: 'var(--font-mono)',
                          }}>{label}</div>
                          {fields.slice(0, 3).map(f => (
                            <div key={f} style={{ marginBottom: 6 }}>
                              <div className="text-dim" style={{ fontSize: 10, marginBottom: 2 }}>
                                {FIELD_LABELS[key]?.[f] || f}
                              </div>
                              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                                {(data[f] || []).slice(0, 4).map((item: string, i: number) => (
                                  <span key={i} style={{
                                    display: 'inline-block', padding: '1px 6px', margin: 1,
                                    background: `${color}10`, color, borderRadius: 3, fontSize: 11,
                                  }}>{item}</span>
                                ))}
                                {(data[f] || []).length > 4 && (
                                  <span className="text-dim" style={{ fontSize: 10 }}>+{(data[f] || []).length - 4}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'sources' && (
              <div>
                {(profile.sourceReports || []).map((report, i) => (
                  <div key={i} style={{
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)', marginBottom: 8, overflow: 'hidden',
                  }}>
                    <div
                      className="cursor-clickable"
                      onClick={() => setExpandedSource(expandedSource === i ? null : i)}
                      style={{
                        padding: '10px 14px', cursor: 'pointer', display: 'flex',
                        justifyContent: 'space-between', alignItems: 'center',
                      }}
                    >
                      <div>
                        <span style={{ fontWeight: 'bold', fontSize: 13, color: 'var(--color-text)' }}>
                          {report.title || report.relativePath}
                        </span>
                        <span className="text-dim" style={{ fontSize: 11, marginLeft: 8 }}>
                          {report.relativePath}
                        </span>
                      </div>
                      <span className="text-dim" style={{ fontSize: 11 }}>
                        {expandedSource === i ? '▲' : '▼'}
                      </span>
                    </div>

                    {expandedSource === i && (
                      <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--color-border)', paddingTop: 10 }}>
                        {report.summary && (
                          <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}>
                            <div className="sidebar-section-header" style={{ fontSize: 11, marginBottom: 4 }}>摘要</div>
                            <div className="text-dim">{report.summary}</div>
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                          {report.styleObservations?.length > 0 && (
                            <div><div className="sidebar-section-header" style={{ fontSize: 10, marginBottom: 2 }}>风格观察</div>
                              <TagList items={report.styleObservations} color="#7ec5d8" /></div>
                          )}
                          {report.commonWords?.length > 0 && (
                            <div><div className="sidebar-section-header" style={{ fontSize: 10, marginBottom: 2 }}>常用词</div>
                              <TagList items={report.commonWords} color="#7ec488" /></div>
                          )}
                          {report.plotPatterns?.length > 0 && (
                            <div><div className="sidebar-section-header" style={{ fontSize: 10, marginBottom: 2 }}>情节模式</div>
                              <TagList items={report.plotPatterns} color="#e09b5a" /></div>
                          )}
                          {report.hookPatterns?.length > 0 && (
                            <div><div className="sidebar-section-header" style={{ fontSize: 10, marginBottom: 2 }}>钩子模式</div>
                              <TagList items={report.hookPatterns} color="#e5b449" /></div>
                          )}
                          {report.pacingNotes?.length > 0 && (
                            <div><div className="sidebar-section-header" style={{ fontSize: 10, marginBottom: 2 }}>节奏笔记</div>
                              <TagList items={report.pacingNotes} color="#a890d8" /></div>
                          )}
                          {report.readerAppeal?.length > 0 && (
                            <div><div className="sidebar-section-header" style={{ fontSize: 10, marginBottom: 2 }}>读者吸引力</div>
                              <TagList items={report.readerAppeal} color="#e07060" /></div>
                          )}
                        </div>

                        {report.reusableTechniques?.length > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div className="sidebar-section-header" style={{ fontSize: 10, marginBottom: 2 }}>可复用技巧</div>
                            <TagList items={report.reusableTechniques} color="#5fb8a3" />
                          </div>
                        )}

                        {report.warnings?.length > 0 && (
                          <div style={{ marginTop: 8, padding: 8, background: 'rgba(224,112,96,0.1)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontSize: 10, color: '#e07060', fontWeight: 'bold', marginBottom: 2 }}>⚠ 警告</div>
                            <TagList items={report.warnings} color="#e07060" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {(!profile.sourceReports || profile.sourceReports.length === 0) && (
                  <div className="text-dim" style={{ textAlign: 'center', marginTop: 40, fontSize: 13 }}>
                    暂无语料分析数据
                  </div>
                )}
              </div>
            )}

            {tab === 'synthesis' && (
              <div>
                {/* 综合画像子标签 */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', flexShrink: 0 }}>
                  {SYNTHESIS_TABS.map(({ key, label, color }) => (
                    <button key={key}
                      className={`welcome-mode-btn ${synthTab === key ? 'active' : ''}`}
                      onClick={() => setSynthTab(key)}
                      style={{ fontSize: 11, borderColor: synthTab === key ? color : undefined }}
                    >{label}</button>
                  ))}
                </div>

                {profile.synthesis ? (
                  <div>
                    {SYNTHESIS_TABS.filter(t => t.key === synthTab).map(({ key, label, color }) => {
                      const data = profile.synthesis?.[key] || {}
                      const fields = Object.keys(data)
                      return (
                        <div key={key}>
                          <div style={{
                            color, fontSize: 16, fontWeight: 'bold', marginBottom: 12,
                            fontFamily: 'var(--font-mono)', letterSpacing: 1,
                          }}>{label}</div>
                          {fields.map(f => (
                            <SectionCard key={f} title={FIELD_LABELS[key]?.[f] || f} borderColor={color}>
                              <TagList items={data[f] || []} color={color} />
                            </SectionCard>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-dim" style={{ textAlign: 'center', marginTop: 40 }}>
                    暂无综合画像数据
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  )
}
