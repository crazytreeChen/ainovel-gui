import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import BookNavSidebar from '@/components/BookNavSidebar'
import { useBookId } from '@/hooks/useBookId'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ChapterDiff from '@/components/ChapterDiff'

export default function ChapterPage() {
  const id = useBookId()
  const { num } = useParams<{ num: string }>()
  const navigate = useNavigate()
  const chapterNum = parseInt(num || '1', 10)

  const [content, setContent] = useState('')
  const [draft, setDraft] = useState('')
  const [plan, setPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [showDraft, setShowDraft] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showDiff, setShowDiff] = useState(false)
  const [chapterList, setChapterList] = useState<{ num: number; title: string }[]>([])
  const [chaptersLoading, setChaptersLoading] = useState(true)

  useEffect(() => { loadChapter(); loadChapterList() }, [id, chapterNum])

  async function loadChapterList() {
    if (!id || !window.electronAPI) return
    setChaptersLoading(true)
    const data = await window.electronAPI.getBookChapters(id)
    setChapterList(data || [])
    setChaptersLoading(false)
  }

  async function loadChapter() {
    if (!id || !window.electronAPI) return
    setLoading(true)
    const data = await window.electronAPI.getBookChapter(id, chapterNum)
    if (data) {
      setContent(data.content || '')
      setDraft(data.draft || '')
      setPlan(data.plan || null)
    }
    setLoading(false)
  }

  async function handleSave() {
    if (!id || !window.electronAPI) return
    setSaving(true)
    await window.electronAPI.saveBookChapter(id, chapterNum, content)
    setSaving(false)
    setStatus('已保存')
    setTimeout(() => setStatus(''), 2000)
  }

  function handleChapterSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const n = parseInt(e.target.value, 10)
    if (!isNaN(n)) navigate(`/books/${id}/chapters/${n}`)
  }

  if (loading) return <div className="text-dim" style={{ padding: 32 }}>加载中...</div>

  return (
    <div style={{ padding: 24, height: '100vh', display: 'flex', gap: 24 }}>
      <BookNavSidebar bookId={id || ''} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 导航 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}`)}>← 返回</button>
        <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}/chapters/${chapterNum - 1}`)} disabled={chapterNum <= 1}>← 上一章</button>

        {/* 章节选择器 */}
        <select
          value={chapterNum}
          onChange={handleChapterSelect}
          disabled={chaptersLoading}
          style={{
            padding: '6px 10px', background: 'var(--color-bg)', color: 'var(--color-text)',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
            fontSize: 14, fontWeight: 'bold', fontFamily: 'var(--font-mono)',
            outline: 'none', cursor: 'pointer',
          }}
        >
          {chapterList.map(ch => (
            <option key={ch.num} value={ch.num}>
              第{ch.num}章 {ch.title || ''}
            </option>
          ))}
          {chapterList.length === 0 && <option value={chapterNum}>第{chapterNum}章</option>}
        </select>

        <button className="welcome-mode-btn" onClick={() => navigate(`/books/${id}/chapters/${chapterNum + 1}`)}>下一章 →</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {status && <span className="text-success" style={{ fontSize: 12 }}>{status}</span>}
          <button className="welcome-mode-btn active" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {/* 写作构思面板 */}
      {plan && (
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)', padding: 12, marginBottom: 12, flexShrink: 0,
        }}>
          <div className="sidebar-section-header mb-4">写作构思</div>
          <div className="text-dim" style={{ fontSize: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span><span className="text-muted">目标:</span> {plan.goal || '-'}</span>
            <span><span className="text-muted">冲突:</span> {plan.conflict || '-'}</span>
            <span><span className="text-muted">钩子:</span> {plan.hook || '-'}</span>
            {plan.emotionArc && <span><span className="text-muted">情绪弧:</span> {plan.emotionArc}</span>}
          </div>
        </div>
      )}

      {/* 草稿/终稿切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexShrink: 0 }}>
        <button className={`welcome-mode-btn ${!showDraft && !showPreview ? 'active' : ''}`} onClick={() => { setShowDraft(false); setShowPreview(false) }}>终稿</button>
        <button className={`welcome-mode-btn ${showDraft && !showPreview ? 'active' : ''}`} onClick={() => { setShowDraft(true); setShowPreview(false) }}>草稿</button>
        <button className={`welcome-mode-btn ${showPreview ? 'active' : ''}`} onClick={() => setShowPreview(!showPreview)}>预览</button>
        <button className={`welcome-mode-btn ${showDiff ? 'active' : ''}`}
          onClick={() => { setShowDiff(!showDiff); if (!showDiff && !draft) setDraft(content) }}
          disabled={!content && !draft}>对比</button>
      </div>

      {/* 编辑器 / Markdown 预览 / Diff */}
      {showDiff && draft && content ? (
        <ChapterDiff oldText={draft} newText={content} />
      ) : showPreview ? (
        <div className="scroll-y" style={{
          flex: 1, width: '100%',
          background: 'var(--color-bg)', color: 'var(--color-text)',
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
          padding: 16, fontSize: 14, lineHeight: 1.8,
        }}>
          {showDraft ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft || '*（无草稿内容）*'}</ReactMarkdown>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || '*（无终稿内容）*'}</ReactMarkdown>
          )}
        </div>
      ) : (
        <textarea
          value={showDraft ? draft : content}
          onChange={e => { if (showDraft) setDraft(e.target.value); else setContent(e.target.value) }}
          style={{
            flex: 1, width: '100%', resize: 'none',
            background: 'var(--color-bg)', color: 'var(--color-text)',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
            padding: 16, fontFamily: 'var(--font-mono)', fontSize: 14, lineHeight: 1.8,
            outline: 'none',
          }}
          placeholder="# 第N章 章节标题

在此输入章节内容..."
        />
      )}
      </div>
    </div>
  )
}
