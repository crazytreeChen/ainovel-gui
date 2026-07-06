/**
 * 章节审查记录持久化
 */
const crypto = require('crypto')

export function mixinAudit(proto: any) {
  proto.getAuditedChapters = function (bookId: string) {
    return this.database.prepare('SELECT chapter, reviewed_at, review_data, content_hash FROM chapter_audits WHERE book_id = ? ORDER BY chapter').all(bookId) as any[]
  }

  proto.saveAuditResult = function (bookId: string, chapter: number, reviewData: any, contentHash: string = '') {
    const now = new Date().toISOString()
    this.database.prepare(`INSERT OR REPLACE INTO chapter_audits (book_id, chapter, reviewed_at, review_data, content_hash) VALUES (?,?,?,?,?)`)
      .run(bookId, chapter, now, JSON.stringify(reviewData), contentHash)
  }

  proto.getAuditSummary = function (bookId: string, chapter: number) {
    const row = this.database.prepare('SELECT review_data FROM chapter_audits WHERE book_id = ? AND chapter = ?').get(bookId, chapter) as any
    if (!row) return null
    try {
      const data = JSON.parse(row.review_data)
      return { summary: data.summary || '', review: data.review || {} }
    } catch { return null }
  }

  proto.deleteAudits = function (bookId: string) {
    this.database.prepare('DELETE FROM chapter_audits WHERE book_id = ?').run(bookId)
  }
}
