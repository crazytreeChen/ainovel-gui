// @ts-nocheck
const Database = require('better-sqlite3')
const pathM = require('path')
const fsM = require('fs')

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, premise TEXT DEFAULT '', style TEXT DEFAULT 'default',
  planning_tier TEXT DEFAULT 'short', phase TEXT DEFAULT 'init', flow TEXT DEFAULT 'writing',
  layered INTEGER DEFAULT 0, total_word_count INTEGER DEFAULT 0, workspace_dir TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_opened_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS progress (book_id TEXT PRIMARY KEY REFERENCES books(id),
  novel_name TEXT DEFAULT '', phase TEXT DEFAULT 'init', current_chapter INTEGER DEFAULT 0,
  total_chapters INTEGER DEFAULT 0, completed_chapters TEXT DEFAULT '[]',
  total_word_count INTEGER DEFAULT 0, chapter_word_counts TEXT DEFAULT '{}',
  in_progress_chapter INTEGER DEFAULT 0, flow TEXT DEFAULT 'writing',
  pending_rewrites TEXT DEFAULT '[]', rewrite_reason TEXT DEFAULT '',
  reopened_from_complete INTEGER DEFAULT 0, current_volume INTEGER DEFAULT 0,
  current_arc INTEGER DEFAULT 0, layered INTEGER DEFAULT 0,
  strand_history TEXT DEFAULT '[]', hook_history TEXT DEFAULT '[]');

CREATE TABLE IF NOT EXISTS outline_entries (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), chapter INTEGER NOT NULL,
  title TEXT DEFAULT '', core_event TEXT DEFAULT '', hook TEXT DEFAULT '', scenes TEXT DEFAULT '[]');

CREATE TABLE IF NOT EXISTS volumes (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), idx INTEGER NOT NULL, title TEXT DEFAULT '', theme TEXT DEFAULT '');

CREATE TABLE IF NOT EXISTS arcs (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), volume_idx INTEGER NOT NULL, idx INTEGER NOT NULL,
  title TEXT DEFAULT '', goal TEXT DEFAULT '', estimated_chapters INTEGER DEFAULT 0, expanded INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS arc_chapters (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), volume_idx INTEGER NOT NULL, arc_idx INTEGER NOT NULL,
  chapter INTEGER NOT NULL, title TEXT DEFAULT '', core_event TEXT DEFAULT '', hook TEXT DEFAULT '', scenes TEXT DEFAULT '[]');

CREATE TABLE IF NOT EXISTS compass (book_id TEXT PRIMARY KEY REFERENCES books(id),
  ending_direction TEXT DEFAULT '', open_threads TEXT DEFAULT '[]', estimated_scale TEXT DEFAULT '', last_updated INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS chapters (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), num INTEGER NOT NULL, title TEXT DEFAULT '',
  content TEXT DEFAULT '', word_count INTEGER DEFAULT 0, status TEXT DEFAULT 'draft',
  hook_type TEXT DEFAULT '', dominant_strand TEXT DEFAULT '', created_at TEXT, updated_at TEXT);

CREATE TABLE IF NOT EXISTS drafts (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), num INTEGER NOT NULL, content TEXT DEFAULT '');

CREATE TABLE IF NOT EXISTS chapter_plans (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), chapter INTEGER NOT NULL, title TEXT DEFAULT '',
  goal TEXT DEFAULT '', conflict TEXT DEFAULT '', hook TEXT DEFAULT '', emotion_arc TEXT DEFAULT '',
  notes TEXT DEFAULT '', contract TEXT DEFAULT '{}');

CREATE TABLE IF NOT EXISTS summaries (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), type TEXT NOT NULL, ref_key TEXT NOT NULL,
  summary TEXT DEFAULT '', characters TEXT DEFAULT '[]', key_events TEXT DEFAULT '[]');

CREATE TABLE IF NOT EXISTS characters_t (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), name TEXT NOT NULL, aliases TEXT DEFAULT '[]',
  role TEXT DEFAULT '', tier TEXT DEFAULT 'important', description TEXT DEFAULT '',
  arc TEXT DEFAULT '', traits TEXT DEFAULT '[]');

CREATE TABLE IF NOT EXISTS character_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), volume INTEGER NOT NULL, arc INTEGER NOT NULL,
  name TEXT NOT NULL, status TEXT DEFAULT '', power TEXT DEFAULT '', motivation TEXT DEFAULT '', relations TEXT DEFAULT '');

