const Database = require('better-sqlite3')
const pathM = require('path')
const fsM = require('fs')
const { mixinBooks } = require('./db/books')
const { mixinOutline } = require('./db/outline')
const { mixinEntities } = require('./db/entities')
const { mixinContent } = require('./db/content')

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS _meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, name TEXT NOT NULL, premise TEXT DEFAULT '', style TEXT DEFAULT 'default', planning_tier TEXT DEFAULT 'short', phase TEXT DEFAULT 'init', flow TEXT DEFAULT 'writing', layered INTEGER DEFAULT 0, total_word_count INTEGER DEFAULT 0, workspace_dir TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_opened_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS progress (book_id TEXT PRIMARY KEY REFERENCES books(id), novel_name TEXT DEFAULT '', phase TEXT DEFAULT 'init', current_chapter INTEGER DEFAULT 0, total_chapters INTEGER DEFAULT 0, completed_chapters TEXT DEFAULT '[]', total_word_count INTEGER DEFAULT 0, chapter_word_counts TEXT DEFAULT '{}', in_progress_chapter INTEGER DEFAULT 0, flow TEXT DEFAULT 'writing', pending_rewrites TEXT DEFAULT '[]', rewrite_reason TEXT DEFAULT '', reopened_from_complete INTEGER DEFAULT 0, current_volume INTEGER DEFAULT 0, current_arc INTEGER DEFAULT 0, layered INTEGER DEFAULT 0, strand_history TEXT DEFAULT '[]', hook_history TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS outline_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), chapter INTEGER NOT NULL, title TEXT DEFAULT '', core_event TEXT DEFAULT '', hook TEXT DEFAULT '', scenes TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS volumes (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), idx INTEGER NOT NULL, title TEXT DEFAULT '', theme TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS arcs (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), volume_idx INTEGER NOT NULL, idx INTEGER NOT NULL, title TEXT DEFAULT '', goal TEXT DEFAULT '', estimated_chapters INTEGER DEFAULT 0, expanded INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS arc_chapters (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), volume_idx INTEGER NOT NULL, arc_idx INTEGER NOT NULL, chapter INTEGER NOT NULL, title TEXT DEFAULT '', core_event TEXT DEFAULT '', hook TEXT DEFAULT '', scenes TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS compass (book_id TEXT PRIMARY KEY REFERENCES books(id), ending_direction TEXT DEFAULT '', open_threads TEXT DEFAULT '[]', estimated_scale TEXT DEFAULT '', last_updated INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS chapters (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), num INTEGER NOT NULL, title TEXT DEFAULT '', content TEXT DEFAULT '', word_count INTEGER DEFAULT 0, status TEXT DEFAULT 'draft', hook_type TEXT DEFAULT '', dominant_strand TEXT DEFAULT '', created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS drafts (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), num INTEGER NOT NULL, content TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS chapter_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), chapter INTEGER NOT NULL, title TEXT DEFAULT '', goal TEXT DEFAULT '', conflict TEXT DEFAULT '', hook TEXT DEFAULT '', emotion_arc TEXT DEFAULT '', notes TEXT DEFAULT '', contract TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS summaries (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), type TEXT NOT NULL, ref_key TEXT NOT NULL, summary TEXT DEFAULT '', characters TEXT DEFAULT '[]', key_events TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS characters_t (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), name TEXT NOT NULL, aliases TEXT DEFAULT '[]', role TEXT DEFAULT '', tier TEXT DEFAULT 'important', description TEXT DEFAULT '', arc TEXT DEFAULT '', traits TEXT DEFAULT '[]', avatar TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS character_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), volume INTEGER NOT NULL, arc INTEGER NOT NULL, name TEXT NOT NULL, status TEXT DEFAULT '', power TEXT DEFAULT '', motivation TEXT DEFAULT '', relations TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS cast_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), name TEXT NOT NULL, aliases TEXT DEFAULT '[]', brief_role TEXT DEFAULT '', first_seen INTEGER DEFAULT 0, last_seen INTEGER DEFAULT 0, appearance_count INTEGER DEFAULT 0, appearance_chapters TEXT DEFAULT '[]', promoted INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS timeline_events (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), chapter INTEGER NOT NULL, time TEXT DEFAULT '', event TEXT DEFAULT '', characters TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS foreshadow_entries (id TEXT NOT NULL, book_id TEXT NOT NULL REFERENCES books(id), description TEXT DEFAULT '', planted_at INTEGER DEFAULT 0, status TEXT DEFAULT 'planted', resolved_at INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS relationship_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), character_a TEXT NOT NULL, character_b TEXT NOT NULL, relation TEXT DEFAULT '', chapter INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS state_changes (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), chapter INTEGER NOT NULL, entity TEXT NOT NULL, field TEXT DEFAULT '', old_value TEXT DEFAULT '', new_value TEXT DEFAULT '', reason TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS world_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), category TEXT DEFAULT '', rule_text TEXT DEFAULT '', boundary TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS style_rules (book_id TEXT PRIMARY KEY REFERENCES books(id), volume INTEGER DEFAULT 0, arc INTEGER DEFAULT 0, prose TEXT DEFAULT '[]', dialogue TEXT DEFAULT '[]', taboos TEXT DEFAULT '[]', updated_at TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), chapter INTEGER NOT NULL, scope TEXT DEFAULT 'chapter', issues TEXT DEFAULT '[]', dimensions TEXT DEFAULT '[]', contract_status TEXT DEFAULT '', contract_misses TEXT DEFAULT '[]', contract_notes TEXT DEFAULT '', verdict TEXT DEFAULT 'accept', summary TEXT DEFAULT '', affected_chapters TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS run_meta (book_id TEXT PRIMARY KEY REFERENCES books(id), started_at TEXT DEFAULT '', provider TEXT DEFAULT '', style TEXT DEFAULT '', model TEXT DEFAULT '', planning_tier TEXT DEFAULT '', steer_history TEXT DEFAULT '[]', pending_steer TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS usage_stats (book_id TEXT PRIMARY KEY REFERENCES books(id), total_input INTEGER DEFAULT 0, total_output INTEGER DEFAULT 0, total_cost REAL DEFAULT 0, total_saved REAL DEFAULT 0, cache_read INTEGER DEFAULT 0, cache_write INTEGER DEFAULT 0, per_agent TEXT DEFAULT '{}', per_model TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS user_rules (book_id TEXT PRIMARY KEY REFERENCES books(id), version INTEGER DEFAULT 1, status TEXT DEFAULT 'ready', structured TEXT DEFAULT '{}', preferences TEXT DEFAULT '', sources TEXT DEFAULT '[]', uncertain TEXT DEFAULT '[]');
CREATE TABLE IF NOT EXISTS simulation_profiles (book_id TEXT PRIMARY KEY REFERENCES books(id), profile TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS user_directives (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), text TEXT NOT NULL, chapter INTEGER DEFAULT 0, total_chapters INTEGER DEFAULT 0, created_at TEXT DEFAULT '');
CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_outline_book ON outline_entries(book_id, chapter);
CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id, num);
CREATE INDEX IF NOT EXISTS idx_characters_book ON characters_t(book_id, name);
CREATE INDEX IF NOT EXISTS idx_reviews_book ON reviews(book_id, chapter);
`

class AppDatabase {
  database: any

  constructor(dbPath: string) {
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
    const hasColumn = (table: string, col: string) => {
      const cols = this.database.prepare(`PRAGMA table_info(${table})`).all() as any[]
      return cols.some((c: any) => c.name === col)
    }
    if (!hasColumn('books', 'tags')) this.database.exec('ALTER TABLE books ADD COLUMN tags TEXT DEFAULT ""')
    if (!hasColumn('characters_t', 'avatar')) this.database.exec('ALTER TABLE characters_t ADD COLUMN avatar TEXT DEFAULT ""')
  }

  close() { this.database.close() }
}

// 混入域方法
mixinBooks(AppDatabase.prototype)
mixinOutline(AppDatabase.prototype)
mixinEntities(AppDatabase.prototype)
mixinContent(AppDatabase.prototype)

module.exports = { AppDatabase }
