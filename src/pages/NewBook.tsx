import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookCover from '@/components/BookCover'
import ImageViewer from '@/components/ImageViewer'
import { getPhaseLabel } from '@/lib/utils/phaseLabel'

type Mode = 'quick' | 'detailed' | 'cocreate'

export default function NewBook() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('quick')

  // ── 快速模式 ──
  const [quickPremise, setQuickPremise] = useState('')
  const [quickStyle, setQuickStyle] = useState('default')
  const [quickCreating, setQuickCreating] = useState(false)
  const [quickError, setQuickError] = useState('')

  // ── 共创模式 ──
  const [coPremise, setCoPremise] = useState('')
  const [coStyle, setCoStyle] = useState('default')
  const [coCreating, setCoCreating] = useState(false)
  const [coError, setCoError] = useState('')

  // ── 详细模式 ──
  const [name, setName] = useState('')
  const [style, setStyle] = useState('default')
  const [phase, setPhase] = useState('init')
  const [tags, setTags] = useState('')
  const [premise, setPremise] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [generatingCover, setGeneratingCover] = useState(false)
  const [genCoverPrompt, setGenCoverPrompt] = useState('')
  const [showGenCover, setShowGenCover] = useState(false)
  const [viewerOpen, setViewerOpen] = useState(false)

  /** 从书名和简介自动构建封面生成 prompt */
  function buildCoverPrompt(): string {
    const parts: string[] = []
    if (name.trim()) parts.push(`书名：《${name.trim()}》`)
    if (premise.trim()) parts.push(`内容简介：${premise.trim()}`)
    if (parts.length === 0) return ''
    parts.push('书籍封面设计，艺术风格，高质量')
    return parts.join('；')
  }

  function openGenCover() {
    setGenCoverPrompt(buildCoverPrompt())
    setError('')
    setShowGenCover(true)
  }

  // ── 快速模式：一键自动创作 ──
  const handleQuickCreate = async () => {
    if (!quickPremise.trim()) { setQuickError('请输入创作需求'); return }
    setQuickCreating(true)
    setQuickError('')
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.createBookAuto(quickPremise.trim(), quickStyle)
        if (result?.book?.id) {
          navigate(`/books/${result.book.id}/workspace?mode=writing`)
        } else {
          setQuickError(result?.error || '创建失败')
        }
      }
    } catch (e: any) {
      setQuickError(e.message || '创建失败')
    }
    setQuickCreating(false)
  }

  // ── 共创模式：先建书，再进工作台打开共创窗（不立刻开写） ──
  const handleCocreateCreate = async () => {
    if (!coPremise.trim()) { setCoError('请输入初始创作想法'); return }
    setCoCreating(true)
    setCoError('')
    try {
      if (window.electronAPI) {
        const premise = coPremise.trim()
        // 想法只放 premise；书名用占位，避免把整段创作想法当成书名
        const tempName = '未命名共创'
        const book = await window.electronAPI.createBook(tempName, coStyle, 'init', premise, '')
        if (book?.id) {
          navigate(`/books/${book.id}/workspace?mode=writing&cocreate=1`)
        } else {
          setCoError('创建失败')
        }
      }
    } catch (e: any) {
      setCoError(e.message || '创建失败')
    }
    setCoCreating(false)
  }

  // ── 详细模式：手动创建 ──
  const handleCreate = async () => {
    if (!name.trim()) { setError('请输入书名'); return }
    setCreating(true)
    setError('')
    try {
      if (window.electronAPI) {
        const book = await window.electronAPI.createBook(name.trim(), style, phase, premise, tags)
        if (book?.id) {
          setCreatedId(book.id)
          if (selectedImage) {
            await window.electronAPI.saveBookCover(book.id, selectedImage)
          }
          navigate('/')
        }
      }
    } catch (e: any) {
      setError(e.message || '创建失败')
    }
    setCreating(false)
  }

  const handleSelectCover = async () => {
    if (!window.electronAPI) return
    const path = await window.electronAPI.selectCoverImage()
    if (path) setSelectedImage(path)
  }

  async function handleGenerateCover() {
    if (!window.electronAPI || !genCoverPrompt.trim()) return
    setGeneratingCover(true); setError('')
    try {
      const result = await window.electronAPI.generateImage('', '', genCoverPrompt.trim(), { size: '1024x1024' })
      if (result.error) { setError('生成封面失败: ' + result.error) }
      else if (result.image) {
        setSelectedImage(result.image)
        setShowGenCover(false)
      }
    } catch (e: any) { setError(e.message || '生成失败') }
    setGeneratingCover(false)
  }

  // ── 模式切换 ──
  const switchMode = (m: Mode) => {
    setMode(m)
    setQuickError('')
    setError('')
  }

  return (
    <div className="flex-row" style={{ height: '100vh' }}>
      {/* 左侧 */}
      <div className="flex-col p-32 scroll-y" style={{ width: 420, minWidth: 380, borderRight: '1px solid var(--color-border)' }}>
        <h2 className="mono text-accent mb-16 text-lg" style={{ fontSize: 20 }}>+ 新建书籍</h2>

        {/* 模式切换 */}
        <div className="flex-row mb-20" style={{ gap: 4, background: 'var(--color-surface)', borderRadius: 6, padding: 3 }}>
          <button className={`welcome-mode-btn ${mode === 'quick' ? 'active' : ''}`}
            onClick={() => switchMode('quick')} style={{ flex: 1, fontSize: 12 }}>
            ⚡ 快速创作
          </button>
          <button className={`welcome-mode-btn ${mode === 'detailed' ? 'active' : ''}`}
            onClick={() => switchMode('detailed')} style={{ flex: 1, fontSize: 12 }}>
            📝 详细设置
          </button>
          <button className={`welcome-mode-btn ${mode === 'cocreate' ? 'active' : ''}`}
            onClick={() => switchMode('cocreate')} style={{ flex: 1, fontSize: 12 }}>
            🤝 共创规划
          </button>
        </div>

        {/* ── 快速创作 ── */}
        {mode === 'quick' && (
          <>
            <div className="mb-12">
              <label className="text-muted text-sm mb-8 d-block">
                一句话创作需求 <span className="text-error text-xs">*必填</span>
              </label>
              <textarea value={quickPremise} onChange={e => setQuickPremise(e.target.value)}
                placeholder={'例如：「一个现代程序员穿越到修仙世界，用编程思维改写修炼规则的故事」\n\nAI 将自动生成书名、构建大纲、开始创作，全程无需手动填写。'}
                className="textarea-field mono"
                style={{ width: '100%', minHeight: 160, fontSize: 14, lineHeight: 1.8, padding: 14, resize: 'vertical' }} />
            </div>

            <div className="mb-16">
              <label className="text-muted text-sm mb-8 d-block">写作风格（可选）</label>
              <div className="flex-row flex-wrap" style={{ gap: 6 }}>
                {[
                  { key: 'default', label: '通用' },
                  { key: 'fantasy', label: '仙侠/玄幻' },
                  { key: 'suspense', label: '悬疑推理' },
                  { key: 'romance', label: '言情' },
                ].map(s => (
                  <button key={s.key}
                    className={`welcome-mode-btn ${quickStyle === s.key ? 'active' : ''}`}
                    onClick={() => setQuickStyle(s.key)}>{s.label}</button>
                ))}
              </div>
            </div>

            {quickError && (
              <div className="text-error text-sm mono mb-12">{quickError}</div>
            )}

            <div className="mt-auto" style={{ paddingTop: 16 }}>
              <div className="flex-row gap-10">
                <button className="welcome-mode-btn active" onClick={handleQuickCreate} disabled={quickCreating}
                  style={{ flex: 1, fontSize: 14, padding: '10px 24px', opacity: quickCreating ? 0.6 : 1 }}>
                  {quickCreating ? '🤖 AI 正在创作中...' : '⚡ 一键创作'}
                </button>
                <button className="welcome-mode-btn" onClick={() => navigate('/')}
                  style={{ fontSize: 13, padding: '10px 24px' }}>
                  取消
                </button>
              </div>
              <div className="text-dim text-xs mt-12" style={{ lineHeight: 1.6 }}>
                点击后 AI 将自动生成书名、大纲与框架，完成后自动进入创作工作台。
                首次使用需确保已配置好 API 模型（<span className="cursor-clickable text-accent" onClick={() => navigate('/settings/models')}>模型管理</span>）。
              </div>
            </div>
          </>
        )}


        {/* ── 共创规划 ── */}
        {mode === 'cocreate' && (
          <>
            <div className="mb-12">
              <div className="text-dim text-xs mb-12" style={{ lineHeight: 1.65 }}>
                适合还没想清楚细节时：先创建书籍，再和 AI 多轮讨论方向、章纲与约束。
                <b>确认后再开始写作</b>，不会像「一键创作」那样立刻开写。
              </div>
              <label className="text-muted text-sm mb-8 d-block">
                初始创作想法 <span className="text-error text-xs">*必填</span>
              </label>
              <textarea value={coPremise} onChange={e => setCoPremise(e.target.value)}
                placeholder={'例如：「都市高武，主角 F 级绝对平衡能力，超限进化系统，前八万字只写城市范围……」\n\n可以写得尽量完整；进入共创后还能继续改。'}
                className="textarea-field mono"
                style={{ width: '100%', minHeight: 180, fontSize: 14, lineHeight: 1.8, padding: 14, resize: 'vertical' }} />
            </div>

            <div className="mb-16">
              <label className="text-muted text-sm mb-8 d-block">写作风格（可选）</label>
              <div className="flex-row flex-wrap" style={{ gap: 6 }}>
                {[
                  { key: 'default', label: '通用' },
                  { key: 'fantasy', label: '仙侠/玄幻' },
                  { key: 'suspense', label: '悬疑推理' },
                  { key: 'romance', label: '言情' },
                ].map(s => (
                  <button key={s.key}
                    className={`welcome-mode-btn ${coStyle === s.key ? 'active' : ''}`}
                    onClick={() => setCoStyle(s.key)}>{s.label}</button>
                ))}
              </div>
            </div>

            {coError && (
              <div className="text-error text-sm mono mb-12">{coError}</div>
            )}

            <div className="mt-auto" style={{ paddingTop: 16 }}>
              <div className="flex-row gap-10">
                <button className="welcome-mode-btn active" onClick={handleCocreateCreate} disabled={coCreating}
                  style={{ flex: 1, fontSize: 14, padding: '10px 24px', opacity: coCreating ? 0.6 : 1 }}>
                  {coCreating ? '创建中...' : '🤝 创建并进入共创'}
                </button>
                <button className="welcome-mode-btn" onClick={() => navigate('/')}
                  style={{ fontSize: 13, padding: '10px 24px' }}>
                  取消
                </button>
              </div>
              <div className="text-dim text-xs mt-12" style={{ lineHeight: 1.6 }}>
                流程：创建书籍 → 打开工作台 → 自动弹出共创窗口 → 多轮讨论 → 确认后开始写作。
                也可稍后在工作台输入 <span className="text-accent">/cocreate</span> 再次进入。
              </div>
            </div>
          </>
        )}

        {/* ── 详细设置 ── */}
        {mode === 'detailed' && (
          <>
            <div className="flex-row gap-24 mb-24">
              <div className="flex-shrink-0">
                {createdId ? (
                  <BookCover bookId={createdId} size="medium" editable />
                ) : (
                  <div onClick={selectedImage ? () => setViewerOpen(true) : handleSelectCover}
                    className="cursor-clickable flex-col items-center justify-center"
                    style={{ width: 100, height: 140, borderRadius: 4,
                      border: selectedImage ? '1px solid var(--color-border)' : '2px dashed var(--color-dim)',
                      background: 'var(--color-surface-2)', cursor: selectedImage ? 'zoom-in' : 'pointer', gap: 6 }}>
                    {selectedImage ? (
                      <img loading="lazy" src={selectedImage} alt="封面预览" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 3 }} />
                    ) : (
                      <>
                        <span style={{ fontSize: 28, opacity: 0.4 }}>📖</span>
                        <span className="text-dim text-xs">添加封面</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1">
                <div className="mb-16">
                  <label className="text-muted text-sm mb-8 d-block">书名</label>
                  <input value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()}
                    className="input-field text-sm" style={{ padding: '10px 14px', fontSize: 14 }}
                    placeholder="输入书名，如「光斑」「星穹之旅」" autoFocus />
                </div>

                <button className="welcome-mode-btn text-sm mb-12" onClick={handleSelectCover}>
                  {selectedImage ? '更换封面图片' : '选择封面图片'}
                </button>
                <button className="welcome-mode-btn text-sm mb-12" onClick={openGenCover}
                  style={{ color: 'var(--color-accent2)', borderColor: 'var(--color-accent2)' }}>
                  🤖 AI 生成封面
                </button>
              </div>
            </div>

            <div className="mb-16">
              <label className="text-muted text-sm mb-8 d-block">写作风格</label>
              <div className="flex-row flex-wrap" style={{ gap: 6 }}>
                {[
                  { key: 'default', label: '通用' },
                  { key: 'fantasy', label: '仙侠/玄幻' },
                  { key: 'suspense', label: '悬疑推理' },
                  { key: 'romance', label: '言情' },
                ].map(s => (
                  <button key={s.key}
                    className={`welcome-mode-btn ${style === s.key ? 'active' : ''}`}
                    onClick={() => setStyle(s.key)}>{s.label}</button>
                ))}
              </div>
            </div>

            <div className="mb-16">
              <label className="text-muted text-sm mb-8 d-block">写作阶段</label>
              <div className="flex-row flex-wrap" style={{ gap: 6 }}>
                {[
                  { key: 'init', label: getPhaseLabel('init') },
                  { key: 'premise', label: getPhaseLabel('premise') },
                  { key: 'outline', label: getPhaseLabel('outline') },
                  { key: 'writing', label: getPhaseLabel('writing') },
                  { key: 'complete', label: getPhaseLabel('complete') },
                ].map(s => (
                  <button key={s.key}
                    className={`welcome-mode-btn ${phase === s.key ? 'active' : ''}`}
                    onClick={() => setPhase(s.key)}>{s.label}</button>
                ))}
              </div>
            </div>

            <div className="mb-16">
              <label className="text-muted text-sm mb-8 d-block">标签</label>
              <input value={tags} onChange={e => setTags(e.target.value)}
                placeholder="用逗号分隔，如: 玄幻, 后宫, 末日"
                className="input-field" />
            </div>

            {error && (
              <div className="text-error text-sm mono mb-12">{error}</div>
            )}

            <div className="flex-row gap-10 mt-auto" style={{ paddingTop: 16 }}>
              <button className="welcome-mode-btn active" onClick={handleCreate} disabled={creating}
                style={{ fontSize: 13, padding: '8px 24px', opacity: creating ? 0.6 : 1 }}>
                {creating ? '创建中...' : '创建书籍'}
              </button>
              <button className="welcome-mode-btn" onClick={() => navigate('/')}
                style={{ fontSize: 13, padding: '8px 24px' }}>
                取消
              </button>
            </div>
          </>
        )}
      </div>

      {/* 右侧：内容简介（仅详细模式展示大编辑区） */}
      {mode === 'cocreate' && (
        <div className="flex-1 flex-col p-32" style={{ justifyContent: 'center' }}>
          <div className="text-accent mono mb-12" style={{ fontSize: 16 }}>共创规划适合什么情况？</div>
          <div className="text-dim" style={{ fontSize: 13, lineHeight: 1.8, maxWidth: 520 }}>
            <div className="mb-12">• 只有大致题材，还没定书名、能力线、前几章事件</div>
            <div className="mb-12">• 想先和 AI 把方向、禁忌、节奏谈清楚，再开写</div>
            <div className="mb-12">• 不想像「一键创作」那样立刻进入正文流水线</div>
            <div className="mb-12">• 已有长设定，想整理成可执行的后续方向 brief</div>
            <div style={{ marginTop: 20, padding: 12, border: '1px solid var(--color-border)', borderRadius: 6, background: 'var(--color-surface)' }}>
              <div className="text-muted text-xs mb-6">三种入口怎么选</div>
              <div>⚡ 快速创作：一句话直接开写</div>
              <div>📝 详细设置：手动填书名/封面/阶段后再建书</div>
              <div>🤝 共创规划：先讨论方向，确认后再写作</div>
            </div>
          </div>
        </div>
      )}

      {mode === 'detailed' && (
        <div className="flex-1 flex-col p-32">
          <label className="text-muted text-sm mb-8" style={{ display: 'block', fontWeight: 'bold' }}>内容简介</label>
          <textarea value={premise} onChange={e => setPremise(e.target.value)}
            placeholder="输入书籍内容简介，描述故事核心设定、世界观、主线脉络等...
            
可以在这里详细写下你的创作构想，AI 会基于此进行创作。"
            className="textarea-field mono"
            style={{ flex: 1, width: '100%', minHeight: 300, fontSize: 14, lineHeight: 1.8, padding: 16, resize: 'none' }} />
        </div>
      )}

      {/* AI 生成封面弹窗 */}
      {showGenCover && (
        <div className="modal-overlay" onClick={() => setShowGenCover(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 420, maxWidth: 500 }}>
            <div className="modal-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              🤖 AI 生成封面
              <button className="modal-close" onClick={() => setShowGenCover(false)} style={{ position: 'static' }}>✕</button>
            </div>
            <div className="text-dim text-xs mb-12">
              使用 AI 图片生成模型为你的书籍创建封面。
              {genCoverPrompt.trim() ? '已从书名和简介自动填充描述，可修改后生成。' : '请先填写书名和内容简介，再生成封面。'}
            </div>
            <div className="mb-12">
              <label className="text-muted text-sm mb-6 d-block">
                图片描述（Prompt）{!genCoverPrompt.trim() && <span className="text-error text-xs"> *必填</span>}
              </label>
              <textarea value={genCoverPrompt} onChange={e => setGenCoverPrompt(e.target.value)}
                placeholder={'描述你想要的封面画面，例如：\n"一本古老魔法书的特写，封面镶嵌金色符文，背景是星空和紫色魔法光晕，奇幻风格"'}
                className="textarea-field text-sm" rows={4}
                style={{ width: '100%', resize: 'vertical' }} />
            </div>
            {error && <div className="text-error text-sm mb-8">{error}</div>}
            <div className="flex-row gap-8" style={{ justifyContent: 'flex-end' }}>
              <button className="welcome-mode-btn" onClick={() => setShowGenCover(false)}>取消</button>
              <button className="welcome-mode-btn active" onClick={handleGenerateCover} disabled={generatingCover || !genCoverPrompt.trim()}>
                {generatingCover ? '生成中...' : '生成封面'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 图片放大查看 */}
      {viewerOpen && selectedImage && (
        <ImageViewer src={selectedImage} alt="封面预览" onClose={() => setViewerOpen(false)} />
      )}
    </div>
  )
}
