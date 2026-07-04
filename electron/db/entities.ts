/**
 * 角色/配角/时间线/伏笔/关系/状态变化
 */
export function mixinEntities(proto: any) {
  proto.saveCharacters = function (bookId: string, chars: any[]) {
    const del = this.database.prepare('DELETE FROM characters_t WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO characters_t (book_id, name, aliases, role, tier, description, arc, traits, avatar) VALUES (?,?,?,?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const c of chars || []) ins.run(bookId, c.name, JSON.stringify(c.aliases || []), c.role || '', c.tier || 'secondary', c.description || '', c.arc || '', JSON.stringify(c.traits || []), c.avatar || '')
    })
    tx()
  }

  proto.getCharacters = function (bookId: string) {
    const rows = this.database.prepare('SELECT * FROM characters_t WHERE book_id = ? ORDER BY name').all(bookId)
    return rows.map((r: any) => ({ ...r, aliases: typeof r.aliases === 'string' ? JSON.parse(r.aliases) : r.aliases, traits: typeof r.traits === 'string' ? JSON.parse(r.traits) : r.traits }))
  }

  proto.saveCastEntries = function (bookId: string, entries: any[]) {
    const del = this.database.prepare('DELETE FROM cast_entries WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO cast_entries (book_id, name, aliases, brief_role, first_seen, last_seen, appearance_count, appearance_chapters, promoted) VALUES (?,?,?,?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const e of entries || []) ins.run(bookId, e.name, JSON.stringify(e.aliases || []), e.brief_role || '', e.first_seen || e.first_seen_chapter || 0, e.last_seen || e.last_seen_chapter || 0, e.appearance_count || 0, JSON.stringify(e.appearance_chapters || []), e.promoted ? 1 : 0)
    })
    tx()
  }

  proto.getCastEntries = function (bookId: string) {
    const rows = this.database.prepare('SELECT * FROM cast_entries WHERE book_id = ? ORDER BY appearance_count DESC').all(bookId)
    return rows.map((r: any) => ({ ...r, aliases: typeof r.aliases === 'string' ? JSON.parse(r.aliases) : r.aliases, appearance_chapters: typeof r.appearance_chapters === 'string' ? JSON.parse(r.appearance_chapters) : r.appearance_chapters, promoted: !!r.promoted }))
  }

  proto.saveTimelineEvents = function (bookId: string, events: any[]) {
    const del = this.database.prepare('DELETE FROM timeline_events WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO timeline_events (book_id, chapter, time, event, characters) VALUES (?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const e of events || []) ins.run(bookId, e.chapter, e.time || '', e.event || '', JSON.stringify(e.characters || []))
    })
    tx()
  }

  proto.getTimelineEvents = function (bookId: string) {
    const rows = this.database.prepare('SELECT * FROM timeline_events WHERE book_id = ? ORDER BY chapter').all(bookId)
    return rows.map((r: any) => ({ ...r, characters: typeof r.characters === 'string' ? JSON.parse(r.characters) : r.characters }))
  }

  proto.saveForeshadowEntries = function (bookId: string, entries: any[]) {
    const del = this.database.prepare('DELETE FROM foreshadow_entries WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO foreshadow_entries (id, book_id, description, planted_at, status, resolved_at) VALUES (?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const e of entries || []) ins.run(e.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, bookId, e.description || '', e.planted_at ?? e.plantedAt ?? 0, e.status || 'planted', e.resolved_at ?? e.resolvedAt ?? 0)
    })
    tx()
  }

  proto.getForeshadowEntries = function (bookId: string) {
    const rows = this.database.prepare('SELECT * FROM foreshadow_entries WHERE book_id = ? ORDER BY planted_at').all(bookId)
    return rows.map((r: any) => ({
      id: r.id,
      description: r.description || '',
      plantedAt: r.planted_at || 0,
      status: r.status || 'planted',
      resolvedAt: r.resolved_at || 0,
      bookId: r.book_id,
    }))
  }

  proto.saveRelationshipEntries = function (bookId: string, entries: any[]) {
    const del = this.database.prepare('DELETE FROM relationship_entries WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO relationship_entries (book_id, character_a, character_b, relation, chapter) VALUES (?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const e of entries || []) ins.run(bookId, e.character_a ?? e.characterA ?? '', e.character_b ?? e.characterB ?? '', e.relation || '', e.chapter || 0)
    })
    tx()
  }

  proto.getRelationshipEntries = function (bookId: string) {
    const rows = this.database.prepare('SELECT * FROM relationship_entries WHERE book_id = ? ORDER BY chapter').all(bookId)
    return rows.map((r: any) => ({
      id: r.id,
      characterA: r.character_a,
      characterB: r.character_b,
      relation: r.relation || '',
      chapter: r.chapter || 0,
      bookId: r.book_id,
    }))
  }

  proto.saveStateChanges = function (bookId: string, changes: any[]) {
    const del = this.database.prepare('DELETE FROM state_changes WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO state_changes (book_id, chapter, entity, field, old_value, new_value, reason) VALUES (?,?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const c of changes || []) ins.run(bookId, c.chapter, c.entity, c.field || '', c.old_value ?? c.oldValue ?? '', c.new_value ?? c.newValue ?? '', c.reason || '')
    })
    tx()
  }

  proto.getStateChanges = function (bookId: string) {
    const rows = this.database.prepare('SELECT * FROM state_changes WHERE book_id = ? ORDER BY chapter, id').all(bookId)
    return rows.map((r: any) => ({
      id: r.id,
      chapter: r.chapter || 0,
      entity: r.entity || '',
      field: r.field || '',
      oldValue: r.old_value || '',
      newValue: r.new_value || '',
      reason: r.reason || '',
      bookId: r.book_id,
    }))
  }
}
