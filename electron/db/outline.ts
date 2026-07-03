/**
 * 大纲/卷/弧/章节/草稿/计划
 */
export function mixinOutline(proto: any) {
  proto.saveOutlineEntries = function (bookId: string, entries: any[]) {
    const del = this.database.prepare('DELETE FROM outline_entries WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO outline_entries (book_id, chapter, title, core_event, hook, scenes) VALUES (?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const e of entries || []) {
        ins.run(bookId, e.chapter, e.title || '', e.core_event || '', e.hook || '', JSON.stringify(e.scenes || []))
      }
    })
    tx()
  }

  proto.getOutlineEntries = function (bookId: string) {
    const rows = this.database.prepare('SELECT * FROM outline_entries WHERE book_id = ? ORDER BY chapter').all(bookId)
    return rows.map((r: any) => ({ ...r, scenes: typeof r.scenes === 'string' ? JSON.parse(r.scenes) : r.scenes }))
  }

  proto.saveVolumes = function (bookId: string, volumes: any[]) {
    const del = this.database.prepare('DELETE FROM volumes WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO volumes (book_id, idx, title, theme) VALUES (?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const v of volumes || []) ins.run(bookId, v.idx, v.title || '', v.theme || '')
    })
    tx()
  }

  proto.getVolumes = function (bookId: string) {
    return this.database.prepare('SELECT * FROM volumes WHERE book_id = ? ORDER BY idx').all(bookId)
  }

  proto.saveArcs = function (bookId: string, arcs: any[]) {
    const del = this.database.prepare('DELETE FROM arcs WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO arcs (book_id, volume_idx, idx, title, goal, estimated_chapters) VALUES (?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const a of arcs || []) ins.run(bookId, a.volume_idx, a.idx, a.title || '', a.goal || '', a.estimated_chapters || 0)
    })
    tx()
  }

  proto.getArcs = function (bookId: string) {
    return this.database.prepare('SELECT * FROM arcs WHERE book_id = ? ORDER BY volume_idx, idx').all(bookId)
  }

  proto.saveArcChapters = function (bookId: string, chapters: any[]) {
    const del = this.database.prepare('DELETE FROM arc_chapters WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO arc_chapters (book_id, volume_idx, arc_idx, chapter, title, core_event, hook, scenes) VALUES (?,?,?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const c of chapters || []) ins.run(bookId, c.volume_idx, c.arc_idx, c.chapter, c.title || '', c.core_event || '', c.hook || '', JSON.stringify(c.scenes || []))
    })
    tx()
  }

  proto.getArcChapters = function (bookId: string) {
    return this.database.prepare('SELECT * FROM arc_chapters WHERE book_id = ? ORDER BY volume_idx, arc_idx, chapter').all(bookId)
  }

  proto.saveCompass = function (bookId: string, data: any) {
    this.database.prepare(`INSERT OR REPLACE INTO compass (book_id, ending_direction, open_threads, estimated_scale, last_updated) VALUES (?,?,?,?,?)`)
      .run(bookId, data.ending_direction || '', JSON.stringify(data.open_threads || []), data.estimated_scale || '', Date.now())
  }

  proto.getCompass = function (bookId: string) {
    const row = this.database.prepare('SELECT * FROM compass WHERE book_id = ?').get(bookId) as any
    if (!row) return null
    return { ...row, open_threads: typeof row.open_threads === 'string' ? JSON.parse(row.open_threads) : row.open_threads }
  }

  proto.saveChapter = function (bookId: string, num: number, content: string, title: string) {
    const now = new Date().toISOString()
    const wc = content.trim() ? content.trim().length : 0
    this.database.prepare(`INSERT OR REPLACE INTO chapters (book_id, num, title, content, word_count, status, created_at, updated_at) VALUES (?,?,?,?,?,?,COALESCE((SELECT created_at FROM chapters WHERE book_id=? AND num=?),?),?)`)
      .run(bookId, num, title || '', content || '', wc, 'draft', bookId, num, now, now)
  }

  proto.getChapter = function (bookId: string, num: number) {
    const row = this.database.prepare('SELECT * FROM chapters WHERE book_id = ? AND num = ?').get(bookId, num) as any
    if (!row) return null
    const draft = this.getDraft(bookId, num)
    const plan = this.getChapterPlan(bookId, num)
    return { ...row, draft: draft?.content || '', plan }
  }

  proto.listChapters = function (bookId: string) {
    return this.database.prepare('SELECT num, title, word_count, status FROM chapters WHERE book_id = ? ORDER BY num').all(bookId)
  }

  proto.saveDraft = function (bookId: string, num: number, content: string) {
    this.database.prepare(`INSERT OR REPLACE INTO drafts (book_id, num, content) VALUES (?,?,?)`).run(bookId, num, content || '')
  }

  proto.getDraft = function (bookId: string, num: number) {
    return this.database.prepare('SELECT * FROM drafts WHERE book_id = ? AND num = ?').get(bookId, num) || null
  }

  proto.saveChapterPlan = function (bookId: string, plan: any) {
    const ch = plan.chapter
    this.database.prepare(`INSERT OR REPLACE INTO chapter_plans (book_id, chapter, title, goal, conflict, hook, emotion_arc, notes, contract) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(bookId, ch, plan.title || '', plan.goal || '', plan.conflict || '', plan.hook || '', plan.emotion_arc || '', plan.notes || '', JSON.stringify(plan.contract || {}))
  }

  proto.getChapterPlan = function (bookId: string, chapter: number) {
    const row = this.database.prepare('SELECT * FROM chapter_plans WHERE book_id = ? AND chapter = ?').get(bookId, chapter) as any
    if (!row) return null
    return { ...row, contract: typeof row.contract === 'string' ? JSON.parse(row.contract) : row.contract }
  }
}
