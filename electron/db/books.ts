/**
 * 书籍管理 + 配置
 */
export function mixinBooks(proto: any) {
  proto.listBooks = function () {
    const rows = this.database.prepare(`
      SELECT b.*, 
        COALESCE(p.completed_chapters, '[]') as completed_chapters_json,
        COALESCE(p.total_word_count, 0) as total_word_count,
        COALESCE(p.phase, b.phase) as phase,
        COALESCE(p.current_chapter, 0) as current_chapter
      FROM books b
      LEFT JOIN progress p ON p.book_id = b.id
      ORDER BY b.last_opened_at DESC
    `).all() as any[]
    return rows.map((r: any) => ({
      ...r,
      completedCount: JSON.parse(r.completed_chapters_json || '[]').length,
      tags: r.tags || '',
      totalWordCount: r.total_word_count || 0,
    }))
  }

  proto.getBook = function (id: string) {
    return this.database.prepare('SELECT * FROM books WHERE id = ?').get(id) || null
  }

  proto.createBook = function (book: Record<string, any>) {
    const now = book.created_at || new Date().toISOString()
    this.database.prepare(`INSERT INTO books 
      (id, name, premise, style, planning_tier, phase, flow, layered, total_word_count, workspace_dir, tags, created_at, updated_at, last_opened_at) 
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(
        book.id, book.name || '',
        book.premise || '', book.style || 'default',
        book.planning_tier || 'short', book.phase || 'init',
        book.flow || 'writing', book.layered ? 1 : 0,
        book.total_word_count || 0, book.workspace_dir || '',
        book.tags || '', now, now, now,
      )
    return this.getBook(book.id)
  }

  proto.deleteBook = function (id: string) {
    const tables = ['progress', 'outline_entries', 'volumes', 'arcs', 'arc_chapters', 'compass', 'chapters', 'drafts', 'chapter_plans', 'summaries', 'characters_t', 'character_snapshots', 'cast_entries', 'timeline_events', 'foreshadow_entries', 'relationship_entries', 'state_changes', 'world_rules', 'style_rules', 'reviews', 'run_meta', 'usage_stats', 'user_rules', 'simulation_profiles', 'user_directives']
    const del = this.database.transaction(() => {
      for (const t of tables) this.database.prepare(`DELETE FROM ${t} WHERE book_id = ?`).run(id)
      this.database.prepare('DELETE FROM books WHERE id = ?').run(id)
    })
    del()
  }

  proto.updateBook = function (id: string, fields: Record<string, any>) {
    const update = this.database.transaction(() => {
      const book = this.database.prepare('SELECT * FROM books WHERE id = ?').get(id) as any
      if (!book) return false
      const merged = { ...book, ...fields, updated_at: new Date().toISOString() }
      this.database.prepare(`INSERT OR REPLACE INTO books 
        (id, name, premise, style, planning_tier, phase, flow, layered, total_word_count, workspace_dir, tags, created_at, updated_at, last_opened_at) 
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(
          merged.id, merged.name || '', merged.premise || '',
          merged.style || 'default', merged.planning_tier || 'short',
          merged.phase || 'init', merged.flow || 'writing',
          merged.layered ? 1 : 0, merged.total_word_count || 0,
          merged.workspace_dir || '', merged.tags || '',
          merged.created_at, merged.updated_at, merged.last_opened_at,
        )
      return true
    })
    return update()
  }

  proto.getConfig = function (key: string) {
    const row = this.database.prepare('SELECT value FROM config WHERE key = ?').get(key) as any
    if (!row) return null
    try { return JSON.parse(row.value) } catch { return row.value }
  }

  proto.setConfig = function (key: string, value: any) {
    this.database.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?,?)').run(key, JSON.stringify(value))
  }

  proto.getUserRules = function (bookId: string) {
    const row = this.database.prepare('SELECT * FROM user_rules WHERE book_id = ?').get(bookId)
    if (!row) return null
    return {
      ...row,
      structured: typeof row.structured === 'string' ? JSON.parse(row.structured) : row.structured,
      sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources,
      uncertain: typeof row.uncertain === 'string' ? JSON.parse(row.uncertain) : row.uncertain,
    }
  }

  proto.saveUserRules = function (bookId: string, rules: any) {
    this.database.prepare(`INSERT OR REPLACE INTO user_rules (book_id, version, status, structured, preferences, sources, uncertain) VALUES (?,?,?,?,?,?,?)`)
      .run(bookId, rules.version || 1, rules.status || 'ready',
        JSON.stringify(rules.structured || {}), rules.preferences || '',
        JSON.stringify(rules.sources || []), JSON.stringify(rules.uncertain || []))
  }
}
