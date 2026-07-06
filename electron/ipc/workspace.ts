export {}

/**
 * 创作工作台数据 IPC（大纲/章节/角色/时间线/评审等）
 */
const { state, getDB, getAinovelBinary, GUI_DATA_DIR } = require('../context')
const { createLogger } = require('../logger')
const { join } = require('path')
const { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } = require('fs')
const { cleanChapterTitle } = require('../utils')

const log = createLogger('ipc:workspace')

/** 异步 JSON 写入（不阻塞响应，用于 CLI 兼容） */
function writeJSON(dir: string, rel: string, data: any) {
  try {
    const content = rel.endsWith('.md') ? data : JSON.stringify(data, null, 2)
    writeFileSync(join(dir, rel), content, 'utf8')
  } catch (e: any) { log.error(`writeJSON:${rel}`, e) }
}

function getBookDirById(id: string) {
  try {
    const book = getDB().getBook(id)
    if (book?.workspace_dir) return book.workspace_dir
  } catch (e: any) { log.error('getBookDirById', e) }
  return join(GUI_DATA_DIR, 'books', id)
}

function readStoreJSONAt(dir: string, rel: string) {
  const f = join(dir, rel)
  if (!existsSync(f)) return null
  try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return null }
}

function readStoreTextAt(dir: string, rel: string) {
  const f = join(dir, rel)
  if (!existsSync(f)) return null
  try { return readFileSync(f, 'utf8') } catch { return null }
}

