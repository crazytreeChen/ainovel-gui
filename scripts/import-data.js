/**
 * 数据迁移脚本 — 将 ainovel-cli 输出目录导入到 ainovel-gui SQLite
 *
 * 用法: node scripts/import-data.js
 *
 * 从 /Users/qinglinchen/01-Code/98-Custom/ainovel-cli/output/novel
 * 导入到 ~/.ainovel-gui/ainovel.db
 */

const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const SRC_DIR = '/Users/qinglinchen/01-Code/98-Custom/ainovel-cli/output/novel'
const HOME = require('os').homedir()
const DB_PATH = path.join(HOME, '.ainovel-gui', 'ainovel.db')
const BOOKS_DIR = path.join(HOME, '.ainovel-gui', 'books')

// 确保目录存在
if (!fs.existsSync(path.dirname(DB_PATH))) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
}

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ── 初始化 schema ──
function initSchema() {
  const SCHEMA = `
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
  CREATE TABLE IF NOT EXISTS characters_t (id INTEGER PRIMARY KEY AUTOINCREMENT, book_id TEXT NOT NULL REFERENCES books(id), name TEXT NOT NULL, aliases TEXT DEFAULT '[]', role TEXT DEFAULT '', tier TEXT DEFAULT 'important', description TEXT DEFAULT '', arc TEXT DEFAULT '', traits TEXT DEFAULT '[]');
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
  `
  // 先执行所有 CREATE TABLE（_meta 表也在里面）
  db.exec(SCHEMA)
  // 再检查版本
  const row = db.prepare('SELECT value FROM _meta WHERE key = ?').get('schema_version')
  if (!row) {
    db.exec(SCHEMA)
    db.prepare('INSERT OR REPLACE INTO _meta VALUES (?, ?)').run('schema_version', '1')
    console.log('✅ Schema 初始化完成')
  } else {
    console.log('✅ Schema 已存在')
  }
}

// ── 读取 JSON 工具 ──
function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) } catch { return null }
}

function readText(filePath) {
  if (!fs.existsSync(filePath)) return null
  try { return fs.readFileSync(filePath, 'utf8') } catch { return null }
}

// ── 卷和弧的数据结构 ──
// 从 layered_outline.json 中重建
function importLayeredOutline(bookId, data) {
  if (!data || !Array.isArray(data) || data.length === 0) return

  const volumes = data.map((v, vi) => ({ index: vi + 1, title: v.title || '', theme: v.theme || '' }))

  // 删除旧数据
  db.prepare('DELETE FROM volumes WHERE book_id = ?').run(bookId)
  db.prepare('DELETE FROM arcs WHERE book_id = ?').run(bookId)
  db.prepare('DELETE FROM arc_chapters WHERE book_id = ?').run(bookId)

  // 插入卷
  const insVol = db.prepare('INSERT INTO volumes (book_id, idx, title, theme) VALUES (?,?,?,?)')
  for (const v of volumes) insVol.run(bookId, v.index, v.title, v.theme)

  // 插入弧和章节
  const insArc = db.prepare('INSERT INTO arcs (book_id, volume_idx, idx, title, goal, estimated_chapters, expanded) VALUES (?,?,?,?,?,?,?)')
  const insArcCh = db.prepare('INSERT INTO arc_chapters (book_id, volume_idx, arc_idx, chapter, title, core_event, hook, scenes) VALUES (?,?,?,?,?,?,?,?)')

  data.forEach((v, vi) => {
    const vIdx = vi + 1
    for (const a of (v.arcs || [])) {
      const aIdx = a.index || a.idx || 0
      insArc.run(bookId, vIdx, aIdx, a.title || '', a.goal || '', a.estimatedChapters || 0, 1)
      for (const ch of (a.chapters || [])) {
        insArcCh.run(bookId, vIdx, aIdx, ch.chapter || 0, ch.title || '', ch.coreEvent || '', ch.hook || '', JSON.stringify(ch.scenes || []))
      }
    }
  })

  console.log(`  卷: ${volumes.length} | 弧: ${db.prepare('SELECT COUNT(*) as c FROM arcs WHERE book_id = ?').get(bookId).c}`)
}

