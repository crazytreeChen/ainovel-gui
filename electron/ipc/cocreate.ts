export {}

/**
 * 阶段共创 IPC：对齐 ainovel-cli TUI 的 /cocreate
 * - 打开时由渲染层先停写
 * - 弹窗内多轮对话（reply/draft/ready/suggestions）
 * - 用户确认后再把 draft 作为阶段规划注入并 resume
 */
const { state, getDB, GUI_DATA_DIR, home } = require('../context')
const { createLogger } = require('../logger')
const { join } = require('path')
const { existsSync, readFileSync } = require('fs')

const log = createLogger('ipc:cocreate')

const STAGE_OPENER = '我先暂停一下，想和你一起规划接下来的走向。'

const STAGE_SYSTEM_PROMPT = `你是一个小说"阶段共创"助手。这本小说已经写了一部分（进度见下方"当前故事状态"）。用户暂停下来，想和你一起规划"后续阶段"的走向，再继续创作。

你的任务不是续写正文，而是通过多轮简短对话帮用户想清楚后面这一段（接下来若干章 / 下一弧 / 下一卷）要往哪走，并持续整理出一段"后续方向 brief"，供创作引擎据此推进。

铁律：所有建议必须与"当前故事状态"里已发生的剧情、人物、伏笔一致，绝不推翻或忽略已写内容；只规划"后续怎么走"，不重新设计整本书。

每一轮回复严格按以下 XML 格式输出，包含四个标签，依次出现，每个标签都必须有正确的开闭标签：

<reply>
给用户看的中文自然回复：先回应用户的输入，再最多提出 1 到 2 个当前最关键的问题。如果后续方向已足够清晰，告诉用户可以点击「完成并开始写作」。
</reply>

<draft>
当前完整的"后续方向 brief"，使用 Markdown：直接从二级标题开始，例如 "## 后续走向"、"## 第四至第十二章章纲"、"## 能力熟练度"、"## 检查项"。
每一轮都要在已有结论上**累积更新**，吸收用户最新意图；即使用户已经写得很完整，也要把用户方向**完整写入 draft**（可整理结构，不可省略关键约束）。
如果用户要求输出章纲/检查项，必须写在 draft 里，不要只在 reply 里口头答应。
</draft>

<ready>false</ready>

<suggestions>
1-3 条"用户接下来可能想说的话"，每行一条以 "- " 开头。这是用户卡壳时的引导。
要求：
- 站在用户口吻，像用户对你说的话，不要写成助手反问。
- 每条不超过 25 字，多样化句式。
</suggestions>

输出规范：
- 必须使用四个 XML 标签：<reply> / <draft> / <ready> / <suggestions>，每个都必须完整开闭。
- 标签外不要添加任何说明、思考或代码围栏。
- <ready> 只写 true 或 false。信息已足够时填 true。
- 不要编造“更新日期/版本日期/文档修订日”。除非用户明确给出日期，否则 draft 里禁止出现具体年月日。
- <draft> 只写“后续故事方向 brief”正文，直接从 Markdown 标题开始（如 ## 后续走向）。
- <draft> 禁止写入对话口吻或元说明，例如：“收到”“以下为检查结果”“更新后的完整 brief”“请把字数标准写入右侧brief”“暂时不要开始创作正文”。
- <draft> 不要整段粘贴字数规范、审核手册、编辑规则原文；字数约束最多用一句话概括。
- <reply> 只写给用户看的自然语言，禁止在 reply 里出现任何 XML 标签名；过程说明只放 reply，不放 draft。
- 严禁输出“如何填写 reply/draft/ready/suggestions”的思考过程；不要讨论协议本身，只输出协议结果。
- 如果信息还不够，ready=false，但 draft 仍应是故事方向 brief，而不是对格式的分析。`