CREATE TABLE IF NOT EXISTS cast_entries (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), name TEXT NOT NULL, aliases TEXT DEFAULT '[]',
  brief_role TEXT DEFAULT '', first_seen INTEGER DEFAULT 0, last_seen INTEGER DEFAULT 0,
  appearance_count INTEGER DEFAULT 0, appearance_chapters TEXT DEFAULT '[]', promoted INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS timeline_events (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), chapter INTEGER NOT NULL,
  time TEXT DEFAULT '', event TEXT DEFAULT '', characters TEXT DEFAULT '[]');

CREATE TABLE IF NOT EXISTS foreshadow_entries (id TEXT NOT NULL, book_id TEXT NOT NULL REFERENCES books(id),
  description TEXT DEFAULT '', planted_at INTEGER DEFAULT 0, status TEXT DEFAULT 'planted', resolved_at INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS relationship_entries (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), character_a TEXT NOT NULL, character_b TEXT NOT NULL,
  relation TEXT DEFAULT '', chapter INTEGER DEFAULT 0);

CREATE TABLE IF NOT EXISTS state_changes (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), chapter INTEGER NOT NULL, entity TEXT NOT NULL,
  field TEXT DEFAULT '', old_value TEXT DEFAULT '', new_value TEXT DEFAULT '', reason TEXT DEFAULT '');

CREATE TABLE IF NOT EXISTS world_rules (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), category TEXT DEFAULT '', rule_text TEXT DEFAULT '', boundary TEXT DEFAULT '');

CREATE TABLE IF NOT EXISTS style_rules (book_id TEXT PRIMARY KEY REFERENCES books(id),
  volume INTEGER DEFAULT 0, arc INTEGER DEFAULT 0, prose TEXT DEFAULT '[]',
  dialogue TEXT DEFAULT '[]', taboos TEXT DEFAULT '[]', updated_at TEXT DEFAULT '');

CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), chapter INTEGER NOT NULL, scope TEXT DEFAULT 'chapter',
  issues TEXT DEFAULT '[]', dimensions TEXT DEFAULT '[]', contract_status TEXT DEFAULT '',
  contract_misses TEXT DEFAULT '[]', contract_notes TEXT DEFAULT '', verdict TEXT DEFAULT 'accept',
  summary TEXT DEFAULT '', affected_chapters TEXT DEFAULT '[]');

CREATE TABLE IF NOT EXISTS run_meta (book_id TEXT PRIMARY KEY REFERENCES books(id),
  started_at TEXT DEFAULT '', provider TEXT DEFAULT '', style TEXT DEFAULT '',
  model TEXT DEFAULT '', planning_tier TEXT DEFAULT '', steer_history TEXT DEFAULT '[]',
  pending_steer TEXT DEFAULT '');

CREATE TABLE IF NOT EXISTS usage_stats (book_id TEXT PRIMARY KEY REFERENCES books(id),
  total_input INTEGER DEFAULT 0, total_output INTEGER DEFAULT 0, total_cost REAL DEFAULT 0,
  total_saved REAL DEFAULT 0, cache_read INTEGER DEFAULT 0, cache_write INTEGER DEFAULT 0,
  per_agent TEXT DEFAULT '{}', per_model TEXT DEFAULT '{}');

CREATE TABLE IF NOT EXISTS user_rules (book_id TEXT PRIMARY KEY REFERENCES books(id),
  version INTEGER DEFAULT 1, status TEXT DEFAULT 'ready', structured TEXT DEFAULT '{}',
  preferences TEXT DEFAULT '', sources TEXT DEFAULT '[]', uncertain TEXT DEFAULT '[]');

CREATE TABLE IF NOT EXISTS simulation_profiles (book_id TEXT PRIMARY KEY REFERENCES books(id), profile TEXT DEFAULT '{}');

CREATE TABLE IF NOT EXISTS user_directives (id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id TEXT NOT NULL REFERENCES books(id), text TEXT NOT NULL, chapter INTEGER DEFAULT 0,
  total_chapters INTEGER DEFAULT 0, created_at TEXT DEFAULT '');

CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE INDEX IF NOT EXISTS idx_outline_book ON outline_entries(book_id, chapter);
CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id, num);
CREATE INDEX IF NOT EXISTS idx_characters_book ON characters_t(book_id, name);
CREATE INDEX IF NOT EXISTS idx_reviews_book ON reviews(book_id, chapter);
`;

class AppDatabase {
  constructor(dbPath) {
    const dir = pathM.dirname(dbPath)
    if (!fsM.existsSync(dir)) fsM.mkdirSync(dir, { recursive: true })
    this.database = new Database(dbPath)
    this.database.pragma('journal_mode = WAL')
    this.database.pragma('foreign_keys = ON')
    this.migrate()
  }

  migrate() {
    const row = this.database.prepare('SELECT value FROM _meta WHERE key = ?').get('schema_version')
    if (!row) {
      this.database.exec(SCHEMA_SQL)
      this.database.prepare('INSERT OR REPLACE INTO _meta VALUES (?, ?)').run('schema_version', '1')
    }
  }

  listBooks() { return this.database.prepare('SELECT * FROM books ORDER BY last_opened_at DESC').all() }

  getBook(id) { return this.database.prepare('SELECT * FROM books WHERE id = ?').get(id) }

  createBook(book) {
    this.database.prepare(`INSERT INTO books (id, name, premise, style, planning_tier, phase, flow, layered, total_word_count, workspace_dir, created_at, updated_at, last_opened_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(book.id, book.name, book.premise, book.style, book.planning_tier, book.phase, book.flow, book.layered ? 1 : 0, book.total_word_count || 0, book.workspace_dir || null, book.created_at, book.updated_at, book.last_opened_at)
    this.database.prepare(`INSERT INTO progress (book_id, novel_name, phase) VALUES (?,?,?)`).run(book.id, book.name, 'init')
    return book
  }

  deleteBook(id) {
    const tables = ['progress', 'outline_entries', 'volumes', 'arcs', 'arc_chapters', 'compass', 'chapters', 'drafts', 'chapter_plans', 'summaries', 'characters_t', 'character_snapshots', 'cast_entries', 'timeline_events', 'foreshadow_entries', 'relationship_entries', 'state_changes', 'world_rules', 'style_rules', 'reviews', 'run_meta', 'usage_stats', 'user_rules', 'simulation_profiles', 'user_directives']
    const del = this.database.transaction(() => {
      for (const t of tables) this.database.prepare(`DELETE FROM ${t} WHERE book_id = ?`).run(id)
      this.database.prepare('DELETE FROM books WHERE id = ?').run(id)
    })
    del()
  }

  getConfig(key) {
    const row = this.database.prepare('SELECT value FROM config WHERE key = ?').get(key)
    return row ? JSON.parse(row.value) : null
  }

  setConfig(key, value) {
    this.database.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?,?)').run(key, JSON.stringify(value))
  }

  getUserRules(bookId) {
    const row = this.database.prepare('SELECT * FROM user_rules WHERE book_id = ?').get(bookId)
    if (!row) return null
    return {
      ...row,
      structured: typeof row.structured === 'string' ? JSON.parse(row.structured) : row.structured,
      sources: typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources,
      uncertain: typeof row.uncertain === 'string' ? JSON.parse(row.uncertain) : row.uncertain,
    }
  }

  saveUserRules(bookId, rules) {
    this.database.prepare(`INSERT OR REPLACE INTO user_rules (book_id, version, status, structured, preferences, sources, uncertain) VALUES (?,?,?,?,?,?,?)`)
      .run(
        bookId,
        rules.version || 1,
        rules.status || 'ready',
        JSON.stringify(rules.structured || {}),
        rules.preferences || '',
        JSON.stringify(rules.sources || []),
        JSON.stringify(rules.uncertain || []),
      )
  }

  getSimulationProfile(bookId) {
    const row = this.database.prepare('SELECT profile FROM simulation_profiles WHERE book_id = ?').get(bookId)
    if (!row) return null
    return typeof row.profile === 'string' ? JSON.parse(row.profile) : row.profile
  }

  saveSimulationProfile(bookId, profile) {
    this.database.prepare('INSERT OR REPLACE INTO simulation_profiles (book_id, profile) VALUES (?,?)')
      .run(bookId, JSON.stringify(profile))
  }

  // ── 大纲管理 ──

  saveOutlineEntries(bookId, entries) {
    const del = this.database.prepare('DELETE FROM outline_entries WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO outline_entries (book_id, chapter, title, core_event, hook, scenes) VALUES (?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const e of entries || []) {
        ins.run(bookId, e.chapter || 0, e.title || '', e.coreEvent || '', e.hook || '', JSON.stringify(e.scenes || []))
      }
    })
    tx()
  }

  getOutlineEntries(bookId) {
    const rows = this.database.prepare('SELECT * FROM outline_entries WHERE book_id = ? ORDER BY chapter').all(bookId)
    return rows.map(r => ({ ...r, scenes: typeof r.scenes === 'string' ? JSON.parse(r.scenes) : r.scenes }))
  }

  saveVolumes(bookId, volumes) {
    const del = this.database.prepare('DELETE FROM volumes WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO volumes (book_id, idx, title, theme) VALUES (?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const v of volumes || []) ins.run(bookId, v.index || v.idx || 0, v.title || '', v.theme || '')
    })
    tx()
  }

  getVolumes(bookId) {
    return this.database.prepare('SELECT * FROM volumes WHERE book_id = ? ORDER BY idx').all(bookId)
  }

  saveArcs(bookId, arcs) {
    const del = this.database.prepare('DELETE FROM arcs WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO arcs (book_id, volume_idx, idx, title, goal, estimated_chapters, expanded) VALUES (?,?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const a of arcs || []) ins.run(bookId, a.volume_idx || a.volumeIdx || 0, a.idx || a.index || 0, a.title || '', a.goal || '', a.estimated_chapters || a.estimatedChapters || 0, a.expanded ? 1 : 0)
    })
    tx()
  }

  getArcs(bookId) {
    return this.database.prepare('SELECT * FROM arcs WHERE book_id = ? ORDER BY volume_idx, idx').all(bookId)
  }

  saveArcChapters(bookId, arcChapters) {
    const del = this.database.prepare('DELETE FROM arc_chapters WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO arc_chapters (book_id, volume_idx, arc_idx, chapter, title, core_event, hook, scenes) VALUES (?,?,?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const ac of arcChapters || []) {
        ins.run(bookId, ac.volume_idx || ac.volumeIdx || 0, ac.arc_idx || ac.arcIdx || 0, ac.chapter || 0, ac.title || '', ac.core_event || ac.coreEvent || '', ac.hook || '', JSON.stringify(ac.scenes || []))
      }
    })
    tx()
  }

  getArcChapters(bookId) {
    const rows = this.database.prepare('SELECT * FROM arc_chapters WHERE book_id = ? ORDER BY volume_idx, arc_idx, chapter').all(bookId)
    return rows.map(r => ({ ...r, scenes: typeof r.scenes === 'string' ? JSON.parse(r.scenes) : r.scenes }))
  }

  saveCompass(bookId, compass) {
    if (!compass) { this.database.prepare('DELETE FROM compass WHERE book_id = ?').run(bookId); return }
    this.database.prepare('INSERT OR REPLACE INTO compass (book_id, ending_direction, open_threads, estimated_scale, last_updated) VALUES (?,?,?,?,?)')
      .run(bookId, compass.endingDirection || compass.ending_direction || '', JSON.stringify(compass.openThreads || compass.open_threads || []), compass.estimatedScale || compass.estimated_scale || '', compass.lastUpdated || compass.last_updated || 0)
  }

  getCompass(bookId) {
    const row = this.database.prepare('SELECT * FROM compass WHERE book_id = ?').get(bookId)
    if (!row) return null
    return {
      endingDirection: row.ending_direction,
      openThreads: typeof row.open_threads === 'string' ? JSON.parse(row.open_threads) : row.open_threads,
      estimatedScale: row.estimated_scale,
      lastUpdated: row.last_updated,
    }
  }

  // ── 章节管理 ──

  saveChapter(bookId, num, content, title) {
    const now = new Date().toISOString()
    const existing = this.database.prepare('SELECT id FROM chapters WHERE book_id = ? AND num = ?').get(bookId, num)
    if (existing) {
      this.database.prepare('UPDATE chapters SET content = ?, title = ?, word_count = ?, updated_at = ? WHERE id = ?')
        .run(content || '', title || '', (content || '').length, now, existing.id)
    } else {
      this.database.prepare('INSERT INTO chapters (book_id, num, title, content, word_count, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .run(bookId, num, title || '', content || '', (content || '').length, 'completed', now, now)
    }
  }

  getChapter(bookId, num) {
    return this.database.prepare('SELECT * FROM chapters WHERE book_id = ? AND num = ?').get(bookId, num)
  }

  listChapters(bookId) {
    return this.database.prepare('SELECT num, title, content, word_count, status FROM chapters WHERE book_id = ? ORDER BY num').all(bookId)
  }

  saveDraft(bookId, num, content) {
    const existing = this.database.prepare('SELECT id FROM drafts WHERE book_id = ? AND num = ?').get(bookId, num)
    if (existing) {
      this.database.prepare('UPDATE drafts SET content = ? WHERE id = ?').run(content || '', existing.id)
    } else {
      this.database.prepare('INSERT INTO drafts (book_id, num, content) VALUES (?,?,?)').run(bookId, num, content || '')
    }
  }

  getDraft(bookId, num) {
    const row = this.database.prepare('SELECT content FROM drafts WHERE book_id = ? AND num = ?').get(bookId, num)
    return row ? row.content : null
  }

  saveChapterPlan(bookId, chapter, plan) {
    const existing = this.database.prepare('SELECT id FROM chapter_plans WHERE book_id = ? AND chapter = ?').get(bookId, chapter)
    if (existing) {
      this.database.prepare('UPDATE chapter_plans SET title=?, goal=?, conflict=?, hook=?, emotion_arc=?, notes=?, contract=? WHERE id=?')
        .run(plan.title || '', plan.goal || '', plan.conflict || '', plan.hook || '', plan.emotion_arc || '', plan.notes || '', JSON.stringify(plan.contract || {}), existing.id)
    } else {
      this.database.prepare('INSERT INTO chapter_plans (book_id, chapter, title, goal, conflict, hook, emotion_arc, notes, contract) VALUES (?,?,?,?,?,?,?,?,?)')
        .run(bookId, chapter, plan.title || '', plan.goal || '', plan.conflict || '', plan.hook || '', plan.emotion_arc || '', plan.notes || '', JSON.stringify(plan.contract || {}))
    }
  }

  getChapterPlan(bookId, chapter) {
    const row = this.database.prepare('SELECT * FROM chapter_plans WHERE book_id = ? AND chapter = ?').get(bookId, chapter)
    if (!row) return null
    return { ...row, contract: typeof row.contract === 'string' ? JSON.parse(row.contract) : row.contract }
  }

  // ── 角色管理 ──

  saveCharacters(bookId, chars) {
    const del = this.database.prepare('DELETE FROM characters_t WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO characters_t (book_id, name, aliases, role, tier, description, arc, traits) VALUES (?,?,?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const c of chars || []) {
        ins.run(bookId, c.name || '', JSON.stringify(c.aliases || []), c.role || '', c.tier || 'important', c.description || '', c.arc || '', JSON.stringify(c.traits || []))
      }
    })
    tx()
  }

  getCharacters(bookId) {
    const rows = this.database.prepare('SELECT * FROM characters_t WHERE book_id = ? ORDER BY name').all(bookId)
    return rows.map(r => ({ ...r, aliases: typeof r.aliases === 'string' ? JSON.parse(r.aliases) : r.aliases, traits: typeof r.traits === 'string' ? JSON.parse(r.traits) : r.traits }))
  }

  // ── 时间线管理 ──

  saveTimelineEvents(bookId, events) {
    const del = this.database.prepare('DELETE FROM timeline_events WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO timeline_events (book_id, chapter, time, event, characters) VALUES (?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const e of events || []) ins.run(bookId, e.chapter || 0, e.time || '', e.event || '', JSON.stringify(e.characters || []))
    })
    tx()
  }

  getTimelineEvents(bookId) {
    const rows = this.database.prepare('SELECT * FROM timeline_events WHERE book_id = ? ORDER BY chapter').all(bookId)
    return rows.map(r => ({ ...r, characters: typeof r.characters === 'string' ? JSON.parse(r.characters) : r.characters }))
  }

  saveForeshadowEntries(bookId, entries) {
    const del = this.database.prepare('DELETE FROM foreshadow_entries WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO foreshadow_entries (id, book_id, description, planted_at, status, resolved_at) VALUES (?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const e of entries || []) ins.run(e.id || '', bookId, e.description || '', e.plantedAt || e.planted_at || 0, e.status || 'planted', e.resolvedAt || e.resolved_at || 0)
    })
    tx()
  }

  getForeshadowEntries(bookId) {
    return this.database.prepare('SELECT * FROM foreshadow_entries WHERE book_id = ? ORDER BY planted_at').all(bookId)
  }

  saveRelationshipEntries(bookId, entries) {
    const del = this.database.prepare('DELETE FROM relationship_entries WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO relationship_entries (book_id, character_a, character_b, relation, chapter) VALUES (?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const e of entries || []) ins.run(bookId, e.characterA || e.character_a || '', e.characterB || e.character_b || '', e.relation || '', e.chapter || 0)
    })
    tx()
  }

  getRelationshipEntries(bookId) {
    return this.database.prepare('SELECT * FROM relationship_entries WHERE book_id = ? ORDER BY chapter').all(bookId)
  }

  saveStateChanges(bookId, changes) {
    const del = this.database.prepare('DELETE FROM state_changes WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO state_changes (book_id, chapter, entity, field, old_value, new_value, reason) VALUES (?,?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const c of changes || []) ins.run(bookId, c.chapter || 0, c.entity || '', c.field || '', c.oldValue || c.old_value || '', c.newValue || c.new_value || '', c.reason || '')
    })
    tx()
  }

  getStateChanges(bookId) {
    return this.database.prepare('SELECT * FROM state_changes WHERE book_id = ? ORDER BY chapter').all(bookId)
  }

  // ── 评审管理 ──

  saveReviews(bookId, reviews) {
    const del = this.database.prepare('DELETE FROM reviews WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO reviews (book_id, chapter, scope, issues, dimensions, contract_status, contract_misses, contract_notes, verdict, summary, affected_chapters) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const r of reviews || []) {
        ins.run(bookId, r.chapter || 0, r.scope || 'chapter', JSON.stringify(r.issues || []), JSON.stringify(r.dimensions || []), r.contract_status || r.contractStatus || '', JSON.stringify(r.contract_misses || r.contractMisses || []), r.contract_notes || r.contractNotes || '', r.verdict || 'accept', r.summary || '', JSON.stringify(r.affected_chapters || r.affectedChapters || []))
      }
    })
    tx()
  }

  getReviews(bookId) {
    const rows = this.database.prepare('SELECT * FROM reviews WHERE book_id = ? ORDER BY chapter').all(bookId)
    return rows.map(r => ({
      ...r,
      issues: typeof r.issues === 'string' ? JSON.parse(r.issues) : r.issues,
      dimensions: typeof r.dimensions === 'string' ? JSON.parse(r.dimensions) : r.dimensions,
      contract_misses: typeof r.contract_misses === 'string' ? JSON.parse(r.contract_misses) : r.contract_misses,
      affected_chapters: typeof r.affected_chapters === 'string' ? JSON.parse(r.affected_chapters) : r.affected_chapters,
    }))
  }

  // ── 配角名册 ──

  saveCastEntries(bookId, entries) {
    const del = this.database.prepare('DELETE FROM cast_entries WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO cast_entries (book_id, name, aliases, brief_role, first_seen, last_seen, appearance_count, appearance_chapters, promoted) VALUES (?,?,?,?,?,?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const e of entries || []) {
        ins.run(bookId, e.name || '', JSON.stringify(e.aliases || []), e.briefRole || e.brief_role || '', e.firstSeenChapter || e.first_seen || 0, e.lastSeenChapter || e.last_seen || 0, e.appearanceCount || e.appearance_count || 0, JSON.stringify(e.appearanceChapters || e.appearance_chapters || []), e.promoted ? 1 : 0)
      }
    })
    tx()
  }

  getCastEntries(bookId) {
    const rows = this.database.prepare('SELECT * FROM cast_entries WHERE book_id = ? ORDER BY appearance_count DESC').all(bookId)
    return rows.map(r => ({
      ...r,
      aliases: typeof r.aliases === 'string' ? JSON.parse(r.aliases) : r.aliases,
      appearanceChapters: typeof r.appearance_chapters === 'string' ? JSON.parse(r.appearance_chapters) : r.appearance_chapters,
      promoted: !!r.promoted,
    }))
  }

  // ── 世界观规则 ──

  saveWorldRules(bookId, rules) {
    const del = this.database.prepare('DELETE FROM world_rules WHERE book_id = ?')
    const ins = this.database.prepare('INSERT INTO world_rules (book_id, category, rule_text, boundary) VALUES (?,?,?,?)')
    const tx = this.database.transaction(() => {
      del.run(bookId)
      for (const r of rules || []) ins.run(bookId, r.category || '', r.ruleText || r.rule_text || '', r.boundary || '')
    })
    tx()
  }

  getWorldRules(bookId) {
    return this.database.prepare('SELECT * FROM world_rules WHERE book_id = ? ORDER BY category, id').all(bookId)
  }

  saveStyleRules(bookId, rules) {
    this.database.prepare('INSERT OR REPLACE INTO style_rules (book_id, volume, arc, prose, dialogue, taboos, updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(bookId, rules.volume || 0, rules.arc || 0, JSON.stringify(rules.prose || []), JSON.stringify(rules.dialogue || []), JSON.stringify(rules.taboos || []), new Date().toISOString())
  }

  getStyleRules(bookId) {
    const row = this.database.prepare('SELECT * FROM style_rules WHERE book_id = ?').get(bookId)
    if (!row) return null
    return { ...row, prose: typeof row.prose === 'string' ? JSON.parse(row.prose) : row.prose, dialogue: typeof row.dialogue === 'string' ? JSON.parse(row.dialogue) : row.dialogue, taboos: typeof row.taboos === 'string' ? JSON.parse(row.taboos) : row.taboos }
  }

  // ── 运行元信息 ──

  saveRunMeta(bookId, meta) {
    this.database.prepare('INSERT OR REPLACE INTO run_meta (book_id, started_at, provider, style, model, planning_tier, steer_history, pending_steer) VALUES (?,?,?,?,?,?,?,?)')
      .run(bookId, meta.startedAt || meta.started_at || '', meta.provider || '', meta.style || '', meta.model || '', meta.planningTier || meta.planning_tier || '', JSON.stringify(meta.steerHistory || meta.steer_history || []), meta.pendingSteer || meta.pending_steer || '')
  }

  getRunMeta(bookId) {
    const row = this.database.prepare('SELECT * FROM run_meta WHERE book_id = ?').get(bookId)
    if (!row) return null
    return { ...row, steerHistory: typeof row.steer_history === 'string' ? JSON.parse(row.steer_history) : row.steer_history }
  }

  // ── 用量统计 ──

  saveUsageStats(bookId, stats) {
    this.database.prepare('INSERT OR REPLACE INTO usage_stats (book_id, total_input, total_output, total_cost, total_saved, cache_read, cache_write, per_agent, per_model) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(bookId, stats.total_input || stats.totalInput || 0, stats.total_output || stats.totalOutput || 0, stats.total_cost || stats.totalCost || 0, stats.total_saved || stats.totalSaved || 0, stats.cache_read || stats.cacheRead || 0, stats.cache_write || stats.cacheWrite || 0, JSON.stringify(stats.per_agent || stats.perAgent || {}), JSON.stringify(stats.per_model || stats.perModel || {}))
  }

  getUsageStats(bookId) {
    const row = this.database.prepare('SELECT * FROM usage_stats WHERE book_id = ?').get(bookId)
    if (!row) return null
    return { ...row, per_agent: typeof row.per_agent === 'string' ? JSON.parse(row.per_agent) : row.per_agent, per_model: typeof row.per_model === 'string' ? JSON.parse(row.per_model) : row.per_model }
  }

  // ── 书籍编辑 ──

  updateBook(id, fields) {
    const sets = []
    const params = []
    if (fields.name !== undefined) { sets.push('name = ?'); params.push(fields.name) }
    if (fields.style !== undefined) { sets.push('style = ?'); params.push(fields.style) }
    if (fields.premise !== undefined) { sets.push('premise = ?'); params.push(fields.premise) }
    if (fields.phase !== undefined) { sets.push('phase = ?'); params.push(fields.phase) }
    params.push(new Date().toISOString(), id)
    if (sets.length > 0) {
      this.database.prepare(`UPDATE books SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`).run(...params)
    }
  }

  close() { this.database.close() }
}

module.exports = { AppDatabase }