// ── 导入摘要 ──
function importSummaries(bookId) {
  const summaryDir = path.join(SRC_DIR, 'summaries')
  if (!fs.existsSync(summaryDir)) { console.log('  摘要: 无'); return }

  const files = fs.readdirSync(summaryDir).filter(f => f.endsWith('.json'))
  const summaries = []

  for (const file of files) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(summaryDir, file), 'utf8'))
      if (s.chapter && !file.startsWith('arc-') && !file.startsWith('vol-')) {
        summaries.push({ type: 'chapter', ref_key: String(s.chapter), summary: s.summary || '', characters: s.characters || [], key_events: s.keyEvents || s.key_events || [] })
      } else if (file.startsWith('arc-')) {
        summaries.push({ type: 'arc', ref_key: file.replace('.json', ''), summary: s.summary || '', characters: [], key_events: s.keyEvents || s.key_events || [] })
      } else if (file.startsWith('vol-')) {
        summaries.push({ type: 'volume', ref_key: file.replace('.json', ''), summary: s.summary || '', characters: [], key_events: s.keyEvents || s.key_events || [] })
      }
    } catch {}
  }

  if (summaries.length > 0) {
    db.prepare('DELETE FROM summaries WHERE book_id = ?').run(bookId)
    const ins = db.prepare('INSERT INTO summaries (book_id, type, ref_key, summary, characters, key_events) VALUES (?,?,?,?,?,?)')
    for (const s of summaries) ins.run(bookId, s.type, s.ref_key, s.summary, JSON.stringify(s.characters), JSON.stringify(s.key_events))
    console.log(`  摘要: ${summaries.length} (章节${summaries.filter(s => s.type === 'chapter').length} / 弧${summaries.filter(s => s.type === 'arc').length} / 卷${summaries.filter(s => s.type === 'volume').length})`)
  }
}