function readJsonSafe(path: string): any | null {
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function resolveBookDir(bookId: string): string {
  if (bookId) {
    try {
      const book = getDB().getBook(bookId)
      if (book?.workspace_dir) return book.workspace_dir
    } catch {}
    return join(home, '.ainovel-gui', 'books', bookId)
  }
  return state.outputDir || join(GUI_DATA_DIR, 'books', 'default')
}

function buildStoryStateSummary(bookId: string): string {
  const dir = resolveBookDir(bookId)
  const lines: string[] = []
  try {
    const book = bookId ? getDB().getBook(bookId) : null
    if (book) {
      const rawName = String(book.name || '').trim()
      const premiseFull = String(book.premise || '').replace(/\s+/g, ' ').trim()
      let displayName = rawName || '未命名共创'
      if (!rawName || rawName.length > 40) displayName = '未命名共创'
      else {
        const bare = rawName.replace(/[….]+$/, '')
        if (premiseFull && bare.length >= 12 && (premiseFull === bare || premiseFull.startsWith(bare))) {
          displayName = '未命名共创'
        }
      }
      lines.push(`- 书名：《${displayName}》`)
    }
    if (book?.phase) lines.push(`- 阶段：${book.phase}`)
    if (book?.premise) {
      const p = String(book.premise)
      lines.push(`- 前提：${p.length > 220 ? p.slice(0, 220) + '…' : p}`)
    }
  } catch {}

  const progress =
    readJsonSafe(join(dir, 'output', 'novel', 'meta', 'progress.json')) ||
    readJsonSafe(join(dir, 'meta', 'progress.json'))
  if (progress) {
    const name = String(progress.novel_name || progress.novelName || '').trim()
    if (name) {
      let dn = name
      if (name.length > 40) dn = '未命名共创'
      lines.push(`- 书名：《${dn}》`)
    }
    const completed = Array.isArray(progress.completed_chapters)
      ? progress.completed_chapters.length
      : Array.isArray(progress.completedChapters)
        ? progress.completedChapters.length
        : Number(progress.completedCount || 0)
    const total = Number(progress.total_chapters || progress.totalChapters || 0)
    const words = Number(progress.total_word_count || progress.totalWordCount || 0)
    const phase = String(progress.phase || '')
    lines.push(`- 进度：阶段 ${phase || 'unknown'}，已完成 ${completed}${total ? ' / 规划 ' + total : ''} 章，约 ${words} 字`)
    const next = Number(progress.current_chapter || progress.currentChapter || progress.in_progress_chapter || 0)
    if (next > 0) lines.push(`- 当前章节关注点：第 ${next} 章`)
  }

  try {
    const chars = bookId ? (getDB().getCharacters?.(bookId) || []) : []
    if (Array.isArray(chars) && chars.length) {
      const names = chars.slice(0, 8).map((c: any) => {
        const n = c.name || c.Name || ''
        const r = c.role || c.Role || ''
        return r ? `${n}（${r}）` : n
      }).filter(Boolean)
      if (names.length) lines.push(`- 主要人物：${names.join('、')}`)
    }
  } catch {}

  // unique keep order
  const seen = new Set<string>()
  const out: string[] = []
  for (const l of lines) {
    if (seen.has(l)) continue
    seen.add(l)
    out.push(l)
  }
  return out.join('\n')
}

const PROTOCOL_TAGS = ['reply', 'draft', 'ready', 'suggestions'] as const

function normalizeProtocolText(raw: string): string {
  return String(raw || '')
    .replace(/```(?:xml|markdown|md|text)?/gi, '')
    .replace(/```/g, '')
    .replace(/\uFEFF/g, '')
    .trim()
}

/** 去掉协议标签，避免泄漏到聊天窗/brief */
function stripProtocolMarkup(text: string): string {
  let s = String(text || '')
  // 完整标签对
  for (const tag of PROTOCOL_TAGS) {
    const re = new RegExp(`<\\s*\\/?\\s*${tag}\\s*>`, 'gi')
    s = s.replace(re, '')
  }
  // 残留半截协议行
  s = s
    .replace(/^\s*<\/?(?:reply|draft|ready|suggestions)>\s*$/gim, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return s
}

/** 去掉模型幻觉的“文档更新日期” */
function stripInventedDocDates(text: string): string {
  return String(text || '')
    // 标题里的（2025-04-16 更新）
    .replace(/[（(]\s*20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?\s*更新\s*[）)]/g, '')
    // 行内：更新于 2025-04-16 / 修订日期：...
    .replace(/(?:更新于|修订于|修订日期|更新日期|文档日期|版本日期)\s*[:：]?\s*20\d{2}[-/.年]\d{1,2}[-/.月]\d{1,2}日?/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 从 brief 里压缩“字数规范/审核手册”大段：
 * 只保留一句摘要，避免把规则原文塞进后续方向。
 */
function isMetaNoiseLine(line: string): boolean {
  const t = String(line || '').trim()
  if (!t) return false
  if (t === '---' || t === '***' || t === '___') return true
  // 对话口吻 / 过程说明，不应进入 brief
  if (/^(?:收到|好的|明白|了解)[。.!！]/.test(t)) return true
  if (/以下为(?:检查结果|更新后|完整\s*brief)/i.test(t)) return true
  if (/(?:检查结果|完整\s*brief|更新后的完整)/i.test(t) && t.length < 80) return true
  if (/请把.{0,20}写入右侧\s*brief/i.test(t)) return true
  if (/暂时不要(?:开始)?创作正文/.test(t)) return true
  if (/旧标准已全部删除|字数标准已全部更新/.test(t)) return true
  if (/确认旧标准已全部删除/.test(t)) return true
  if (/列出brief中所有涉及章节字数/.test(t)) return true
  // 协议元思考
  if (/我们(?:可以|应该|需要)在\s*reply/i.test(t)) return true
  if (/\bdraft\b.*应该|\bready\b.*false|\bsuggestions\b/i.test(t)) return true
  if (/输出格式|多轮对话形式|作为助手/.test(t)) return true
  return false
}

function isProtocolMetaDocument(text: string): boolean {
  const s = String(text || '').trim()
  if (!s) return false
  const mention = (s.match(/\b(?:reply|draft|ready|suggestions)\b/gi) || []).length
  const metaHits = [
    /我们(?:可以|应该|需要)在\s*reply/i,
    /draft\s*应该/i,
    /ready\s*(?:可能|还是|为)?\s*false/i,
    /suggestions/i,
    /输出格式/i,
    /更新后的\s*brief/i,
    /作为助手，需要以多轮对话/i,
    /用户要求“?先输出”?/i,
  ].filter((re) => re.test(s)).length
  const hasStoryStructure =
    /^#{1,3}\s+后续走向/m.test(s) ||
    /^#{1,3}\s+前三章/m.test(s) ||
    /^#{1,3}\s+第一卷/m.test(s) ||
    /^#{1,3}\s+关键转折/m.test(s)
  if (metaHits >= 2) return true
  if (mention >= 5 && !hasStoryStructure) return true
  if (/更新后的brief/i.test(s) && /false/i.test(s) && mention >= 2) return true
  return false
}

function extractBriefCore(text: string): string {
  let s = String(text || '').trim()
  if (!s) return ''
  // 优先从第一个真正的 brief 标题开始
  const headingRe = /^(#{1,3}\s+.+)$/m
  const m = headingRe.exec(s)
  if (m && m.index > 0) {
    const head = s.slice(0, m.index)
    // 前面如果只是噪声/寒暄，则丢掉
    const headUseful = head
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .some((l) => !isMetaNoiseLine(l) && !/^[-*]\s+章节字数/.test(l))
    if (!headUseful) s = s.slice(m.index)
  }
  return s.trim()
}

function sanitizeDraftBrief(draft: string): string {
  let s = stripInventedDocDates(stripProtocolMarkup(draft))
  if (!s) return ''
  s = extractBriefCore(s)

  const lines = s.split(/\r?\n/)
  const out: string[] = []
  let skippingRuleBlock = false
  let keptRuleSummary = false

  for (const line of lines) {
    const t = line.trim()
    if (isMetaNoiseLine(t)) continue

    const isRuleHeading = /^(?:#{1,6}\s*)?(?:全书)?(?:章节)?字数规则|审核(?:规则|手册)|编辑规范|字数(?:统计)?规则/.test(t)
    if (isRuleHeading) {
      skippingRuleBlock = true
      if (!keptRuleSummary) {
        out.push('- 章节字数：正文约 4000-5000 字/章（以用户规则为准，此处不展开细则）')
        keptRuleSummary = true
      }
      continue
    }
    if (skippingRuleBlock) {
      if (/^#{1,3}\s+/.test(t) && !/字数|审核|规范|规则/.test(t)) {
        skippingRuleBlock = false
      } else if (!t) {
        continue
      } else if (/^#{1,3}\s+/.test(t) || /^##\s+/.test(t)) {
        skippingRuleBlock = false
      } else {
        continue
      }
    }
    if (!skippingRuleBlock) out.push(line)
  }

  s = out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  // 再次确保不以寒暄开头
  s = extractBriefCore(s)
  // 整篇都是协议元思考则丢弃
  if (isProtocolMetaDocument(s)) return ''
  return s
}

function extractTag(raw: string, tag: string): string {
  const src = normalizeProtocolText(raw)
  // 大小写不敏感
  const openRe = new RegExp(`<\\s*${tag}\\s*>`, 'i')
  const closeRe = new RegExp(`<\\s*/\\s*${tag}\\s*>`, 'i')
  const openMatch = openRe.exec(src)
  if (!openMatch) {
    // 无开标签时，不要再“取到闭标签前的全部文本”——那会把别的段落误吃进来
    return ''
  }
  const start = openMatch.index + openMatch[0].length
  const rest = src.slice(start)
  const closeMatch = closeRe.exec(rest)
  if (closeMatch) {
    return rest.slice(0, closeMatch.index).trim()
  }
  // 有开无闭：切到下一个协议开标签
  let end = rest.length
  for (const other of PROTOCOL_TAGS) {
    if (other === tag) continue
    const m = new RegExp(`<\\s*${other}\\s*>`, 'i').exec(rest)
    if (m && m.index < end) end = m.index
  }
  return rest.slice(0, end).trim()
}

function parseSuggestions(text: string): string[] {
  if (!text) return []
  const cleaned = stripProtocolMarkup(text)
  const out: string[] = []
  for (const line0 of cleaned.split(/\r?\n/)) {
    let line = line0.trim()
    if (!line) continue
    if (line.startsWith('<') && line.endsWith('>')) continue
    if (line.startsWith('- ')) line = line.slice(2).trim()
    else if (line.startsWith('* ')) line = line.slice(2).trim()
    else if (/^\d+\.\s+/.test(line)) line = line.replace(/^\d+\.\s+/, '').trim()
    line = stripProtocolMarkup(line)
    if ([...line].length < 2) continue
    // 过滤明显协议残留
    if (/<\/?(?:reply|draft|ready|suggestions)>/i.test(line)) continue
    out.push(line)
    if (out.length >= 3) break
  }
  return out
}

/** reply 缺失时，尽量抢救可读文本，绝不回传 raw 全文 */
function salvageReply(raw: string, draft: string): string {
  let s = normalizeProtocolText(raw)
  // 砍掉 draft/ready/suggestions 段
  s = s
    .replace(/<\s*draft\s*>[\s\S]*?(?:<\s*\/\s*draft\s*>|(?=<\s*(?:ready|suggestions)\s*>)|$)/ig, '')
    .replace(/<\s*ready\s*>[\s\S]*?(?:<\s*\/\s*ready\s*>|(?=<\s*suggestions\s*>)|$)/ig, '')
    .replace(/<\s*suggestions\s*>[\s\S]*?(?:<\s*\/\s*suggestions\s*>|$)/ig, '')
  s = stripProtocolMarkup(s)
  // 如果还和 draft 高度重合，给一个中性摘要，避免把 brief 当聊天
  if (draft && s && (s.includes(draft.slice(0, Math.min(40, draft.length))) || draft.includes(s.slice(0, Math.min(40, s.length))))) {
    return '本轮已更新右侧后续方向 brief。你可以直接确认，或继续补充想调整的点。'
  }
  if (!s) {
    return draft
      ? '本轮已更新右侧后续方向 brief。你可以直接确认，或继续补充想调整的点。'
      : '我已收到，请继续补充你希望调整的方向。'
  }
  // 仍含大量 markdown 标题时，截成更像对话的前几句
  if (/^#{1,3}\s+/m.test(s) && s.length > 280) {
    const firstPara = s.split(/\n\s*\n/)[0] || s
    return stripProtocolMarkup(firstPara).slice(0, 400)
  }
  return s
}

function parseCoCreateResponse(raw: string): { message: string; draft: string; ready: boolean; suggestions: string[]; raw: string } {
  const text = normalizeProtocolText(raw)
  if (!text) return { message: '', draft: '', ready: false, suggestions: [], raw: text }

  let reply = extractTag(text, 'reply')
  let draft = extractTag(text, 'draft')
  const readyStr = extractTag(text, 'ready').toLowerCase()
  let ready = readyStr === 'true' || readyStr === 'yes' || /\btrue\b/i.test(readyStr)
  let suggestions = parseSuggestions(extractTag(text, 'suggestions'))

  // 兼容模型把标签写错大小写/夹代码块后的二次清洗
  reply = stripProtocolMarkup(reply)
  draft = sanitizeDraftBrief(draft)

  // 若 draft 标签没吃到，但正文里有明显 markdown brief，尝试弱提取
  if (!draft) {
    const maybe = sanitizeDraftBrief(
      text
        .replace(/<\s*reply\s*>[\s\S]*?<\s*\/\s*reply\s*>/ig, '')
        .replace(/<\s*ready\s*>[\s\S]*?<\s*\/\s*ready\s*>/ig, '')
        .replace(/<\s*suggestions\s*>[\s\S]*?<\s*\/\s*suggestions\s*>/ig, ''),
    )
    // 只有看起来像“故事 brief”才采用；协议元思考一律不要
    if (
      maybe &&
      !isProtocolMetaDocument(maybe) &&
      (/^#{1,3}\s+后续走向/m.test(maybe) ||
        /^#{1,3}\s+前三章/m.test(maybe) ||
        /^#{1,3}\s+关键转折/m.test(maybe) ||
        /^#{1,3}\s+第一卷/m.test(maybe))
    ) {
      draft = maybe
    }
  }

  // draft 若仍是协议元思考，清空
  if (draft && isProtocolMetaDocument(draft)) draft = ''

  if (!reply) {
    // 整段若是元思考，不要 salvage 成用户可见长文
    if (isProtocolMetaDocument(text) || looksLikeProtocolMetaThinking(text)) {
      reply = draft
        ? '本轮已更新右侧后续方向 brief。你可以直接确认，或继续补充想调整的点。'
        : '我已收到你的方向要求。请再发一句你最想先确定的点（例如前三章重点或能力升级节奏）。'
    } else {
      reply = salvageReply(text, draft)
    }
  } else {
    reply = stripInventedDocDates(reply)
    if (isProtocolMetaDocument(reply) || looksLikeProtocolMetaThinking(reply)) {
      reply = draft
        ? '本轮已更新右侧后续方向 brief。你可以直接确认，或继续补充想调整的点。'
        : '我已收到。为避免格式串台，请直接补充你的故事方向（前三章/能力线/冲突）。'
    }
  }

  // 再兜底：message 里绝不能出现协议标签
  reply = stripProtocolMarkup(reply)
  draft = stripProtocolMarkup(draft)
  suggestions = suggestions
    .map((s) => stripProtocolMarkup(s))
    .filter((s) => s && !isProtocolMetaDocument(s) && !/reply|draft|ready/i.test(s))

  // 空响应保护
  if (!reply && !draft) {
    reply = '这一轮模型没有给出有效共创结果。请再发送一次你的方向，或换更具体的一句话。'
  }

  return { message: reply, draft, ready, suggestions, raw: text }
}

function loadProvider(): { apiUrl: string; apiKey: string; model: string; providerKey: string } | { error: string } {
  // prefer CLI home config (actual writing model), fallback GUI db
  let cfg: any = null
  try {
    const p = join(home, '.ainovel', 'config.json')
    if (existsSync(p)) cfg = JSON.parse(readFileSync(p, 'utf8'))
  } catch (e: any) {
    log.warn('loadProvider:home-config', e?.message || e)
  }
  if (!cfg) {
    try { cfg = getDB().getConfig('provider_config') } catch {}
  }
  if (!cfg) return { error: '未找到模型配置（~/.ainovel/config.json）' }

  const providerKey = cfg.provider || ''
  const model = cfg.model || ''
  if (!providerKey || !model) return { error: '未配置写作 Provider/Model' }
  const provider = cfg.providers?.[providerKey]
  if (!provider?.api_key) return { error: `Provider "${providerKey}" 未设置 API Key` }
  const baseUrl = String(provider.base_url || '').replace(/\/+$/, '')
  if (!baseUrl) return { error: 'Provider base_url 为空' }
  // 与 batch-audit 一致：base_url 后直接拼 /chat/completions
  // 你的配置通常已是 .../v1
  const apiUrl = baseUrl.includes('/chat/completions')
    ? baseUrl
    : `${baseUrl}/chat/completions`
  return {
    apiUrl,
    apiKey: provider.api_key,
    model,
    providerKey,
  }
}

function looksLikeProtocolAnswer(text: string): boolean {
  const s = String(text || '')
  // 必须像“正式答案”：有协议标签，或有后续方向标题
  const hasTags = /<\s*reply\s*>/i.test(s) || /<\s*draft\s*>/i.test(s)
  const hasBriefHead = /^#{1,3}\s+后续走向/m.test(s) || /^#{1,3}\s+关键转折/m.test(s)
  return hasTags || hasBriefHead
}

function looksLikeProtocolMetaThinking(text: string): boolean {
  const s = String(text || '')
  if (!s.trim()) return false
  // 模型在“思考怎么填 XML/协议”，不是故事 brief
  const hits = [
    /我们(?:可以|应该|需要)在\s*reply/i,
    /在\s*reply\s*中/i,
    /draft\s*应该/i,
    /ready\s*(?:可能|还是|设为|为)?\s*false/i,
    /suggestions\s*建议/i,
    /输出格式/i,
    /协议/i,
    /先讨论.*ready/i,
    /更新后的\s*brief\s*,\s*false/i,
    /用户要求“?先输出”?/i,
    /作为助手，需要以多轮对话形式/i,
  ].filter((re) => re.test(s)).length
  // 大量提及 reply/draft/ready 且缺少故事标题
  const mentionCount = (s.match(/\b(?:reply|draft|ready|suggestions)\b/gi) || []).length
  const hasStoryHead = /后续走向|前三章详细|能力进化|关键转折|第一卷核心/.test(s)
  if (hits >= 2) return true
  if (mentionCount >= 4 && !hasStoryHead) return true
  if (/更新后的brief/i.test(s) && /ready/i.test(s)) return true
  return false
}

async function callChat(messages: { role: string; content: string }[]): Promise<string> {
  const p = loadProvider()
  if ('error' in p) throw new Error(p.error)
  const body = {
    model: p.model,
    messages,
    temperature: 0.7,
    stream: false,
  }
  const resp = await fetch(p.apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${p.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!resp.ok) {
    const t = await resp.text().catch(() => '')
    throw new Error(`模型请求失败 ${resp.status}: ${t.slice(0, 300)}`)
  }
  const data: any = await resp.json()
  const msg = data?.choices?.[0]?.message || {}
  let content = String(msg.content || data?.choices?.[0]?.text || data?.output_text || '').trim()
  const reasoning = String(msg.reasoning_content || msg.reasoning || '').trim()

  // 优先 content；只有 content 空且 reasoning 看起来是正式答案时才回退
  if (!content) {
    if (reasoning && looksLikeProtocolAnswer(reasoning) && !looksLikeProtocolMetaThinking(reasoning)) {
      log.warn('callChat: fallback to reasoning_content as answer')
      content = reasoning
    } else if (reasoning) {
      log.warn('callChat: ignore meta reasoning_content', { reasoningLen: reasoning.length })
      content = ''
    }
  } else if (looksLikeProtocolMetaThinking(content) && reasoning && looksLikeProtocolAnswer(reasoning)) {
    // content 是胡思乱想、reasoning 反而是答案的罕见情况
    log.warn('callChat: content looks meta, prefer reasoning answer')
    content = reasoning
  }

  return content
}


/** 用户是否在直接投递“完整方向说明/章纲要求” */
function isDirectionSpec(text: string): boolean {
  const s = String(text || '').trim()
  if (s.length < 80) return false
  const hits = [
    /第[一二三四五六七八九十\d]+[至到\-—~]第?[一二三四五六七八九十\d]+章/,
    /第一卷|前三章|前十二章|章纲|后续方向|能力进化|超限/,
    /完整写入|写入.*brief|不要开始创作正文|仍然不要开始创作正文/,
    /主动目标|冲突|现实奖励|幽默点|小队关系/,
  ].filter((re) => re.test(s)).length
  if (hits >= 2) return true
  // 长文 + 章节规划口吻
  if (s.length >= 300 && /章/.test(s) && /主角|能力|异兽|选拔|任务/.test(s)) return true
  return false
}

/** 把用户方向整理成可用 brief（模型失败时的硬兜底） */
function sectionTitles(md: string): string[] {
  return String(md || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^#{1,3}\s+/.test(l))
    .map((l) => l.replace(/^#{1,3}\s+/, '').trim())
}

function hasSubstantialStoryBrief(draft: string): boolean {
  const s = String(draft || '').trim()
  if (!s || isProtocolMetaDocument(s) || looksLikeProtocolMetaThinking(s)) return false
  // 有章节/走向结构，或足够长
  if (/^#{1,3}\s+/.test(s) && s.length >= 120) return true
  if (/第[一二三四五六七八九十\d]+章|后续走向|能力进化|选拔|异兽/.test(s) && s.length >= 160) return true
  return s.length >= 240
}

/**
 * 合并 brief：旧规划优先保留，新内容按标题合并/追加，绝不无脑整篇覆盖。
 */
function mergeBriefs(prevDraft: string, nextDraft: string): string {
  const prev = sanitizeDraftBrief(prevDraft || '')
  const next = sanitizeDraftBrief(nextDraft || '')
  if (!prev) return next
  if (!next) return prev
  if (isProtocolMetaDocument(next) || looksLikeProtocolMetaThinking(next)) return prev
  if (isProtocolMetaDocument(prev) || looksLikeProtocolMetaThinking(prev)) return next

  // next 已完整包含 prev 关键句，视为模型在旧稿上重写
  const prevHead = prev.replace(/\s+/g, '').slice(0, 80)
  if (prevHead && next.replace(/\s+/g, '').includes(prevHead) && next.length >= prev.length * 0.8) {
    return next
  }

  // 按二级/三级标题分块合并
  const splitSections = (md: string) => {
    const lines = md.split(/\r?\n/)
    const sections: { title: string; body: string }[] = []
    let title = ''
    let buf: string[] = []
    const push = () => {
      const body = buf.join('\n').trim()
      if (title || body) sections.push({ title, body })
      title = ''
      buf = []
    }
    for (const line of lines) {
      if (/^#{1,3}\s+/.test(line.trim())) {
        push()
        title = line.trim().replace(/^#{1,3}\s+/, '')
      } else {
        buf.push(line)
      }
    }
    push()
    return sections
  }

  const a = splitSections(prev)
  const b = splitSections(next)
  if (!b.length) return prev
  if (!a.length) return next

  const norm = (t: string) => t.replace(/\s+/g, '').toLowerCase()
  const map = new Map<string, { title: string; body: string }>()
  for (const s of a) map.set(norm(s.title || '前言'), s)
  for (const s of b) {
    const key = norm(s.title || '前言')
    const old = map.get(key)
    if (!old) {
      map.set(key, s)
    } else {
      // 同标题：取更长/更新者，但若新 body 太短则保留旧
      if (s.body.length >= Math.max(40, old.body.length * 0.6)) map.set(key, { title: s.title || old.title, body: s.body })
    }
  }

  // 保持旧顺序，再追加新标题
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of a) {
    const key = norm(s.title || '前言')
    const cur = map.get(key)
    if (!cur) continue
    seen.add(key)
    if (cur.title) out.push(`## ${cur.title}`)
    if (cur.body) out.push(cur.body)
    out.push('')
  }
  for (const s of b) {
    const key = norm(s.title || '前言')
    if (seen.has(key)) continue
    const cur = map.get(key)
    if (!cur) continue
    if (cur.title) out.push(`## ${cur.title}`)
    if (cur.body) out.push(cur.body)
    out.push('')
  }
  return sanitizeDraftBrief(out.join('\n').trim())
}

/** 仅在模型失败时，把用户方向作为“补充材料”附加，不覆盖旧规划 */
function buildFallbackSupplement(userText: string, prevDraft = ''): string {
  const body = String(userText || '').trim()
  if (!body) return prevDraft || ''
  const supplement = sanitizeDraftBrief(
    `## 用户补充方向\n\n${body}`,
  )
  if (!prevDraft) {
    // 无旧稿才允许以用户方向做底稿
    return sanitizeDraftBrief(/^#{1,3}\s+/m.test(body) ? body : `## 后续走向\n\n${body}`)
  }
  return mergeBriefs(prevDraft, supplement)
}

function buildDirectionUserPayload(userText: string): string {
  return (
    String(userText || '').trim() +
    '\n\n[系统附加要求]\n' +
    '1. 把以上方向完整写入 <draft>，不要省略关键约束。\n' +
    '2. 若用户要求章纲/能力变化/关系/幽默点/检查项，必须写入 <draft> 对应小节。\n' +
    '3. <reply> 只做简短确认与最多 1-2 个关键问题。\n' +
    '4. 禁止讨论 reply/draft/ready/suggestions 协议本身，只输出协议标签结果。\n' +
    '5. 不要开始创作正文。'
  )
}

function register(ipcMain: Electron.IpcMain) {
  ipcMain.handle('cocreate-get-context', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    try {
      const summary = buildStoryStateSummary(bookId || '')
      return {
        opener: STAGE_OPENER,
        summary,
        bookId: bookId || '',
      }
    } catch (e: any) {
      log.error('cocreate-get-context', e)
      return { opener: STAGE_OPENER, summary: '', bookId: bookId || '', error: e?.message || String(e) }
    }
  })

  ipcMain.handle(
    'cocreate-chat',
    async (
      _e: Electron.IpcMainInvokeEvent,
      payload: { bookId?: string; history?: { role: string; content: string }[]; userText?: string; kickoff?: boolean },
    ) => {
      try {
        const bookId = payload?.bookId || ''
        const summary = buildStoryStateSummary(bookId)
        const system = STAGE_SYSTEM_PROMPT + (
          summary
            ? `\n\n---\n## 当前故事状态\n（以下是已写内容的客观摘要，供你规划后续时参照，不要在 <draft> 里照抄原文）\n${summary}`
            : '\n\n---\n## 当前故事状态\n暂无详细进度文件，请先基于用户输入与前提信息规划。'
        )

        const history = Array.isArray(payload?.history) ? payload.history : []
        const messages: { role: string; content: string }[] = [
          { role: 'system', content: system },
        ]
        for (const m of history) {
          if (!m || !m.content) continue
          const role = m.role === 'assistant' ? 'assistant' : 'user'
          messages.push({ role, content: String(m.content) })
        }

        const userText = String(payload?.userText || '').trim()
        const directionMode = !payload?.kickoff && isDirectionSpec(userText)
        const prevDraft = String((payload as any)?.prevDraft || '').trim()

        if (payload?.kickoff && !userText) {
          messages.push({ role: 'user', content: STAGE_OPENER })
        } else if (userText) {
          // 若已有旧 brief，明确要求模型在旧稿上更新，而不是重开一份
          let content = directionMode ? buildDirectionUserPayload(userText) : userText
          if (prevDraft && hasSubstantialStoryBrief(prevDraft)) {
            content += (
              '\n\n[系统附加要求-旧稿保留]\n' +
              '右侧已有后续方向 brief。请在旧 brief 基础上累积更新：保留仍有效内容，只修订冲突点并补充新增章节/约束。\n' +
              '禁止清空重写导致旧规划丢失。请输出更新后的完整 <draft>。\n\n' +
              '【当前 brief 旧稿】\n' + prevDraft
            )
          }
          messages.push({ role: 'user', content })
        } else {
          return { error: '缺少用户输入', message: '', draft: '', ready: false, suggestions: [] }
        }

        log.info('cocreate-chat', {
          bookId,
          turns: messages.length,
          kickoff: !!payload?.kickoff,
          directionMode,
          userLen: userText.length,
          prevDraftLen: prevDraft.length,
        })

        // 关键原则：brief 由模型更新。本地只在模型失败/元思考时兜底，且与旧稿合并，不抢先覆盖。
        let raw = ''
        try {
          raw = await callChat(messages)
        } catch (e: any) {
          if (directionMode) {
            const fallback = buildFallbackSupplement(userText, prevDraft)
            return {
              error: null,
              message: '模型暂时不可用。已把你的补充并入 brief（保留旧规划），待模型恢复后再精细整理。',
              draft: fallback,
              ready: false,
              suggestions: ['模型恢复后继续整理章纲', '先确认旧规划是否保留完整'],
              summary,
              raw: '',
            }
          }
          throw e
        }

        const parsed = parseCoCreateResponse(raw)
        let message = parsed.message
        let draft = parsed.draft
        let ready = parsed.ready
        let suggestions = parsed.suggestions

        const draftMeta =
          !!draft && (isProtocolMetaDocument(draft) || looksLikeProtocolMetaThinking(draft))
        if (draftMeta) draft = ''

        if (draft) {
          // 模型有效 draft：与旧稿合并，避免覆盖丢失
          draft = prevDraft ? mergeBriefs(prevDraft, draft) : draft
        } else if (prevDraft && hasSubstantialStoryBrief(prevDraft)) {
          // 模型没给出有效 draft：保留旧稿（绝不清空）
          draft = prevDraft
          if (!message || isProtocolMetaDocument(message) || looksLikeProtocolMetaThinking(message)) {
            message = '本轮未得到有效 brief 更新，已保留右侧原有规划。请再发一次更明确的补充点。'
          }
        } else if (directionMode) {
          // 无旧稿且模型失败：才用用户方向做底稿
          draft = buildFallbackSupplement(userText, '')
          if (!message || isProtocolMetaDocument(message) || looksLikeProtocolMetaThinking(message)) {
            message = '已根据你的方向生成初始 brief。你可以继续让我细化章纲，或确认后开始写作。'
          }
        }

        if (!suggestions.length && directionMode) {
          suggestions = ['继续补第4-12章逐章章纲', '检查重复结构风险', '确认方向并准备开写']
        }

        if (!message && !draft) {
          return { error: '模型返回为空', message: '', draft: '', ready: false, suggestions: [], raw }
        }
        return {
          error: null,
          message: message || '本轮已处理。',
          draft: draft || '',
          ready,
          suggestions,
          summary,
          raw: parsed.raw,
        }
      } catch (e: any) {
        log.error('cocreate-chat', e)
        return {
          error: e?.message || String(e),
          message: '',
          draft: '',
          ready: false,
          suggestions: [],
        }
      }
    },
  )
}

module.exports = { register }
