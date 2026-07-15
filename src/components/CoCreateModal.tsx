import { useEffect, useMemo, useRef, useState } from 'react'
import { useUIStore } from '@/stores/useAppStore'
import { useWritingStore } from '@/stores/useWritingStore'
import { useAppStore, useBookStore } from '@/stores/useAppStore'
import type { UISnapshot } from '@/types'

interface CoCreateModalProps {
  onClose?: () => void
}

type ChatRole = 'system' | 'user' | 'assistant'

interface ChatMessage {
  role: ChatRole
  content: string
}

const PHASE_LABEL: Record<string, string> = {
  init: '初始化',
  premise: '设定/前提',
  outline: '大纲规划',
  writing: '正文写作',
  complete: '已完成',
}

function phaseLabel(phase?: string) {
  const key = String(phase || '').trim()
  return PHASE_LABEL[key] || key || '未知'
}


function stripVisibleProtocol(text: string): string {
  return String(text || '')
    .replace(/<\/?\s*(?:reply|draft|ready|suggestions)\s*>/gi, '')
    .replace(/^\s*<\/?(?:reply|draft|ready|suggestions)>\s*$/gim, '')
    .replace(/[（(]\s*20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?\s*更新\s*[）)]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isMetaBriefDoc(text: string): boolean {
  const s = String(text || '')
  const mention = (s.match(/\b(?:reply|draft|ready|suggestions)\b/gi) || []).length
  const meta = [
    /我们(?:可以|应该|需要)在\s*reply/i,
    /draft\s*应该/i,
    /ready\s*(?:可能|还是|为)?\s*false/i,
    /更新后的\s*brief/i,
    /作为助手，需要以多轮对话/i,
    /输出格式/i,
  ].filter((re) => re.test(s)).length
  const hasStory =
    /^#{1,3}\s+后续走向/m.test(s) ||
    /^#{1,3}\s+前三章/m.test(s) ||
    /^#{1,3}\s+关键转折/m.test(s) ||
    /^#{1,3}\s+第一卷/m.test(s)
  return meta >= 2 || (mention >= 5 && !hasStory)
}

function sanitizeBriefForDisplay(text: string): string {
  let s = stripVisibleProtocol(text)
  if (!s) return ''
  if (isMetaBriefDoc(s)) return ''
  const m = /^(#{1,3}\s+.+)$/m.exec(s)
  if (m && m.index > 0) {
    const head = s.slice(0, m.index)
    const noisy = head
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .every((l) =>
        l === '---' ||
        /^(?:收到|好的|明白)/.test(l) ||
        /完整\s*brief|检查结果|字数标准已全部更新|旧标准已全部删除|请把.+写入右侧|reply|draft|ready/.test(l),
      )
    if (noisy) s = s.slice(m.index)
  }
  s = s
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.trim()
      if (!t) return true
      if (t === '---') return false
      if (/^(?:收到|好的|明白)[。.!！]/.test(t)) return false
      if (/以下为(?:检查结果|更新后|完整\s*brief)/.test(t)) return false
      if (/字数标准已全部更新|旧标准已全部删除/.test(t)) return false
      if (/请把.{0,20}写入右侧\s*brief/.test(t)) return false
      if (/暂时不要(?:开始)?创作正文/.test(t)) return false
      if (/我们(?:可以|应该|需要)在\s*reply/i.test(t)) return false
      if (/\bdraft\b.*应该|\bready\b.*false|\bsuggestions\b/i.test(t)) return false
      if (/输出格式|多轮对话形式|作为助手/.test(t)) return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (isMetaBriefDoc(s)) return ''
  return s
}

function looksLikeProtocolLeak(text: string): boolean {
  return /<\/?\s*(?:reply|draft|ready|suggestions)\s*>/i.test(String(text || ''))
}

/** display name helper: avoid premise-as-title */
function displayNovelName(name?: string, premise?: string): string {
  const n = String(name || '').trim()
  if (!n) return '未命名共创'
  if (n === '未命名共创' || n === '共创规划中') return n
  if (n === '未命名' || n === '未定书名') return '未命名共创'
  if (n.length > 40) return '未命名共创'
  const p = String(premise || '').replace(/\s+/g, ' ').trim()
  const bare = n.replace(/[…\.]+$/, '')
  if (p && bare.length >= 12 && (p === bare || p.startsWith(bare))) return '未命名共创'
  return n
}

function compactStatusLines(snap: UISnapshot, summaryText?: string): string[] {
  const lines: string[] = []
  const name = displayNovelName(snap.novelName, snap.premise)
  lines.push(`书名：《${name}》`)
  lines.push(`阶段：${phaseLabel(snap.phase)}${snap.flow ? ` · ${snap.flow}` : ''}`)
  const completed = Number(snap.completedCount || 0)
  const words = Number(snap.totalWordCount || 0)
  lines.push(`进度：已完成 ${completed} 章，约 ${words.toLocaleString()} 字`)

  // summary 优先取短句，避免把 premise 按行炸开
  const premise = String(snap.premise || '').replace(/\s+/g, ' ').trim()
  if (premise) lines.push(`前提：${premise.length > 120 ? premise.slice(0, 120) + '…' : premise}`)

  if (summaryText) {
    const extra = summaryText
      .split(/\r?\n/)
      .map((l) => l.replace(/^\-\s*/, '').trim())
      .filter(Boolean)
      .filter((l) => !l.startsWith('书名') && !l.startsWith('阶段') && !l.startsWith('进度') && !l.startsWith('前提'))
      .slice(0, 3)
    for (const e of extra) {
      const one = e.replace(/\s+/g, ' ')
      lines.push(one.length > 100 ? one.slice(0, 100) + '…' : one)
    }
  }
  return lines
}

export default function CoCreateModal({ onClose }: CoCreateModalProps) {
  const toggleCoCreate = useUIStore((s) => s.toggleCoCreate)
  const handleClose = onClose || toggleCoCreate
  const addToast = useUIStore((s) => s.addToast)
  const sendInput = useWritingStore((s) => s.sendInput)
  const pauseWriting = useWritingStore((s) => s.pauseWriting)
  const stopWriting = useWritingStore((s) => s.stopWriting)
  const resumeWriting = useWritingStore((s) => s.resumeWriting)
  const activeBookId = useAppStore((s) => s.activeBookId)
  const snapshot = useBookStore((s) => s.snapshot)
  const refreshSnapshot = useBookStore((s) => s.refreshSnapshot)

  const [preparing, setPreparing] = useState(true)
  const [prepareNote, setPrepareNote] = useState('正在暂停写作并读取小说状态…')
  const [storySummary, setStorySummary] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<{ role: string; content: string }[]>([])
  const [draftBrief, setDraftBrief] = useState('')
  const [ready, setReady] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [chatting, setChatting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  const statusLines = useMemo(
    () => compactStatusLines(snapshot, storySummary),
    [snapshot, storySummary],
  )

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatting])

  // 打开：暂停写作 + 读状态 + kickoff 共创助手
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const snap = useBookStore.getState().snapshot
        const running = snap.runtimeState === 'running' || !!snap.isRunning
        if (running) {
          setPrepareNote('正在暂停当前创作…')
          await pauseWriting()
          await new Promise((r) => setTimeout(r, 250))
          await stopWriting()
        } else {
          await stopWriting()
        }
        await refreshSnapshot()

        const api = window.electronAPI
        if (!api?.cocreateGetContext || !api?.cocreateChat) {
          if (alive) {
            setPrepareNote('共创接口未就绪，请重启应用后再试')
            setPreparing(false)
          }
          return
        }

        setPrepareNote('正在读取当前小说状态…')
        const ctx = await api.cocreateGetContext(activeBookId || undefined)
        if (!alive) return
        setStorySummary(ctx?.summary || '')
        setMessages([
          {
            role: 'system',
            content: '已暂停创作，进入阶段共创。AI 会先检查当前进度，再和你一起规划后续方向。共创结束后再开始写作。',
          },
        ])

        setPrepareNote('正在让共创助手检查小说状态…')
        setChatting(true)
        const kick = await api.cocreateChat({
          bookId: activeBookId || undefined,
          history: [],
          kickoff: true,
        })
        if (!alive) return
        if (kick?.error) {
          setMessages((prev) => [
            ...prev,
            { role: 'system', content: `状态检查失败：${kick.error}` },
          ])
          setPrepareNote('可直接输入你的方向，再点发送讨论')
        } else {
          const opener = ctx?.opener || '我先暂停一下，想和你一起规划接下来的走向。'
          // 模型侧 history 需要 opener + assistant reply
          const kickMsg = stripVisibleProtocol(kick.message || '')
          const kickDraft = sanitizeBriefForDisplay(kick.draft || '')
          const kickSugs = (Array.isArray(kick.suggestions) ? kick.suggestions : [])
            .map((s: string) => stripVisibleProtocol(s))
            .filter(Boolean)
          setHistory([
            { role: 'user', content: opener },
            { role: 'assistant', content: kickMsg },
          ])
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: kickMsg || '已完成状态检查，可以开始共创。' },
          ])
          if (kickDraft) setDraftBrief(kickDraft)
          setReady(!!kick.ready)
          setSuggestions(kickSugs)
          if (kick.summary) setStorySummary(kick.summary)
          setPrepareNote(kick.ready ? '方向已较清晰，可继续讨论或完成并开始写作' : '可继续对话完善方向')
        }
      } catch (e: any) {
        if (alive) {
          setMessages([{ role: 'system', content: `共创初始化失败：${e?.message || e}` }])
          setPrepareNote('初始化失败，仍可手动输入方向')
        }
      } finally {
        if (alive) {
          setChatting(false)
          setPreparing(false)
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [activeBookId, pauseWriting, stopWriting, refreshSnapshot])

  const sendChat = async (text: string) => {
    const value = text.trim()
    if (!value || chatting || finishing || preparing) return
    const api = window.electronAPI
    if (!api?.cocreateChat) {
      addToast({ id: Date.now(), message: '共创接口不可用，请重启应用', type: 'error' })
      return
    }

    setInput('')
    setChatting(true)
    setMessages((prev) => [...prev, { role: 'user', content: value }])
    try {
      const resp = await api.cocreateChat({

        bookId: activeBookId || undefined,
        history,
        userText: value,
        prevDraft: draftBrief,
      })
      if (resp?.error) {
        setMessages((prev) => [...prev, { role: 'system', content: `共创失败：${resp.error}` }])
        return
      }
      const msg = stripVisibleProtocol(resp.message || '')
      const draft = sanitizeBriefForDisplay(resp.draft || '')
      const sugs = (Array.isArray(resp.suggestions) ? resp.suggestions : [])
        .map((s: string) => stripVisibleProtocol(s))
        .filter(Boolean)
      // 若后端仍泄漏协议，前端兜底成可读提示
      const safeMsg = looksLikeProtocolLeak(resp.message || '')
        ? (msg || '本轮已更新右侧后续方向 brief。你可继续补充，或确认后开始写作。')
        : (msg || '本轮已更新右侧后续方向 brief。')
      setHistory((prev) => [
        ...prev,
        { role: 'user', content: value },
        { role: 'assistant', content: safeMsg },
      ])
      setMessages((prev) => [...prev, { role: 'assistant', content: safeMsg }])
      if (draft) setDraftBrief(draft)
      setReady(!!resp.ready)
      setSuggestions(sugs)
      if (resp.summary) setStorySummary(resp.summary)
      setPrepareNote(resp.ready ? '方向已较清晰，可完成并开始写作' : '可继续对话完善方向')
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'system', content: `共创异常：${e?.message || e}` }])
    } finally {
      setChatting(false)
    }
  }

  const finishAndStart = async () => {
    if (finishing || chatting) return
    const brief = draftBrief.trim() || input.trim()
    if (!brief) {
      addToast({ id: Date.now(), message: '还没有可执行的后续方向，请先对话完善', type: 'error' })
      return
    }
    if (!activeBookId) {
      addToast({ id: Date.now(), message: '没有当前书籍，无法开始写作', type: 'error' })
      return
    }

    setFinishing(true)
    try {
      // 确保停机后写入 pending_steer，再 resume
      await stopWriting()
      const snap = useBookStore.getState().snapshot
      const payload =
        `[阶段规划] 阶段共创已完成，请按下面的后续方向 brief 落地并继续创作。\n` +
        `当前阶段：${phaseLabel(snap.phase)}；已完成 ${Number(snap.completedCount || 0)} 章。\n\n` +
        `${brief}`

      const saved = await sendInput(payload, activeBookId)
      if (!saved) {
        addToast({ id: Date.now(), message: '共创结果保存失败', type: 'error' })
        return
      }
      await new Promise((r) => setTimeout(r, 200))
      const resumed = await resumeWriting(activeBookId)
      if (resumed.ok) {
        addToast({
          id: Date.now(),
          message: '共创结束，已按新方向开始写作',
          type: 'success',
        })
      }
      // 失败时 store 已 toast 真实错误，不再二次模糊提示
      handleClose()
    } finally {
      setFinishing(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal-content modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(960px, 96vw)',
          maxWidth: '96vw',
          height: 'min(820px, 94vh)',
          maxHeight: '94vh',
          minHeight: 560,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          overflow: 'hidden',
          // 覆盖全局 .modal-content 的 overflow-y:auto / max-width:700，避免底栏被内容顶掉
          overflowY: 'hidden',
          paddingBottom: 12,
          position: 'relative',
        }}
      >
        <button className="modal-close" onClick={handleClose} style={{ float: 'none', position: 'absolute', top: 12, right: 14, zIndex: 2 }}>✕</button>

        {/* Header */}
        <div style={{ flex: '0 0 auto', paddingRight: 28, marginBottom: 10 }}>
          <div className="modal-title" style={{ marginBottom: 4 }}>阶段共创</div>
          <div className="text-dim" style={{ fontSize: 12 }}>
            先暂停写作 → 弹窗内多轮共创 → 确认后再开始写作
          </div>
        </div>

        {/* Body: two columns, must shrink inside modal */}
        <div
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 0.95fr)',
            gap: 12,
            overflow: 'hidden',
          }}
        >
          {/* Left: chat */}
          <div
            style={{
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                flex: '1 1 auto',
                minHeight: 0,
                overflow: 'auto',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: 12,
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {messages.length === 0 && (
                <div className="text-dim">{preparing ? prepareNote : '等待共创助手…'}</div>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div className="text-muted" style={{ fontSize: 11, marginBottom: 2 }}>
                    {m.role === 'user' ? '你' : m.role === 'assistant' ? '共创助手' : '系统'}
                  </div>
                  <div
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      color: m.role === 'system' ? 'var(--color-dim, #9aa4b2)' : 'inherit',
                      background: m.role === 'user' ? 'rgba(90,140,255,0.08)' : 'transparent',
                      borderRadius: 6,
                      padding: m.role === 'user' ? '6px 8px' : 0,
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {chatting && <div className="text-dim">共创助手思考中…</div>}
              <div ref={chatEndRef} />
            </div>

            {suggestions.length > 0 && (
              <div
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  maxHeight: 72,
                  overflow: 'auto',
                }}
              >
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    className="welcome-mode-btn"
                    style={{ fontSize: 12, maxWidth: '100%' }}
                    disabled={chatting || finishing}
                    onClick={() => setInput(s)}
                    title={s}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="把你的建议发到上面的共创窗口，例如：按番茄风格先写黄金前三章，写完第3章暂停"
              className="textarea-field mono"
              style={{
                flex: '0 0 auto',
                width: '100%',
                height: 88,
                minHeight: 88,
                maxHeight: 88,
                resize: 'none',
                padding: 10,
                fontSize: 13,
                boxSizing: 'border-box',
              }}
              disabled={preparing || finishing}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendChat(input)
                }
              }}
            />
          </div>

          {/* Right: status + brief */}
          <div
            style={{
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                flex: '0 1 38%',
                minHeight: 96,
                maxHeight: '38%',
                overflow: 'auto',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: 10,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                lineHeight: 1.55,
              }}
            >
              <div className="text-muted" style={{ marginBottom: 6 }}>当前小说状态</div>
              {statusLines.map((line, i) => (
                <div key={i} style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                  - {line}
                </div>
              ))}
              <div className="text-dim" style={{ marginTop: 8 }}>{prepareNote}</div>
            </div>

            <div
              style={{
                flex: '1 1 auto',
                minHeight: 0,
                overflow: 'auto',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: 10,
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
              }}
            >
              <div className="text-muted" style={{ marginBottom: 6, position: 'sticky', top: 0, background: 'var(--color-bg)', paddingBottom: 4 }}>
                后续方向 brief {ready ? '· 可开始写作' : '· 讨论中'}
              </div>
              {draftBrief || (chatting ? '共创助手思考中，brief 将由模型更新…' : '（对话后由模型更新完整 brief，确认后再交给写作引擎）')}
            </div>
          </div>
        </div>

        {/* Footer: always visible, never overlapped */}
        <div
          style={{
            flex: '0 0 auto',
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            background: 'var(--color-panel, var(--color-surface, transparent))',
          }}
        >
          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              className="welcome-mode-btn active"
              disabled={preparing || chatting || finishing || !input.trim()}
              onClick={() => void sendChat(input)}
              style={{
                flex: '1 1 0',
                minWidth: 0,
                opacity: preparing || chatting || finishing || !input.trim() ? 0.6 : 1,
              }}
            >
              {chatting ? '发送中…' : '发送到共创窗口'}
            </button>
            <button
              className="welcome-mode-btn active"
              disabled={preparing || chatting || finishing || !draftBrief.trim()}
              onClick={() => void finishAndStart()}
              style={{
                flex: '1.2 1 0',
                minWidth: 0,
                opacity: preparing || chatting || finishing || !draftBrief.trim() ? 0.6 : 1,
              }}
            >
              {finishing ? '启动写作中…' : ready ? '完成共创并开始写作' : '用当前 brief 开始写作'}
            </button>
            <button
              className="welcome-mode-btn"
              onClick={handleClose}
              disabled={finishing}
              style={{ flex: '0 0 auto' }}
            >
              关闭
            </button>
          </div>
          <div className="text-dim" style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            Enter 发送到共创窗口 · Shift+Enter 换行 · 共创结束后再开始写作 · Esc 关闭
          </div>
        </div>
      </div>
    </div>
  )
}
