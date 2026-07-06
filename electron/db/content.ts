/**
 * 评审/世界观/风格规则/摘要/运行元/用量/仿写画像/用户指令
 */
export function mixinContent(proto: any) {
  function readNumber(source: any, keys: string[]) {
    for (const key of keys) {
      const value = source?.[key]
      if (typeof value === 'number') return value
      if (typeof value === 'string' && value.trim() !== '') return Number(value) || 0
    }
    return 0
  }

  function normalizeUsageBucket(bucket: any = {}) {
    return {
      input: readNumber(bucket, ['input', 'input_tokens', 'total_input']),
      output: readNumber(bucket, ['output', 'output_tokens', 'total_output']),
      cacheRead: readNumber(bucket, ['cacheRead', 'cache_read', 'cache_read_tokens']),
      cacheWrite: readNumber(bucket, ['cacheWrite', 'cache_write', 'cache_write_tokens']),
      cost: readNumber(bucket, ['cost', 'total_cost']),
      saved: readNumber(bucket, ['saved', 'total_saved']),
      cacheCapable: !!bucket.cacheCapable,
    }
  }

  function normalizeUsageStats(stats: any = {}) {
    const overall = stats.overall || stats.totals || stats.total || {}
    const perAgent = stats.per_agent || stats.perAgent || {}
    const perModel = stats.per_model || stats.perModel || {}
    return {
      total_input: readNumber(stats, ['total_input', 'totalInput', 'input_tokens']) || normalizeUsageBucket(overall).input,
      total_output: readNumber(stats, ['total_output', 'totalOutput', 'output_tokens']) || normalizeUsageBucket(overall).output,
      total_cost: readNumber(stats, ['total_cost', 'totalCost', 'cost']) || normalizeUsageBucket(overall).cost,
      total_saved: readNumber(stats, ['total_saved', 'totalSaved', 'saved']) || normalizeUsageBucket(overall).saved,
      cache_read: readNumber(stats, ['cache_read', 'cacheRead', 'cache_read_tokens']) || normalizeUsageBucket(overall).cacheRead,
      cache_write: readNumber(stats, ['cache_write', 'cacheWrite', 'cache_write_tokens']) || normalizeUsageBucket(overall).cacheWrite,
      per_agent: Object.fromEntries(Object.entries(perAgent).map(([key, value]) => [key, normalizeUsageBucket(value)])),
      per_model: Object.fromEntries(Object.entries(perModel).map(([key, value]) => [key, normalizeUsageBucket(value)])),
    }
  }

  function normalizeRunMeta(meta: any = {}) {
    return {
      ...meta,
      provider: meta.provider || meta.current_provider || meta.default_provider || '',
      model: meta.model || meta.model_name || meta.current_model || meta.default_model || '',
      started_at: meta.started_at || meta.startedAt || '',
      planning_tier: meta.planning_tier || meta.planningTier || '',
      pending_steer: meta.pending_steer || meta.pendingSteer || '',
      steer_history: meta.steer_history || meta.steerHistory || [],
    }
  }

  proto.saveReviews = function (bookId: string, reviews: any[]) {
    const del = this.database.prepare('DELETE FROM reviews WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO reviews (book_id, chapter, scope, issues, dimensions, contract_status, contract_misses, contract_notes, verdict, summary, affected_chapters) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const r of reviews || []) ins.run(bookId, r.chapter, r.scope || 'chapter', JSON.stringify(r.issues || []), JSON.stringify(r.dimensions || []), r.contract_status || '', JSON.stringify(r.contract_misses || []), r.contract_notes || '', r.verdict || 'accept', r.summary || '', JSON.stringify(r.affected_chapters || []))
    })
    tx()
  }

  proto.getReviews = function (bookId: string) {
    const rows = this.database.prepare('SELECT * FROM reviews WHERE book_id = ? ORDER BY chapter').all(bookId)
    return rows.map((r: any) => ({
      ...r, issues: typeof r.issues === 'string' ? JSON.parse(r.issues) : r.issues,
      dimensions: typeof r.dimensions === 'string' ? JSON.parse(r.dimensions) : r.dimensions,
      contract_misses: typeof r.contract_misses === 'string' ? JSON.parse(r.contract_misses) : r.contract_misses,
      affected_chapters: typeof r.affected_chapters === 'string' ? JSON.parse(r.affected_chapters) : r.affected_chapters,
    }))
  }

  proto.saveWorldRules = function (bookId: string, rules: any[]) {
    const del = this.database.prepare('DELETE FROM world_rules WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO world_rules (book_id, category, rule_text, boundary) VALUES (?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const r of rules || []) ins.run(bookId, r.category || '', r.rule_text || r.rule || '', r.boundary || '')
    })
    tx()
  }

  proto.getWorldRules = function (bookId: string) {
    return this.database.prepare('SELECT * FROM world_rules WHERE book_id = ?').all(bookId)
  }

  proto.saveStyleRules = function (bookId: string, rules: any) {
    this.database.prepare(`INSERT OR REPLACE INTO style_rules (book_id, volume, arc, prose, dialogue, taboos, updated_at) VALUES (?,?,?,?,?,?,?)`)
      .run(bookId, rules.volume || 0, rules.arc || 0, JSON.stringify(rules.prose || []), JSON.stringify(rules.dialogue || []), JSON.stringify(rules.taboos || []), new Date().toISOString())
  }

  proto.getStyleRules = function (bookId: string) {
    const row = this.database.prepare('SELECT * FROM style_rules WHERE book_id = ?').get(bookId) as any
    if (!row) return null
    return { ...row, prose: typeof row.prose === 'string' ? JSON.parse(row.prose) : row.prose, dialogue: typeof row.dialogue === 'string' ? JSON.parse(row.dialogue) : row.dialogue, taboos: typeof row.taboos === 'string' ? JSON.parse(row.taboos) : row.taboos }
  }

  proto.saveRunMeta = function (bookId: string, meta: any) {
    const normalized = normalizeRunMeta(meta)
    this.database.prepare(`INSERT OR REPLACE INTO run_meta (book_id, started_at, provider, style, model, planning_tier, steer_history, pending_steer) VALUES (?,?,?,?,?,?,?,?)`)
      .run(bookId, normalized.started_at || '', normalized.provider || '', normalized.style || '', normalized.model || '', normalized.planning_tier || '', JSON.stringify(normalized.steer_history || []), normalized.pending_steer || '')
  }

  proto.getRunMeta = function (bookId: string) {
    const row = this.database.prepare('SELECT * FROM run_meta WHERE book_id = ?').get(bookId) as any
    if (!row) return null
    return { ...row, steer_history: typeof row.steer_history === 'string' ? JSON.parse(row.steer_history) : row.steer_history }
  }

  proto.saveUsageStats = function (bookId: string, stats: any) {
    const normalized = normalizeUsageStats(stats)
    this.database.prepare(`INSERT OR REPLACE INTO usage_stats (book_id, total_input, total_output, total_cost, total_saved, cache_read, cache_write, per_agent, per_model) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(bookId, normalized.total_input, normalized.total_output, normalized.total_cost, normalized.total_saved, normalized.cache_read, normalized.cache_write, JSON.stringify(normalized.per_agent), JSON.stringify(normalized.per_model))
  }

  proto.getUsageStats = function (bookId: string) {
    const row = this.database.prepare('SELECT * FROM usage_stats WHERE book_id = ?').get(bookId) as any
    if (!row) return null
    return { ...row, per_agent: typeof row.per_agent === 'string' ? JSON.parse(row.per_agent) : row.per_agent, per_model: typeof row.per_model === 'string' ? JSON.parse(row.per_model) : row.per_model }
  }

  proto.saveSummaries = function (bookId: string, summaries: any[]) {
    const del = this.database.prepare('DELETE FROM summaries WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO summaries (book_id, type, ref_key, summary, characters, key_events) VALUES (?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const s of summaries || []) ins.run(bookId, s.type, s.ref_key, s.summary || '', JSON.stringify(s.characters || []), JSON.stringify(s.key_events || []))
    })
    tx()
  }

  proto.getSummaries = function (bookId: string) {
    const rows = this.database.prepare('SELECT * FROM summaries WHERE book_id = ? ORDER BY rowid').all(bookId)
    return rows.map((r: any) => ({ ...r, characters: typeof r.characters === 'string' ? JSON.parse(r.characters) : r.characters, key_events: typeof r.key_events === 'string' ? JSON.parse(r.key_events) : r.key_events }))
  }

  proto.getSummariesByType = function (bookId: string, type: string) {
    const rows = this.database.prepare('SELECT * FROM summaries WHERE book_id = ? AND type = ?').all(bookId, type)
    return rows.map((r: any) => ({ ...r, characters: typeof r.characters === 'string' ? JSON.parse(r.characters) : r.characters, key_events: typeof r.key_events === 'string' ? JSON.parse(r.key_events) : r.key_events }))
  }

  proto.getSimulationProfile = function (bookId: string) {
    const row = this.database.prepare('SELECT * FROM simulation_profiles WHERE book_id = ?').get(bookId) as any
    if (!row) return null
    try { return JSON.parse(row.profile) } catch { return row.profile }
  }

  proto.saveSimulationProfile = function (bookId: string, profile: any) {
    this.database.prepare(`INSERT OR REPLACE INTO simulation_profiles (book_id, profile) VALUES (?,?)`).run(bookId, JSON.stringify(profile))
  }

  proto.saveUserDirectives = function (bookId: string, directives: any[]) {
    const del = this.database.prepare('DELETE FROM user_directives WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO user_directives (book_id, text, chapter, total_chapters, created_at) VALUES (?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const d of directives || []) ins.run(bookId, d.text || d.instruction || '', d.chapter || 0, d.total_chapters || 0, d.created_at || '')
    })
    tx()
  }

  proto.getUserDirectives = function (bookId: string) {
    return this.database.prepare('SELECT * FROM user_directives WHERE book_id = ? ORDER BY chapter').all(bookId)
  }
}
