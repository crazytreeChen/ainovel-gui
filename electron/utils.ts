/**
 * 章节标题安全清洗 — 仅去除机械噪音，不做语义截断。
 *
 * 安全操作：
 * - 移除 Markdown `# ` 前缀
 * - 移除明显的 AI 赘述括号（如「（本章主要讲述了…）」）
 * - 去除首尾空白
 *
 * 不做：
 * - ❌ 截断到固定字符数
 * - ❌ 移除章节号前缀「第N章」
 * - ❌ 任何语义判断
 *
 * 语义级标题重写（根据章节内容生成 2-8 字标题）走 AI 批量生成流程。
 */
export function cleanChapterTitle(raw: string, chapterNum?: number): string {
  if (!raw || !raw.trim()) {
    return chapterNum ? `第${chapterNum}章` : ''
  }

  let title = raw.trim()

  // 移除 Markdown 标题前缀
  title = title.replace(/^#+\s*/, '')

  // 移除括号及括号内内容（中文/英文括号）— 这些通常是 AI 赘述或注释
  title = title.replace(/[（(][^）)]*[）)]/g, '').trim()

  // 若清洗后为空，回退占位
  if (!title) {
    return chapterNum ? `第${chapterNum}章` : ''
  }

  return title
}

export function getFirstMarkdownTitle(content: string): string {
  const firstLine = content.replace(/^\uFEFF/, '').split('\n')[0] || ''
  const match = firstLine.match(/^#\s+(.+)/)
  return match ? match[1].trim() : ''
}

export function normalizeChapterMarkdown(content: string, fallbackTitle: string, chapterNum: number): string {
  const lines = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n')
  while (lines[0] !== undefined && !lines[0].trim()) lines.shift()

  const leadingTitles: string[] = []
  while (lines[0] !== undefined) {
    const match = lines[0].match(/^#\s+(.+)/)
    if (!match) break
    leadingTitles.push(match[1].trim())
    lines.shift()
    while (lines[0] !== undefined && !lines[0].trim()) lines.shift()
  }

  const title = cleanChapterTitle(fallbackTitle || leadingTitles[0] || '', chapterNum)
  return `# ${title}\n${lines.join('\n').replace(/^\n+/, '')}`
}