// ── 主函数 ──
function main() {
  console.log('')
  console.log('╔══════════════════════════════════════╗')
  console.log('║    ainovel-cli → ainovel-gui 数据迁徙  ║')
  console.log('╚══════════════════════════════════════╝')
  console.log('')
  console.log(`源目录: ${SRC_DIR}`)

  initSchema()

  // 读取作品元信息
  const progress = readJSON(path.join(SRC_DIR, 'meta', 'progress.json'))
  const premiseRaw = readText(path.join(SRC_DIR, 'premise.md'))
  const bookName = progress?.novelName || '荒土拾遗'

  if (!progress) {
    console.error('❌ 未找到 progress.json，请确认路径正确')
    process.exit(1)
  }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const completedChapters = progress.completedChapters || []
  const wordCounts = progress.chapterWordCounts || {}
  const totalWords = Object.values(wordCounts).reduce((a, b) => a + (Number(b) || 0), 0)

  // 检查书籍是否已存在
  const existing = db.prepare('SELECT id FROM books WHERE name = ?').get(bookName)
  if (existing) {
    console.log(`\n⚠️  书籍「${bookName}」已存在 (id: ${existing.id})`)
    console.log('   跳过创建，如需重新导入请先删除旧记录')
    process.exit(0)
  }

  // 1. 创建书籍
  db.prepare(`INSERT INTO books (id, name, premise, style, planning_tier, phase, flow, layered, total_word_count, workspace_dir, created_at, updated_at, last_opened_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, bookName, premiseRaw || '', 'default', 'long', progress.phase || 'writing', 'writing', progress.layered ? 1 : 0, totalWords, SRC_DIR, now, now, now)
  console.log(`\n📖 书籍: ${bookName}`)
  console.log(`   ID: ${id}`)

  // 2. 进度
  db.prepare(`INSERT INTO progress (book_id, novel_name, phase, current_chapter, total_chapters, completed_chapters, total_word_count, chapter_word_counts, in_progress_chapter, flow, pending_rewrites, rewrite_reason, reopened_from_complete, current_volume, current_arc, layered, strand_history, hook_history) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id, bookName, progress.phase || 'writing', progress.currentChapter || 0, progress.totalChapters || 0, JSON.stringify(completedChapters), totalWords, JSON.stringify(wordCounts), progress.inProgressChapter || 0, progress.flow || 'writing', JSON.stringify(progress.pendingRewrites || []), progress.rewriteReason || '', progress.reopenedFromComplete ? 1 : 0, progress.currentVolume || 0, progress.currentArc || 0, progress.layered ? 1 : 0, JSON.stringify(progress.strandHistory || []), JSON.stringify(progress.hookHistory || []))
  console.log(`   进度: ${completedChapters.length} 章完成 / ${progress.totalChapters || '?'} 总章 / ${totalWords.toLocaleString()} 字`)

  // 3. premise
  if (premiseRaw) console.log(`   前提: ${premiseRaw.slice(0, 40)}...`)

  // 4. 扁平大纲
  const outlineData = readJSON(path.join(SRC_DIR, 'outline.json'))
  if (outlineData && Array.isArray(outlineData) && outlineData.length > 0) {
    db.prepare('DELETE FROM outline_entries WHERE book_id = ?').run(id)
    const ins = db.prepare('INSERT INTO outline_entries (book_id, chapter, title, core_event, hook, scenes) VALUES (?,?,?,?,?,?)')
    for (const e of outlineData) ins.run(id, e.chapter || 0, e.title || '', e.coreEvent || '', e.hook || '', JSON.stringify(e.scenes || []))
    console.log(`   扁平大纲: ${outlineData.length} 条`)
  }

  // 5. 分层大纲
  const layeredOutline = readJSON(path.join(SRC_DIR, 'layered_outline.json'))
  if (layeredOutline && Array.isArray(layeredOutline) && layeredOutline.length > 0) {
    console.log('   分层大纲:')
    for (const v of layeredOutline) {
      console.log(`     卷 ${v.index}: ${v.title} (${v.arcs?.length || 0} 弧)`)
    }
    importLayeredOutline(id, layeredOutline)
  }

  // 6. 指南针
  const compass = readJSON(path.join(SRC_DIR, 'meta', 'compass.json'))
  if (compass) {
    db.prepare('INSERT OR REPLACE INTO compass (book_id, ending_direction, open_threads, estimated_scale, last_updated) VALUES (?,?,?,?,?)')
      .run(id, compass.endingDirection || '', JSON.stringify(compass.openThreads || []), compass.estimatedScale || '', compass.lastUpdated || 0)
    console.log(`   指南针: ${compass.endingDirection ? '有' : '无'}`)
  }

  // 7. 章节
  const chDir = path.join(SRC_DIR, 'chapters')
  if (fs.existsSync(chDir)) {
    const files = fs.readdirSync(chDir).filter(f => f.endsWith('.md')).sort()
    const ins = db.prepare('INSERT INTO chapters (book_id, num, title, content, word_count, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
    for (const file of files) {
      const num = parseInt(file.replace('.md', ''), 10)
      if (isNaN(num)) continue
      const content = fs.readFileSync(path.join(chDir, file), 'utf8')
      const title = content.split('\n')[0]?.replace(/^#\s*/, '').trim() || `第${num}章`
      ins.run(id, num, title, content, content.length, 'completed', now, now)
    }
    console.log(`   章节: ${files.length} 篇`)
  }

  // 8. 草稿
  const draftDir = path.join(SRC_DIR, 'drafts')
  if (fs.existsSync(draftDir)) {
    const files = fs.readdirSync(draftDir).filter(f => f.endsWith('.draft.md'))
    const insDraft = db.prepare('INSERT INTO drafts (book_id, num, content) VALUES (?,?,?)')
    const insPlan = db.prepare('INSERT INTO chapter_plans (book_id, chapter, title, goal, conflict, hook, emotion_arc, notes, contract) VALUES (?,?,?,?,?,?,?,?,?)')
    for (const file of files) {
      const num = parseInt(file.replace('.draft.md', ''), 10)
      if (isNaN(num)) continue
      const content = fs.readFileSync(path.join(draftDir, file), 'utf8')
      insDraft.run(id, num, content)

      // 写作计划
      const planFile = path.join(draftDir, `${String(num).padStart(2, '0')}.plan.json`)
      if (fs.existsSync(planFile)) {
        try {
          const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'))
          insPlan.run(id, num, plan.title || '', plan.goal || '', plan.conflict || '', plan.hook || '', plan.emotion_arc || '', plan.notes || '', JSON.stringify(plan.contract || {}))
        } catch {}
      }
    }
    const planCount = fs.readdirSync(draftDir).filter(f => f.endsWith('.plan.json')).length
    console.log(`   草稿: ${files.length} | 写作计划: ${planCount}`)
  }

  // 9. 角色
  const chars = readJSON(path.join(SRC_DIR, 'characters.json'))
  if (chars && Array.isArray(chars) && chars.length > 0) {
    db.prepare('DELETE FROM characters_t WHERE book_id = ?').run(id)
    const ins = db.prepare('INSERT INTO characters_t (book_id, name, aliases, role, tier, description, arc, traits) VALUES (?,?,?,?,?,?,?,?)')
    for (const c of chars) ins.run(id, c.name || '', JSON.stringify(c.aliases || []), c.role || '', c.tier || 'important', c.description || '', c.arc || '', JSON.stringify(c.traits || []))
    console.log(`   角色: ${chars.length} 个`)
  }

  // 10. 配角名册
  const cast = readJSON(path.join(SRC_DIR, 'meta', 'cast_ledger.json'))
  if (cast && Array.isArray(cast) && cast.length > 0) {
    db.prepare('DELETE FROM cast_entries WHERE book_id = ?').run(id)
    const ins = db.prepare('INSERT INTO cast_entries (book_id, name, aliases, brief_role, first_seen, last_seen, appearance_count, appearance_chapters, promoted) VALUES (?,?,?,?,?,?,?,?,?)')
    for (const e of cast) ins.run(id, e.name || '', JSON.stringify(e.aliases || []), e.briefRole || '', e.firstSeenChapter || 0, e.lastSeenChapter || 0, e.appearanceCount || 0, JSON.stringify(e.appearanceChapters || []), e.promoted ? 1 : 0)
    console.log(`   配角名册: ${cast.length} 条`)
  }

  // 11. 时间线
  const timeline = readJSON(path.join(SRC_DIR, 'timeline.json'))
  if (timeline && Array.isArray(timeline) && timeline.length > 0) {
    db.prepare('DELETE FROM timeline_events WHERE book_id = ?').run(id)
    const ins = db.prepare('INSERT INTO timeline_events (book_id, chapter, time, event, characters) VALUES (?,?,?,?,?)')
    for (const e of timeline) ins.run(id, e.chapter || 0, e.time || '', e.event || '', JSON.stringify(e.characters || []))
    console.log(`   时间线: ${timeline.length} 条`)
  }

  // 12. 伏笔
  const foreshadow = readJSON(path.join(SRC_DIR, 'foreshadow_ledger.json'))
  if (foreshadow && Array.isArray(foreshadow) && foreshadow.length > 0) {
    db.prepare('DELETE FROM foreshadow_entries WHERE book_id = ?').run(id)
    const ins = db.prepare('INSERT INTO foreshadow_entries (id, book_id, description, planted_at, status, resolved_at) VALUES (?,?,?,?,?,?)')
    for (const e of foreshadow) ins.run(e.id || '', id, e.description || '', e.plantedAt || 0, e.status || 'planted', e.resolvedAt || 0)
    console.log(`   伏笔: ${foreshadow.length} 条`)
  }

  // 13. 关系
  const relations = readJSON(path.join(SRC_DIR, 'relationship_state.json'))
  if (relations && Array.isArray(relations) && relations.length > 0) {
    db.prepare('DELETE FROM relationship_entries WHERE book_id = ?').run(id)
    const ins = db.prepare('INSERT INTO relationship_entries (book_id, character_a, character_b, relation, chapter) VALUES (?,?,?,?,?)')
    for (const e of relations) ins.run(id, e.characterA || e.character_a || '', e.characterB || e.character_b || '', e.relation || '', e.chapter || 0)
    console.log(`   关系: ${relations.length} 条`)
  }

  // 14. 状态变化
  const stateChanges = readJSON(path.join(SRC_DIR, 'meta', 'state_changes.json'))
  if (stateChanges && Array.isArray(stateChanges) && stateChanges.length > 0) {
    db.prepare('DELETE FROM state_changes WHERE book_id = ?').run(id)
    const ins = db.prepare('INSERT INTO state_changes (book_id, chapter, entity, field, old_value, new_value, reason) VALUES (?,?,?,?,?,?,?)')
    for (const c of stateChanges) ins.run(id, c.chapter || 0, c.entity || '', c.field || '', c.oldValue || c.old_value || '', c.newValue || c.new_value || '', c.reason || '')
    console.log(`   状态变化: ${stateChanges.length} 条`)
  }

  // 15. 世界观规则
  const worldRules = readJSON(path.join(SRC_DIR, 'world_rules.json'))
  if (worldRules && Array.isArray(worldRules) && worldRules.length > 0) {
    db.prepare('DELETE FROM world_rules WHERE book_id = ?').run(id)
    const ins = db.prepare('INSERT INTO world_rules (book_id, category, rule_text, boundary) VALUES (?,?,?,?)')
    for (const r of worldRules) ins.run(id, r.category || '', r.ruleText || r.rule_text || '', r.boundary || '')
    console.log(`   世界观规则: ${worldRules.length} 条`)
  }

  // 16. 风格规则
  const styleRules = readJSON(path.join(SRC_DIR, 'meta', 'style_rules.json'))
  if (styleRules) {
    db.prepare('INSERT OR REPLACE INTO style_rules (book_id, volume, arc, prose, dialogue, taboos, updated_at) VALUES (?,?,?,?,?,?,?)')
      .run(id, styleRules.volume || 0, styleRules.arc || 0, JSON.stringify(styleRules.prose || []), JSON.stringify(styleRules.dialogue || []), JSON.stringify(styleRules.taboos || []), now)
    console.log(`   风格规则: ${(styleRules.prose || []).length + (styleRules.dialogue || []).length + (styleRules.taboos || []).length} 条`)
  }

  // 17. 评审
  const reviewDir = path.join(SRC_DIR, 'reviews')
  if (fs.existsSync(reviewDir)) {
    const files = fs.readdirSync(reviewDir).filter(f => f.endsWith('.json'))
    const reviews = files.map(f => { try { return JSON.parse(fs.readFileSync(path.join(reviewDir, f), 'utf8')) } catch { return null } }).filter(Boolean)
    if (reviews.length > 0) {
      db.prepare('DELETE FROM reviews WHERE book_id = ?').run(id)
      const ins = db.prepare('INSERT INTO reviews (book_id, chapter, scope, issues, dimensions, contract_status, contract_misses, contract_notes, verdict, summary, affected_chapters) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      for (const r of reviews) ins.run(id, r.chapter || 0, r.scope || 'chapter', JSON.stringify(r.issues || []), JSON.stringify(r.dimensions || []), r.contract_status || '', JSON.stringify(r.contract_misses || []), r.contract_notes || '', r.verdict || 'accept', r.summary || '', JSON.stringify(r.affected_chapters || []))
      console.log(`   评审: ${reviews.length} 条`)
    }
  }

  // 18. 运行元信息
  const runMeta = readJSON(path.join(SRC_DIR, 'meta', 'run.json'))
  if (runMeta) {
    db.prepare('INSERT OR REPLACE INTO run_meta (book_id, started_at, provider, style, model, planning_tier, steer_history, pending_steer) VALUES (?,?,?,?,?,?,?,?)')
      .run(id, runMeta.startedAt || runMeta.started_at || '', runMeta.provider || '', runMeta.style || '', runMeta.model || '', runMeta.planningTier || runMeta.planning_tier || '', JSON.stringify(runMeta.steerHistory || runMeta.steer_history || []), runMeta.pendingSteer || runMeta.pending_steer || '')
    console.log(`   运行元信息: ${runMeta.provider || ''} ${runMeta.model || ''}`)
  }

  // 19. 用量统计
  const usage = readJSON(path.join(SRC_DIR, 'meta', 'usage.json'))
  if (usage) {
    db.prepare('INSERT OR REPLACE INTO usage_stats (book_id, total_input, total_output, total_cost, total_saved, cache_read, cache_write, per_agent, per_model) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(id, usage.totalInput || usage.total_input || 0, usage.totalOutput || usage.total_output || 0, usage.totalCost || usage.total_cost || 0, usage.totalSaved || usage.total_saved || 0, usage.cacheRead || usage.cache_read || 0, usage.cacheWrite || usage.cache_write || 0, JSON.stringify(usage.perAgent || usage.per_agent || {}), JSON.stringify(usage.perModel || usage.per_model || {}))
    const totInput = usage.totalInput || usage.total_input || 0
    const totOutput = usage.totalOutput || usage.total_output || 0
    console.log(`   用量: 输入 ${totInput.toLocaleString()} / 输出 ${totOutput.toLocaleString()} tokens`)
  }

  // 20. 用户规则
  const userRules = readJSON(path.join(SRC_DIR, 'meta', 'user_rules.json'))
  if (userRules) {
    db.prepare('INSERT OR REPLACE INTO user_rules (book_id, version, status, structured, preferences, sources, uncertain) VALUES (?,?,?,?,?,?,?)')
      .run(id, userRules.version || 1, userRules.status || 'ready', JSON.stringify(userRules.structured || {}), userRules.preferences || '', JSON.stringify(userRules.sources || []), JSON.stringify(userRules.uncertain || []))
    console.log(`   用户规则: v${userRules.version || 1}`)
  }

  // 21. 用户指令
  const directives = readJSON(path.join(SRC_DIR, 'meta', 'user_directives.json'))
  if (directives && Array.isArray(directives) && directives.length > 0) {
    const ins = db.prepare('INSERT INTO user_directives (book_id, text, chapter, total_chapters, created_at) VALUES (?,?,?,?,?)')
    for (const d of directives) ins.run(id, d.text || '', d.chapter || 0, d.total_chapters || 0, d.created_at || '')
    console.log(`   用户指令: ${directives.length} 条`)
  }

  // 22. 摘要
  importSummaries(id)

  // 23. 角色快照
  const snapDir = path.join(SRC_DIR, 'meta', 'snapshots')
  if (fs.existsSync(snapDir)) {
    const files = fs.readdirSync(snapDir).filter(f => f.endsWith('.json'))
    const ins = db.prepare('INSERT INTO character_snapshots (book_id, volume, arc, name, status, power, motivation, relations) VALUES (?,?,?,?,?,?,?,?)')
    for (const file of files) {
      const match = file.match(/v(\d+)a(\d+)\.json/)
      if (!match) continue
      try {
        const snapshots = JSON.parse(fs.readFileSync(path.join(snapDir, file), 'utf8'))
        for (const s of snapshots) {
          ins.run(id, parseInt(match[1]), parseInt(match[2]), s.name || '', s.status || '', s.power || '', s.motivation || '', s.relations || '')
        }
      } catch {}
    }
    console.log(`   角色快照: ${files.length} 个文件`)
  }

  console.log('')
  console.log('✅ 导入完成！')
  console.log(`   书籍 ID: ${id}`)
  console.log(`   数据库: ${DB_PATH}`)
  console.log('')
  console.log('   现在可以启动 GUI 查看:')
  console.log('   npm run electron:dev')
  console.log('')
}

main()
db.close()