function register(ipcMain: Electron.IpcMain) {
  // ── 大纲 ──
  ipcMain.handle('get-book-outline', async (_e: Electron.IpcMainInvokeEvent, id: string) => {
    const dir = getBookDirById(id)
    if (!dir) return null
    const db = getDB()
    let outline = null, layeredOutline = null, compass = null, premise = null
    try {
      const entries = db.getOutlineEntries(id)
      if (entries?.length) outline = entries
      const volumes = db.getVolumes(id)
      const arcs = db.getArcs(id)
      const arcChapters = db.getArcChapters(id)
      if (volumes?.length) {
        layeredOutline = volumes.map((v: any) => ({
          index: v.idx, title: v.title, theme: v.theme,
          arcs: arcs.filter((a: any) => a.volume_idx === v.idx).map((a: any) => ({
            index: a.idx, title: a.title, goal: a.goal,
            estimatedChapters: a.estimated_chapters,
            chapters: arcChapters.filter((ac: any) => ac.volume_idx === v.idx && ac.arc_idx === a.idx)
              .map((ac: any) => ({ chapter: ac.chapter, title: ac.title, coreEvent: ac.core_event, hook: ac.hook, scenes: ac.scenes })),
          })),
        }))
      }
      compass = db.getCompass(id)
    } catch (e: any) { log.error('get-book-outline:sqlite', e) }
    if (!outline?.length) {
      outline = readStoreJSONAt(dir, 'outline.json')
      try { if (outline?.length) db.saveOutlineEntries(id, outline) } catch (e: any) { log.error('get-outline:save', e) }
    }
    if (!layeredOutline?.length) layeredOutline = readStoreJSONAt(dir, 'layered_outline.json')
    if (!compass) {
      compass = readStoreJSONAt(dir, 'compass.json')
      try { if (compass) db.saveCompass(id, compass) } catch (e: any) { log.error('get-outline:save-compass', e) }
    }
    if (!premise) premise = readStoreTextAt(dir, 'premise.md')
    return { outline, layeredOutline, compass, premise }
  })

  ipcMain.handle('save-book-outline', async (_e: Electron.IpcMainInvokeEvent, id: string, data: any) => {
    const dir = getBookDirById(id)
    if (!dir) return false
    const db = getDB()
    try {
      if (data.outline) db.saveOutlineEntries(id, data.outline)
      if (data.layeredOutline) {
        const layered = data.layeredOutline
        db.saveVolumes(id, layered)
        const allArcs: any[] = []; const allArcChapters: any[] = []
        for (const v of layered) {
          for (const a of (v.arcs || [])) {
            allArcs.push({ volume_idx: v.index || v.idx || 0, idx: a.index || a.idx || 0, title: a.title, goal: a.goal, estimated_chapters: a.estimatedChapters || a.estimated_chapters || 0 })
            for (const ac of (a.chapters || [])) allArcChapters.push({ volume_idx: v.index || v.idx || 0, arc_idx: a.index || a.idx || 0, chapter: ac.chapter || 0, title: ac.title, core_event: ac.coreEvent || ac.core_event || '', hook: ac.hook || '', scenes: ac.scenes || [] })
          }
        }
        db.saveArcs(id, allArcs); db.saveArcChapters(id, allArcChapters)
      }
      if (data.compass) db.saveCompass(id, data.compass)
    } catch (e: any) { log.error('save-book-outline:sqlite', e) }
    // JSON 写（CLI 兼容，不阻塞）
    if (data.outline) writeJSON(dir, 'outline.json', data.outline)
    if (data.layeredOutline) writeJSON(dir, 'layered_outline.json', data.layeredOutline)
    if (data.compass) writeJSON(dir, 'compass.json', data.compass)
    if (data.premise !== undefined) writeFileSync(join(dir, 'premise.md'), data.premise)
    return true
  })

  // ── 章节 ──
  ipcMain.handle('get-book-chapters', async (_e: Electron.IpcMainInvokeEvent, id: string) => {
    const dir = getBookDirById(id)
    if (!dir) return []
    try {
      const dbCh = getDB().listChapters(id)
      if (dbCh?.length) return dbCh.map((c: any) => ({ num: c.num, title: c.title || `第${c.num}章`, wordCount: c.word_count || 0, status: c.status || 'completed' }))
    } catch (e: any) { log.error('get-book-chapters:sqlite', e) }
    const chDir = join(dir, 'chapters')
    if (!existsSync(chDir)) return []
    return readdirSync(chDir).filter((f: string) => f.endsWith('.md')).sort().map((file: string) => {
      const num = parseInt(file.replace('.md', ''), 10)
      if (isNaN(num)) return null
      try {
        const content = readFileSync(join(chDir, file), 'utf8')
        const title = content.split('\n')[0]?.replace(/^#\s*/, '').trim() || `第${num}章`
        try { getDB().saveChapter(id, num, content, title) } catch (e: any) { log.error('get-chapters:sync', e) }
        return { num, title, wordCount: content.length, status: 'completed' }
      } catch (e: any) { log.warn('get-chapters:read', e?.message || e); return { num, title: `第${num}章`, wordCount: 0, status: 'completed' } }
    }).filter(Boolean)
  })

  ipcMain.handle('get-book-chapter', async (_e: Electron.IpcMainInvokeEvent, id: string, num: number) => {
    const dir = getBookDirById(id)
    if (!dir) return null
    try {
      const dbCh = getDB().getChapter(id, num)
      const dbDraft = getDB().getDraft(id, num)
      const dbPlan = getDB().getChapterPlan(id, num)
      if (dbCh?.content) return { num, content: dbCh.content || '', draft: dbDraft?.content || '', plan: dbPlan, title: dbCh.title || '' }
    } catch (e: any) { log.error('get-book-chapter:sqlite', e) }
    const chFile = join(dir, 'chapters', `${String(num).padStart(2, '0')}.md`)
    const draftFile = join(dir, 'drafts', `${String(num).padStart(2, '0')}.draft.md`)
    const planFile = join(dir, 'drafts', `${String(num).padStart(2, '0')}.plan.json`)
    let content = '', draft = '', plan = null
    if (existsSync(chFile)) content = readFileSync(chFile, 'utf8')
    if (existsSync(draftFile)) draft = readFileSync(draftFile, 'utf8')
    if (existsSync(planFile)) { try { plan = JSON.parse(readFileSync(planFile, 'utf8')) } catch (e: any) { log.error('get-chapter:plan', e) } }
    try {
      if (content) getDB().saveChapter(id, num, content, '')
      if (draft) getDB().saveDraft(id, num, draft)
      if (plan) getDB().saveChapterPlan(id, num, plan)
    } catch (e: any) { log.error('get-chapter:sync', e) }
    return { num, content, draft, plan }
  })

  ipcMain.handle('save-book-chapter', async (_e: Electron.IpcMainInvokeEvent, id: string, num: number, content: string, title?: string) => {
    const dir = getBookDirById(id)
    if (!dir) return false
    try { getDB().saveChapter(id, num, content, title || '') } catch (e: any) { log.error('save-chapter', e) }
    // JSON 写（CLI 兼容，写入 chapters/ 子目录）
    const chDir = join(dir, 'chapters')
    if (!existsSync(chDir)) mkdirSync(chDir, { recursive: true })
    writeJSON(chDir, `${String(num).padStart(2, '0')}.md`, content)
    return true
  })

  // ── 角色 ──
  ipcMain.handle('get-book-characters', async (_e: Electron.IpcMainInvokeEvent, id: string) => {
    const dir = getBookDirById(id)
    if (!dir) return []
    try {
      const chars = getDB().getCharacters(id)
      if (chars?.length) return chars
    } catch (e: any) { log.error('get-characters', e) }
    const chars = readStoreJSONAt(dir, 'characters.json') || []
    try { if (chars.length) getDB().saveCharacters(id, chars) } catch (e: any) { log.error('get-characters:sync', e) }
    return chars
  })

  ipcMain.handle('save-book-characters', async (_e: Electron.IpcMainInvokeEvent, id: string, chars: any) => {
    const dir = getBookDirById(id)
    if (!dir) return false
    try { getDB().saveCharacters(id, chars) } catch (e: any) { log.error('save-characters', e) }
    // JSON 写用于 CLI 兼容
    writeJSON(dir, 'characters.json', chars)
    return true
  })

  // ── 时间线 ──
  ipcMain.handle('get-book-timeline', async (_e: Electron.IpcMainInvokeEvent, id: string) => {
    const dir = getBookDirById(id)
    if (!dir) return null
    try {
      const events = getDB().getTimelineEvents(id)
      if (events?.length) return { timeline: events, foreshadow: getDB().getForeshadowEntries(id), relationships: getDB().getRelationshipEntries(id), stateChanges: getDB().getStateChanges(id) }
    } catch (e: any) { log.error('get-timeline:sqlite', e) }
    const timeline = readStoreJSONAt(dir, 'timeline.json') || []
    const foreshadow = readStoreJSONAt(dir, 'foreshadow_ledger.json') || []
    const relationships = readStoreJSONAt(dir, 'relationship_state.json') || []
    const stateChanges = readStoreJSONAt(dir, 'meta/state_changes.json') || []
    try {
      if (timeline.length) getDB().saveTimelineEvents(id, timeline)
      if (foreshadow.length) getDB().saveForeshadowEntries(id, foreshadow)
      if (relationships.length) getDB().saveRelationshipEntries(id, relationships)
      if (stateChanges.length) getDB().saveStateChanges(id, stateChanges)
    } catch (e: any) { log.error('get-timeline:sync', e) }
    return { timeline, foreshadow, relationships, stateChanges }
  })

  // ── 时间线保存 ──
  ipcMain.handle('save-book-timeline', async (_e: Electron.IpcMainInvokeEvent, id: string, data: any) => {
    const dir = getBookDirById(id)
    if (!dir) return false
    const db = getDB()
    try {
      if (data.timeline) db.saveTimelineEvents(id, data.timeline)
      if (data.foreshadow) db.saveForeshadowEntries(id, data.foreshadow)
      if (data.relationships) db.saveRelationshipEntries(id, data.relationships)
      if (data.stateChanges) db.saveStateChanges(id, data.stateChanges)
    } catch (e: any) { log.error('save-timeline:sqlite', e) }
    // JSON 写（CLI 兼容）
    if (data.timeline) writeJSON(dir, 'timeline.json', data.timeline)
    if (data.foreshadow) writeJSON(dir, 'foreshadow_ledger.json', data.foreshadow)
    if (data.relationships) writeJSON(dir, 'relationship_state.json', data.relationships)
    if (data.stateChanges) {
      const metaDir = join(dir, 'meta')
      if (!existsSync(metaDir)) mkdirSync(metaDir, { recursive: true })
      writeJSON(metaDir, 'state_changes.json', data.stateChanges)
    }
    return true
  })

  // ── 评审 ──
  ipcMain.handle('get-book-reviews', async (_e: Electron.IpcMainInvokeEvent, id: string) => {
    const dir = getBookDirById(id)
    if (!dir) return []
    try {
      const reviews = getDB().getReviews(id)
      if (reviews?.length) return reviews
    } catch (e: any) { log.error('get-reviews:sqlite', e) }
    const reviewDir = join(dir, 'reviews')
    if (!existsSync(reviewDir)) return []
    const reviews = readdirSync(reviewDir).filter((f: string) => f.endsWith('.json')).map((file: string) => {
      try { return { ...JSON.parse(readFileSync(join(reviewDir, file), 'utf8')), _file: file } }
      catch { return null }
    }).filter(Boolean).sort((a: any, b: any) => (a.chapter || 0) - (b.chapter || 0))
    try { if (reviews.length) getDB().saveReviews(id, reviews) } catch (e: any) { log.error('get-reviews:sync', e) }
    return reviews
  })

  ipcMain.handle('save-book-review', async (_e: Electron.IpcMainInvokeEvent, id: string, review: any) => {
    const dir = getBookDirById(id)
    if (!dir || !review) return false
    const db = getDB()
    try { db.saveReviews(id, [review]) } catch (e: any) { log.error('save-review:sqlite', e) }
    // JSON 写（CLI 兼容）
    const reviewDir = join(dir, 'reviews')
    if (!existsSync(reviewDir)) mkdirSync(reviewDir, { recursive: true })
    const chNum = review.chapter || 0
    const fname = `review-${String(chNum).padStart(2, '0')}.json`
    writeJSON(reviewDir, fname, review)
    return true
  })

  // ── 仿写画像 ──
  ipcMain.handle('get-simulation-profile', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    try {
      const row = getDB().getSimulationProfile(bookId)
      if (row) return row
    } catch (e: any) { log.error('get-sim-profile', e) }
    const dir = getBookDirById(bookId)
    if (!dir) return null
    const profile = readStoreJSONAt(dir, 'simulation_profile.json')
    if (profile) { try { getDB().saveSimulationProfile(bookId, profile) } catch (e: any) { log.error('get-sim-profile:sync', e) }; return profile }
    return null
  })

  ipcMain.handle('save-simulation-profile', async (_e: Electron.IpcMainInvokeEvent, bookId: string, profile: any) => {
    const dir = getBookDirById(bookId)
    try {
      getDB().saveSimulationProfile(bookId, profile)
      writeJSON(dir, 'simulation_profile.json', profile)
      return true
    } catch (e: any) { log.error('save-sim-profile', e); return false }
  })

  // ── 用户规则 ──
  ipcMain.handle('get-user-rules', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    const dir = getBookDirById(bookId)
    // 内部转换函数
    const transform = (row: any) => {
      if (!row) return null
      const s = row.structured || {}
      return {
        rules: {
          forbiddenCharacters: Array.isArray(s.forbidden_chars) ? s.forbidden_chars : Array.isArray(s.forbiddenCharacters) ? s.forbiddenCharacters : [],
          forbiddenPhrases: Array.isArray(s.forbidden_phrases) ? s.forbidden_phrases : Array.isArray(s.forbiddenPhrases) ? s.forbiddenPhrases : [],
          wordCountRange: (s.chapter_words && typeof s.chapter_words === 'object') ? s.chapter_words : (s.wordCountRange && typeof s.wordCountRange === 'object') ? s.wordCountRange : { min: 0, max: 0 },
          fatigueWords: Array.isArray(s.fatigue_words) ? s.fatigue_words : Array.isArray(s.fatigueWords) ? s.fatigueWords : [],
          stylePreferences: row.preferences || '',
          tabooTopics: Array.isArray(s.tabooTopics) ? s.tabooTopics : [],
          sources: Array.isArray(row.sources) ? row.sources : [],
          uncertain: Array.isArray(row.uncertain) ? row.uncertain : [],
        },
        directives: Array.isArray(row.directives) ? row.directives : [],
      }
    }
    try {
      const row = getDB().getUserRules(bookId)
      if (row) return transform(row)
    } catch (e: any) { log.error('get-user-rules:sqlite', e) }
    // JSON 回退
    const json = readStoreJSONAt(dir, 'user_rules.json')
    if (json) {
      try { getDB().saveUserRules(bookId, json) } catch (e: any) { log.error('get-user-rules:sync', e) }
      return transform(json)
    }
    return null
  })
  ipcMain.handle('save-user-rules', async (_e: Electron.IpcMainInvokeEvent, bookId: string, payload: any) => {
    const dir = getBookDirById(bookId)
    try {
      const r = payload.rules || {}
      const dbPayload = {
        version: payload.version || 1,
        status: payload.status || 'ready',
        structured: {
          forbidden_chars: r.forbiddenCharacters || [],
          forbidden_phrases: r.forbiddenPhrases || [],
          chapter_words: r.wordCountRange || { min: 0, max: 0 },
          fatigue_words: Array.isArray(r.fatigueWords) ? Object.fromEntries(r.fatigueWords.map((w: string) => [w, 1])) : {},
          tabooTopics: r.tabooTopics || [],
        },
        preferences: r.stylePreferences || '',
        sources: r.sources || [],
        uncertain: r.uncertain || [],
      }
      getDB().saveUserRules(bookId, dbPayload)
      writeJSON(dir, 'user_rules.json', dbPayload)
      return true
    } catch (e: any) { log.error('save-user-rules', e); return false }
  })

  // ── 配角名册 ──
  ipcMain.handle('get-book-cast', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    const dir = getBookDirById(bookId)
    try {
      const entries = getDB().getCastEntries(bookId)
      if (entries?.length) return entries
    } catch (e: any) { log.error('get-cast:sqlite', e) }
    // JSON 回退
    const entries = readStoreJSONAt(dir, 'cast_ledger.json') || []
    try { if (entries.length) getDB().saveCastEntries(bookId, entries) } catch (e: any) { log.error('get-cast:sync', e) }
    return entries
  })
  ipcMain.handle('save-book-cast', async (_e: Electron.IpcMainInvokeEvent, bookId: string, entries: any) => {
    const dir = getBookDirById(bookId)
    try { getDB().saveCastEntries(bookId, entries) } catch (e: any) { log.error('save-cast', e) }
    writeJSON(dir, 'cast_ledger.json', entries)
    return true
  })

  // ── 世界观/风格规则 ──
  ipcMain.handle('get-world-rules', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    const dir = getBookDirById(bookId)
    try {
      const rules = getDB().getWorldRules(bookId)
      if (rules?.length) return rules
    } catch (e: any) { log.error('get-world-rules:sqlite', e) }
    const rules = readStoreJSONAt(dir, 'world_rules.json') || []
    try { if (rules.length) getDB().saveWorldRules(bookId, rules) } catch (e: any) { log.error('get-world-rules:sync', e) }
    return rules
  })
  ipcMain.handle('save-world-rules', async (_e: Electron.IpcMainInvokeEvent, bookId: string, rules: any) => {
    try {
      getDB().saveWorldRules(bookId, rules)
      const dir = getBookDirById(bookId)
      writeJSON(dir, 'world_rules.json', rules)
      return true
    }
    catch (e: any) { log.error('save-world-rules', e); return false }
  })
  ipcMain.handle('get-style-rules', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    const dir = getBookDirById(bookId)
    try {
      const rules = getDB().getStyleRules(bookId)
      if (rules) return rules
    } catch (e: any) { log.error('get-style-rules:sqlite', e) }
    const rules = readStoreJSONAt(dir, 'style_rules.json')
    if (rules) { try { getDB().saveStyleRules(bookId, rules) } catch (e: any) { log.error('get-style-rules:sync', e) } }
    return rules
  })
  ipcMain.handle('save-style-rules', async (_e: Electron.IpcMainInvokeEvent, bookId: string, rules: any) => {
    try {
      getDB().saveStyleRules(bookId, rules)
      const dir = getBookDirById(bookId)
      writeJSON(dir, 'style_rules.json', rules)
      return true
    }
    catch (e: any) { log.error('save-style-rules', e); return false }
  })

  // ── 运行元/用量 ──
  ipcMain.handle('get-run-meta', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    const dir = getBookDirById(bookId)
    try {
      const meta = getDB().getRunMeta(bookId)
      if (meta) return meta
    } catch (e: any) { log.error('get-run-meta:sqlite', e) }
    const meta = readStoreJSONAt(dir, 'run.json')
    if (meta) { try { getDB().saveRunMeta(bookId, meta) } catch (e: any) { log.error('get-run-meta:sync', e) } }
    return meta
  })
  ipcMain.handle('save-run-meta', async (_e: Electron.IpcMainInvokeEvent, bookId: string, meta: any) => {
    try {
      getDB().saveRunMeta(bookId, meta)
      const dir = getBookDirById(bookId)
      writeJSON(dir, 'run.json', meta)
      return true
    }
    catch (e: any) { log.error('save-run-meta', e); return false }
  })
  ipcMain.handle('get-usage-stats', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    const dir = getBookDirById(bookId)
    try {
      const stats = getDB().getUsageStats(bookId)
      if (stats) return stats
    } catch (e: any) { log.error('get-usage-stats:sqlite', e) }
    const stats = readStoreJSONAt(dir, 'usage.json')
    if (stats) { try { getDB().saveUsageStats(bookId, stats) } catch (e: any) { log.error('get-usage-stats:sync', e) } }
    return stats
  })
  ipcMain.handle('save-usage-stats', async (_e: Electron.IpcMainInvokeEvent, bookId: string, stats: any) => {
    try {
      getDB().saveUsageStats(bookId, stats)
      const dir = getBookDirById(bookId)
      writeJSON(dir, 'usage.json', stats)
      return true
    }
    catch (e: any) { log.error('save-usage-stats', e); return false }
  })

  // ── 摘要 ──
  ipcMain.handle('get-book-summaries', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    const dir = getBookDirById(bookId)
    try {
      const summaries = getDB().getSummaries(bookId)
      if (summaries?.length) return summaries
    } catch (e: any) { log.error('get-summaries:sqlite', e) }
    // JSON 回退：从 summaries/ 目录读取
    const sumDir = join(dir, 'summaries')
    if (!existsSync(sumDir)) return []
    const files = readdirSync(sumDir).filter((f: string) => f.endsWith('.json'))
    const summaries = files.map((file: string) => readStoreJSONAt(sumDir, file)).filter(Boolean)
    try { if (summaries.length) getDB().saveSummaries(bookId, summaries) } catch (e: any) { log.error('get-summaries:sync', e) }
    return summaries
  })
  ipcMain.handle('save-book-summaries', async (_e: Electron.IpcMainInvokeEvent, bookId: string, summaries: any) => {
    try {
      getDB().saveSummaries(bookId, summaries)
      const dir = getBookDirById(bookId)
      const sumDir = join(dir, 'summaries')
      if (!existsSync(sumDir)) mkdirSync(sumDir, { recursive: true })
      for (const s of (summaries || [])) {
        const refKey = s.ref_key || String(s.chapter || '')
        const fname = s.type === 'chapter' ? `chapter-${refKey}.json` : s.type === 'arc' ? `arc-${refKey}.json` : `volume-${refKey}.json`
        writeJSON(sumDir, fname, s)
      }
      return true
    }
    catch (e: any) { log.error('save-summaries', e); return false }
  })

  // ── 用户指令 ──
  ipcMain.handle('get-user-directives', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    const dir = getBookDirById(bookId)
    try {
      const directives = getDB().getUserDirectives(bookId)
      if (directives?.length) return directives
    } catch (e: any) { log.error('get-directives:sqlite', e) }
    const directives = readStoreJSONAt(dir, 'meta/user_directives.json') || []
    try { if (directives.length) getDB().saveUserDirectives(bookId, directives) } catch (e: any) { log.error('get-directives:sync', e) }
    return directives
  })
  ipcMain.handle('save-user-directives', async (_e: Electron.IpcMainInvokeEvent, bookId: string, directives: any) => {
    try {
      getDB().saveUserDirectives(bookId, directives)
      const dir = getBookDirById(bookId)
      const metaDir = join(dir, 'meta')
      if (!existsSync(metaDir)) mkdirSync(metaDir, { recursive: true })
      writeJSON(metaDir, 'user_directives.json', directives)
      return true
    }
    catch (e: any) { log.error('save-directives', e); return false }
  })

  // ── 全局搜索 ──
  ipcMain.handle('search-book', async (_e: Electron.IpcMainInvokeEvent, bookId: string, query: string) => {
    const q = query.toLowerCase().trim()
    if (!q || q.length < 1) return { chapters: [], characters: [], events: [], outline: [] }
    try {
      const db = getDB()
      // 章节搜索
      const chapters = db.getChapters(bookId)
        .filter((ch: any) => (ch.title || '').toLowerCase().includes(q))
        .map((ch: any) => ({ type: 'chapter', num: ch.num, title: ch.title, match: ch.title }))
      // 角色搜索
      const characters = db.getCharacters(bookId)
        .filter((c: any) => (c.name || '').toLowerCase().includes(q) || (c.role || '').toLowerCase().includes(q))
        .map((c: any) => ({ type: 'character', name: c.name, role: c.role, match: c.name }))
      // 大纲搜索
      const outline = db.getOutlineEntries(bookId)
        .filter((o: any) => (o.title || '').toLowerCase().includes(q) || (o.core_event || '').toLowerCase().includes(q))
        .map((o: any) => ({ type: 'outline', chapter: o.chapter, title: o.title, match: o.title || o.core_event }))
      // 时间线事件搜索
      const events = db.getTimelineEvents(bookId)
        .filter((ev: any) => (ev.event || '').toLowerCase().includes(q))
        .map((ev: any) => ({ type: 'event', chapter: ev.chapter, event: ev.event, match: ev.event }))
      return { chapters, characters, events, outline }
    } catch (e: any) { log.error('search-book', e); return { chapters: [], characters: [], events: [], outline: [] } }
  })

  // ── 批量清洗章节标题 ──
  ipcMain.handle('batch-clean-titles', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    const dir = getBookDirById(bookId)
    if (!dir) return { cleaned: 0, total: 0, error: 'book dir not found' }
    const db = getDB()
    const chDir = join(dir, 'chapters')
    if (!existsSync(chDir)) return { cleaned: 0, total: 0, error: 'chapters dir not found' }
    const files = readdirSync(chDir).filter((f: string) => f.endsWith('.md')).sort()
    let cleaned = 0
    for (const file of files) {
      const num = parseInt(file.replace('.md', ''), 10)
      if (isNaN(num)) continue
      const filePath = join(chDir, file)
      const content = readFileSync(filePath, 'utf8')
      const lines = content.split('\n')
      const firstLine = lines[0] || ''
      const titleMatch = firstLine.match(/^#\s+(.+)/)
      if (!titleMatch) continue
      const rawTitle = titleMatch[1].trim()
      const cleanTitle = cleanChapterTitle(rawTitle, num)
      if (cleanTitle !== rawTitle) {
        // 更新 markdown 文件首行
        lines[0] = `# ${cleanTitle}`
        writeFileSync(filePath, lines.join('\n'), 'utf8')
        // 更新 SQLite
        try { db.saveChapter(bookId, num, content, cleanTitle) } catch (e: any) { log.error('batch-clean:save', e) }
        cleaned++
      }
    }
    return { cleaned, total: files.length }
  })

  // ── AI 批量生成章节标题 ──
  ipcMain.handle('batch-generate-titles', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    const dir = getBookDirById(bookId)
    if (!dir) return { success: false, error: '未找到书籍目录' }
    const db = getDB()
    const chDir = join(dir, 'chapters')
    if (!existsSync(chDir)) return { success: false, error: '未找到章节目录' }

    // 读取 provider 配置
    let providerConfig: any
    try { providerConfig = db.getConfig('provider_config') } catch (e: any) { log.error('batch-gen:config', e) }
    if (!providerConfig) return { success: false, error: '未配置 API Provider，请先在模型管理中设置' }
    // batch-generate-titles 已合并进 batch-audit-book，此 handler 保留为兼容
  })

  // ── 全书评审修复 Agent ──
  ipcMain.handle('batch-audit-book', async (_e: Electron.IpcMainInvokeEvent, bookId: string, apply: boolean = false, startChapter: number = 0, endChapter: number = 0, force: boolean = false) => {
    log.info(`batch-audit:start bookId=${bookId} apply=${apply} range=${startChapter}-${endChapter} force=${force}`)
    const dir = getBookDirById(bookId)
    if (!dir) return { success: false, error: '未找到书籍目录' }
    const db = getDB()
    const chDir = join(dir, 'chapters')
    if (!existsSync(chDir)) return { success: false, error: '未找到章节目录' }

    // 重置取消标记
    state.auditCanceled = false

    // 读取 provider 配置
    let providerConfig: any
    try { providerConfig = db.getConfig('provider_config') } catch (e: any) { log.error('batch-audit:config', e) }
    if (!providerConfig) { log.error('batch-audit:no-provider-config'); return { success: false, error: '未配置 API Provider' } }
    const providerKey = providerConfig.provider || ''
    const model = providerConfig.model || ''
    if (!providerKey || !model) { log.error('batch-audit:no-provider-model', providerKey, model); return { success: false, error: '未配置写作 Provider/Model' } }
    const provider = providerConfig.providers?.[providerKey]
    if (!provider?.api_key) { log.error('batch-audit:no-api-key', providerKey); return { success: false, error: 'API Key 未设置' } }
    log.info(`batch-audit:provider ok key=${providerKey} model=${model}`)

    const baseUrl = (provider.base_url || '').replace(/\/+$/, '')
    const apiUrl = baseUrl + '/chat/completions'
    const headers = { 'Authorization': 'Bearer ' + provider.api_key, 'Content-Type': 'application/json' }

    // 加载上下文：大纲 + 角色 + 时间线 + 伏笔 + 配角名册 + 状态变化
    let outline: any[] = []
    let characters: string[] = []
    let timelineEvents: any[] = []
    let foreshadowEntries: any[] = []
    let castEntries: any[] = []
    let stateChanges: any[] = []
    try {
      outline = db.getOutlineEntries(bookId) || []
      const chars = db.getCharacters(bookId) || []
      characters = chars.map((c: any) => `${c.name}（${c.role || '未知'}）`)
      timelineEvents = db.getTimelineEvents(bookId) || []
      foreshadowEntries = db.getForeshadowEntries(bookId) || []
      castEntries = db.getCastEntries(bookId) || []
      stateChanges = db.getStateChanges(bookId) || []
    } catch (e: any) { log.error('batch-audit:context', e) }
    log.info(`batch-audit:context loaded outline=${outline.length} chars=${characters.length} timeline=${timelineEvents.length} foreshadow=${foreshadowEntries.length} cast=${castEntries.length} state=${stateChanges.length}`)

    // 按章节构建状态变化索引 + 角色生死状态追踪
    const stateChangesByChapter = new Map<number, any[]>()
    // 角色最终状态快照（key=角色名，记录死亡/重伤等不可逆状态及所在章节）
    const charIrreversibleStates = new Map<string, { field: string; value: string; chapter: number }[]>()
    for (const sc of stateChanges) {
      const ch = sc.chapter || 0
      if (!stateChangesByChapter.has(ch)) stateChangesByChapter.set(ch, [])
      stateChangesByChapter.get(ch)!.push(sc)
      // 追踪不可逆状态变更（死亡/重伤/失踪/退场等）
      if (['status', '生死', '状态', 'health', 'hp', '生命'].includes(sc.field || '')) {
        if (!charIrreversibleStates.has(sc.entity)) charIrreversibleStates.set(sc.entity, [])
        charIrreversibleStates.get(sc.entity)!.push({ field: sc.field, value: sc.new_value, chapter: ch })
      }
    }
    // 按章节构建时间线索引
    const timelineByChapter = new Map<number, any[]>()
    for (const ev of timelineEvents) {
      const ch = ev.chapter || 0
      if (!timelineByChapter.has(ch)) timelineByChapter.set(ch, [])
      timelineByChapter.get(ch)!.push(ev)
    }

    // 已出场角色集合（跨章追踪）
    const appearedCharacters = new Set<string>()
    // 后备：所有 core/important 角色默认为已出场
    for (const c of castEntries) appearedCharacters.add(c.name)

    // 闪回/倒叙标记
    const flashbackChapters = new Set<number>()

    const files = readdirSync(chDir).filter((f: string) => f.endsWith('.md')).sort()
    const chapterNums = files.map((f: string) => parseInt(f.replace('.md', ''), 10)).filter((n: number) => !isNaN(n)).sort((a: number, b: number) => a - b)
    const rangeStart = startChapter > 0 ? startChapter : chapterNums[0] || 1
    const rangeEnd = endChapter > 0 ? endChapter : chapterNums[chapterNums.length - 1] || 9999
    const filteredNums = chapterNums.filter((n: number) => n >= rangeStart && n <= rangeEnd)
    const total = filteredNums.length
    const results: any[] = []
    const startTime = Date.now()
    log.info(`batch-audit:range chapters=${chapterNums.length} filtered=${total} range=${rangeStart}-${rangeEnd}`)

    // 加载已审查记录，跳过已审查（除非 force）
    const auditedChapters = new Map<number, any>()
    if (!force) {
      try {
        const audits = db.getAuditedChapters(bookId) || []
        for (const a of audits) auditedChapters.set(a.chapter, a)
      } catch (e: any) { log.error('batch-audit:load-audits', e) }
    }

    let prevAuditSummary = ''

    for (const [idx, num] of filteredNums.entries()) {
      // 检查取消标记
      if (state.auditCanceled) {
        results.push({ chapter: num, oldTitle: `第${num}章`, skipped: true, reason: '用户取消' })
        break
      }

      // 推送进度（在每一步开始前立即发送，即使用于已审查/跳过的章节）
      const elapsed = (Date.now() - startTime) / 1000
      const avgPerItem = idx > 0 ? elapsed / idx : 15
      const remaining = Math.round(avgPerItem * (total - idx))
      try {
        if (state.mainWindow && !state.mainWindow.isDestroyed()) {
          state.mainWindow.webContents.send('audit-progress', {
            current: idx + 1, total, chapter: num,
            elapsed: Math.round(elapsed),
            remaining,
          })
        }
      } catch (e: any) { /* window gone, ignore */ }

      const file = String(num).padStart(2, '0') + '.md'
      const filePath = join(chDir, file)
      const fullContent = readFileSync(filePath, 'utf8')
      const lines = fullContent.split('\n')
      const crypto = require('crypto')
      const contentHash = crypto.createHash('sha256').update(fullContent, 'utf8').digest('hex')

      // 内容哈希跳过：仅当内容未变更时才跳过
      if (auditedChapters.has(num)) {
        const existing = auditedChapters.get(num)
        if (existing.content_hash === contentHash) {
          log.info(`batch-audit:ch${num} skip (unchanged hash=${contentHash.slice(0,8)})`)
          results.push({
            chapter: num, oldTitle: `第${num}章`, skipped: true, reason: '已审查',
            reviewedAt: existing.reviewed_at,
            review: JSON.parse(existing.review_data || '{}').review || {},
          })
          continue
        }
        // 内容已变更，需要重审
        log.info(`batch-audit:chapter ${num} content changed, re-reviewing`)
      }
      const firstLine = lines[0] || ''
      const titleMatch = firstLine.match(/^#\s+(.+)/)
      const oldTitle = titleMatch ? titleMatch[1].trim() : `第${num}章`
      const bodyText = lines.slice(1).join('\n').trim()
      const wordCount = bodyText.length

      if (!bodyText) {
        results.push({ chapter: num, oldTitle, skipped: true, reason: '正文为空' })
        continue
      }

      // 查找对应大纲条目
      const outlineEntry = outline.find((o: any) => o.chapter === num)
      const outlineInfo = outlineEntry
        ? `标题: ${outlineEntry.title}\n核心事件: ${outlineEntry.core_event || '无'}\n钩子: ${outlineEntry.hook || '无'}`
        : '无对应大纲条目'

      // 本章时间线事件
      const chTimeline = timelineByChapter.get(num) || []
      const timelineInfo = chTimeline.length > 0
        ? chTimeline.map((t: any) => `${t.event}（${t.time || '时间未知'}）`).join('\n')
        : '无'

      // 本章伏笔
      const chForeshadow = foreshadowEntries.filter((f: any) => f.planted_at === num || f.resolved_at === num)
      const foreshadowInfo = chForeshadow.length > 0
        ? chForeshadow.map((f: any) => `[${f.status}] ${f.description}（章${f.planted_at}→章${f.resolved_at || '?'}）`).join('\n')
        : '无'

      // 本章角色状态变化
      const chStateChanges = stateChangesByChapter.get(num) || []
      const stateChangeInfo = chStateChanges.length > 0
        ? chStateChanges.map((s: any) => `${s.entity}: ${s.field} → ${s.new_value}（原: ${s.old_value || '无'}，原因: ${s.reason || '未知'}）`).join('\n')
        : '无'

      // 至今为止已死亡/重伤/退场的角色（用于检测"死而复生"问题）
      const deadOrGoneChars: string[] = []
      for (const [name, states] of charIrreversibleStates) {
        const latest = states[states.length - 1]
        if (latest && ['死亡', '死', '战死', '陨落', '身亡', '退场', '失踪', '昏迷', '重伤'].some(k => (latest.value || '').includes(k))) {
          if (latest.chapter < num) deadOrGoneChars.push(`${name}（${latest.value}，第${latest.chapter}章）`)
        }
      }

      // 前一章末尾（衔接检查）
      let prevChapterEnding = ''
      if (num > 1) {
        const prevFile = files.find((f: string) => f.startsWith(String(num - 1).padStart(2, '0') + '.md'))
        if (prevFile) {
          const prevContent = readFileSync(join(chDir, prevFile), 'utf8')
          const prevLines = prevContent.trim().split('\n')
          prevChapterEnding = prevLines.slice(-5).join('\n').slice(0, 500)
        }
      }

      // 前一章审查摘要（跨章上下文）
      if (!prevAuditSummary) {
        // 尝试从上一章加载已保存的审查摘要
        const prevAudit = db.getAuditSummary(bookId, num - 1)
        if (prevAudit?.summary) prevAuditSummary = `第${num-1}章审查结论: ${prevAudit.summary}`
      }

      // 取正文前 3000 字 + 后 1000 字评审用
      const reviewContent = bodyText.length > 4000
        ? bodyText.slice(0, 3000) + '\n\n...（中间省略）...\n\n' + bodyText.slice(-1000)
        : bodyText

      const prompt = `你是一个专业的小说质量评审与修复 Agent。请对本章做全面检查并输出修改建议。

## 章节信息
- 章号: 第 ${num} 章
- 当前标题: ${oldTitle}
- 字数: ${wordCount}
- 对应大纲: ${outlineInfo}

## 本章时间线事件
${timelineInfo}

## 本章关联伏笔
${foreshadowInfo}

## 本章角色状态变化
${stateChangeInfo}

## 之前已死亡/重伤/退场的角色（不应再出现于本章）
${deadOrGoneChars.length > 0 ? deadOrGoneChars.join('\n') : '无'}

## 前一章末尾（衔接参考）
${prevChapterEnding || '无（第一章）'}

## 前一章审查结论
${prevAuditSummary || '无'}

## 角色
${characters.join('\n') || '无'}

## 章节正文
${reviewContent}

## 评审维度（9 项）
1. **标题质量**：标题是否根据本章核心主题提炼、准确概括核心情节或情绪基调
2. **AI 味**：是否存在 AI 套句（"某种程度上""值得注意的是""不知为何"等）、机械排比、过度修饰
3. **节奏结构**：开头是否快速进入冲突/悬念、场景转换是否自然、章末是否有力
4. **大纲对齐**：正文是否与大纲条目一致（核心事件/钩子是否落地）
5. **字数合规**：是否在合理字数范围（短篇 1200-2500，中篇 2500-5000）
6. **内容跨度**：是否存在跨章节的情节跳跃、信息遗漏、与前文矛盾
7. **角色连续性**：是否存在未介绍就突然出现的角色/人名；已有角色是否保持了行为逻辑和身份一致性；**特别检查：已死亡/重伤/退场的角色是否在本章重新出现且未做任何交代（"死而复生"）**
8. **时间线一致性**：故事内时间是否连贯（无时间跳跃/倒叙无标记）、事件先后是否合理、与前章衔接是否自然
9. **情节线索管理**：伏笔是否有起有落，情节线索是否有头有尾，是否突然出现新设定或无故丢弃旧线索

## 输出格式

请严格按以下 JSON Schema 输出（各字段评分范围见下方说明），不要任何多余文字和 Markdown 代码块标记：

评分范围：
- corrected_content: 只有当 issues 不为空或有建议修改时，必须输出完整修正后的章节正文（含 Markdown 标题行）。没有修改时留空。不要省略此字段——有修改就必须输出完整正文。
- title_score / ai_flavor_score / pacing_score / outline_alignment_score / character_continuity_score / timeline_consistency_score / plot_thread_score: 1 到 10 的整数（10=最优）
- word_count_ok: true 或 false

{
  "review": {
    "title_score": 10,
    "ai_flavor_score": 10,
    "pacing_score": 10,
    "outline_alignment_score": 10,
    "word_count_ok": true,
    "character_continuity_score": 10,
    "timeline_consistency_score": 10,
    "plot_thread_score": 10
  },
  "issues": [],
  "strengths": [],
  "suggested_title": "",
  "needs_trimming": false,
  "trimming_suggestion": "",
  "needs_rewrite": false,
  "rewrite_reason": "",
  "missing_introductions": [],
  "character_state_inconsistencies": [],
  "timeline_gaps": [],
  "dropped_threads": [],
  "summary": "",
  "corrected_content": "完整的修正后章节正文，包含修正后的标题行和内容"
}
`
        log.info(`batch-audit:ch${num} reviewing wordCount=${wordCount}`)

      try {
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 4096,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(60000),
        })
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}))
          results.push({ chapter: num, oldTitle, error: `HTTP ${resp.status}: ${errData?.error?.message || resp.statusText}` })
          continue
        }
        const data = await resp.json()
        const raw = data?.choices?.[0]?.message?.content || '{}'
        let parsed: any
        try { parsed = JSON.parse(raw) } catch { parsed = {} }
        log.info(`batch-audit:ch${num} api done title_score=${parsed?.review?.title_score || '?'} issues=${(parsed?.issues || []).length}`)

        const review = parsed.review || {}
        const issues = parsed.issues || []
        const suggestedTitle = parsed.suggested_title || ''
        const needsRewrite = parsed.needs_rewrite || false
        const needsTrimming = parsed.needs_trimming || false
        let applied: string[] = []

        // 应用修复：标题
        if (suggestedTitle && suggestedTitle !== oldTitle) {
          if (apply) {
            lines[0] = `# ${suggestedTitle}`
            writeFileSync(filePath, lines.join('\n'), 'utf8')
            try { db.saveChapter(bookId, num, fullContent, suggestedTitle) } catch (e: any) { log.error('batch-audit:save-title', e) }
          }
          applied.push(`标题: "${oldTitle}" → "${suggestedTitle}"`)
        }

        // 应用修复：修正正文
        const correctedContent = parsed.corrected_content || ''
        if (correctedContent && correctedContent.trim() !== fullContent.trim()) {
          if (apply) {
            writeFileSync(filePath, correctedContent, 'utf8')
            const correctedLines = correctedContent.split('\n')
            const correctedTitleLine = correctedLines[0] || ''
            const correctedTitleMatch = correctedTitleLine.match(/^#\s+(.+)/)
            const correctedTitle = correctedTitleMatch ? correctedTitleMatch[1].trim() : suggestedTitle || oldTitle
            try { db.saveChapter(bookId, num, correctedContent, correctedTitle) } catch (e: any) { log.error('batch-audit:save-content', e) }
          }
          applied.push('正文修正')
        }

        results.push({
          chapter: num,
          oldTitle,
          newTitle: suggestedTitle || oldTitle,
          review,
          issues,
          strengths: parsed.strengths || [],
          missingIntroductions: parsed.missing_introductions || [],
          characterStateInconsistencies: parsed.character_state_inconsistencies || [],
          timelineGaps: parsed.timeline_gaps || [],
          droppedThreads: parsed.dropped_threads || [],
          applied,
          needsRewrite,
          needsTrimming,
          summary: parsed.summary || '',
          error: undefined,
        })

        // 保存审查结果到数据库
        try {
          db.saveAuditResult(bookId, num, { review, issues, strengths: parsed.strengths, suggested_title: suggestedTitle, missing_introductions: parsed.missing_introductions, character_state_inconsistencies: parsed.character_state_inconsistencies, timeline_gaps: parsed.timeline_gaps, dropped_threads: parsed.dropped_threads, summary: parsed.summary }, contentHash)
        } catch (e: any) { log.error('batch-audit:save', e) }
      } catch (e: any) {
        results.push({ chapter: num, oldTitle, error: e.message || '请求失败' })
      }
    }

    return {
      success: true,
      canceled: state.auditCanceled,
      total: files.length,
      // 统计
      stats: (() => {
        const valid = results.filter(r => !r.error && !r.skipped && r.review)
        return {
          reviewed: valid.length,
          contentCorrected: results.filter(r => r.applied?.includes('正文修正')).length,
          titleUpdated: results.filter(r => r.applied?.length > 0 && r.applied[0]?.startsWith('标题')).length,
          needsRewrite: results.filter(r => r.needsRewrite).length,
          needsTrimming: results.filter(r => r.needsTrimming).length,
          errors: results.filter(r => r.error).length,
          skipped: results.filter(r => r.skipped).length,
          avgTitleScore: +(valid.reduce((s, r) => s + (r.review.title_score || 0), 0) / (valid.length || 1)).toFixed(1),
          avgAiFlavorScore: +(valid.reduce((s, r) => s + (r.review.ai_flavor_score || 0), 0) / (valid.length || 1)).toFixed(1),
          avgPacingScore: +(valid.reduce((s, r) => s + (r.review.pacing_score || 0), 0) / (valid.length || 1)).toFixed(1),
          avgOutlineScore: +(valid.reduce((s, r) => s + (r.review.outline_alignment_score || 0), 0) / (valid.length || 1)).toFixed(1),
          avgCharContinuityScore: +(valid.reduce((s, r) => s + (r.review.character_continuity_score || 0), 0) / (valid.length || 1)).toFixed(1),
          avgTimelineScore: +(valid.reduce((s, r) => s + (r.review.timeline_consistency_score || 0), 0) / (valid.length || 1)).toFixed(1),
          avgPlotThreadScore: +(valid.reduce((s, r) => s + (r.review.plot_thread_score || 0), 0) / (valid.length || 1)).toFixed(1),
          totalMissingIntros: results.reduce((s, r) => s + (r.missingIntroductions?.length || 0), 0),
          totalCharStateInconsistencies: results.reduce((s, r) => s + (r.characterStateInconsistencies?.length || 0), 0),
          totalTimelineGaps: results.reduce((s, r) => s + (r.timelineGaps?.length || 0), 0),
          totalDroppedThreads: results.reduce((s, r) => s + (r.droppedThreads?.length || 0), 0),
        }
      })(),
      results,
    }
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    const skipped = results.filter(r => r.skipped).length
    const errors = results.filter(r => r.error).length
    log.info(`batch-audit:done total=${total} reviewed=${results.length - skipped - errors} skipped=${skipped} errors=${errors} elapsed=${elapsed}s`)
  })

  // ── 取消审查 ──
  ipcMain.handle('cancel-audit', async () => {
    state.auditCanceled = true
    return true
  })

  // ── 应用审查修复（不重新调用 LLM，直接从已保存的审查结果中读取并执行）──
  ipcMain.handle('batch-apply-fixes', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    const dir = getBookDirById(bookId)
    if (!dir) return { success: false, error: '未找到书籍目录' }
    const db = getDB()
    const chDir = join(dir, 'chapters')
    if (!existsSync(chDir)) return { success: false, error: '未找到章节目录' }

    const audits = db.getAuditedChapters(bookId) || []
    let titleUpdated = 0
    let contentFixed = 0

    for (const audit of audits) {
      const num = audit.chapter
      const data = JSON.parse(audit.review_data || '{}')
      const suggestedTitle = data.suggested_title || ''
      const correctedContent = data.corrected_content || ''

      if (!suggestedTitle && !correctedContent) continue

      const file = String(num).padStart(2, '0') + '.md'
      const filePath = join(chDir, file)
      if (!existsSync(filePath)) continue

      const fullContent = readFileSync(filePath, 'utf8')
      const lines = fullContent.split('\n')
      const firstLine = lines[0] || ''
      const titleMatch = firstLine.match(/^#\s+(.+)/)
      const oldTitle = titleMatch ? titleMatch[1].trim() : ''

      // 应用标题修复
      if (suggestedTitle && suggestedTitle !== oldTitle) {
        lines[0] = `# ${suggestedTitle}`
        const newContent = lines.join('\n')
        writeFileSync(filePath, newContent, 'utf8')
        try { db.saveChapter(bookId, num, newContent, suggestedTitle) } catch (e: any) { log.error('batch-apply:save-title', e) }
        titleUpdated++
      }

      // 应用正文修复
      if (correctedContent && correctedContent.trim() !== fullContent.trim()) {
        writeFileSync(filePath, correctedContent, 'utf8')
        const correctedLines = correctedContent.split('\n')
        const correctedTitleLine = correctedLines[0] || ''
        const correctedTitleMatch = correctedTitleLine.match(/^#\s+(.+)/)
        const correctedTitle = correctedTitleMatch ? correctedTitleMatch[1].trim() : suggestedTitle || oldTitle
        try { db.saveChapter(bookId, num, correctedContent, correctedTitle) } catch (e: any) { log.error('batch-apply:save-content', e) }
        contentFixed++
      }
    }

    log.info(`batch-apply:done bookId=${bookId} titleUpdated=${titleUpdated} contentFixed=${contentFixed}`)
    return { success: true, titleUpdated, contentFixed }
  })
}

module.exports = { register }
