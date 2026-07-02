export {}

/**
 * 创作工作台数据 IPC（大纲/章节/角色/时间线/评审等）
 */
const { state, getDB, getAinovelBinary, GUI_DATA_DIR } = require('../context')
const { createLogger } = require('../logger')
const { join } = require('path')
const { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } = require('fs')

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
    if (book) return join(GUI_DATA_DIR, 'books', id)
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
      if (dbCh?.content) return { num, content: dbCh.content || '', draft: dbDraft || '', plan: dbPlan }
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

  ipcMain.handle('save-book-chapter', async (_e: Electron.IpcMainInvokeEvent, id: string, num: number, content: string) => {
    const dir = getBookDirById(id)
    if (!dir) return false
    try { getDB().saveChapter(id, num, content, '') } catch (e: any) { log.error('save-chapter', e) }
    // JSON 写（CLI 兼容）
    writeJSON(dir, `${String(num).padStart(2, '0')}.md`, content)
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
    try {
      getDB().saveSimulationProfile(bookId, profile)
      return true
    } catch (e: any) { log.error('save-sim-profile', e); return false }
  })

  // ── 用户规则 ──
  ipcMain.handle('get-user-rules', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    try { return getDB().getUserRules(bookId) }
    catch (e: any) { log.error('get-user-rules', e); return null }
  })
  ipcMain.handle('save-user-rules', async (_e: Electron.IpcMainInvokeEvent, bookId: string, rules: any) => {
    try { getDB().saveUserRules(bookId, rules); return true }
    catch (e: any) { log.error('save-user-rules', e); return false }
  })

  // ── 配角名册 ──
  ipcMain.handle('get-book-cast', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    try { return getDB().getCastEntries(bookId) }
    catch (e: any) { log.error('get-cast', e); return [] }
  })
  ipcMain.handle('save-book-cast', async (_e: Electron.IpcMainInvokeEvent, bookId: string, entries: any) => {
    try { getDB().saveCastEntries(bookId, entries); return true }
    catch (e: any) { log.error('save-cast', e); return false }
  })

  // ── 世界观/风格规则 ──
  ipcMain.handle('get-world-rules', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    try { return getDB().getWorldRules(bookId) }
    catch (e: any) { log.error('get-world-rules', e); return [] }
  })
  ipcMain.handle('save-world-rules', async (_e: Electron.IpcMainInvokeEvent, bookId: string, rules: any) => {
    try { getDB().saveWorldRules(bookId, rules); return true }
    catch (e: any) { log.error('save-world-rules', e); return false }
  })
  ipcMain.handle('get-style-rules', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    try { return getDB().getStyleRules(bookId) }
    catch (e: any) { log.error('get-style-rules', e); return null }
  })
  ipcMain.handle('save-style-rules', async (_e: Electron.IpcMainInvokeEvent, bookId: string, rules: any) => {
    try { getDB().saveStyleRules(bookId, rules); return true }
    catch (e: any) { log.error('save-style-rules', e); return false }
  })

  // ── 运行元/用量 ──
  ipcMain.handle('get-run-meta', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    try { return getDB().getRunMeta(bookId) }
    catch (e: any) { log.error('get-run-meta', e); return null }
  })
  ipcMain.handle('save-run-meta', async (_e: Electron.IpcMainInvokeEvent, bookId: string, meta: any) => {
    try { getDB().saveRunMeta(bookId, meta); return true }
    catch (e: any) { log.error('save-run-meta', e); return false }
  })
  ipcMain.handle('get-usage-stats', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    try { return getDB().getUsageStats(bookId) }
    catch (e: any) { log.error('get-usage-stats', e); return null }
  })
  ipcMain.handle('save-usage-stats', async (_e: Electron.IpcMainInvokeEvent, bookId: string, stats: any) => {
    try { getDB().saveUsageStats(bookId, stats); return true }
    catch (e: any) { log.error('save-usage-stats', e); return false }
  })

  // ── 摘要 ──
  ipcMain.handle('get-book-summaries', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    try { return getDB().getSummaries(bookId) }
    catch (e: any) { log.error('get-summaries', e); return [] }
  })
  ipcMain.handle('save-book-summaries', async (_e: Electron.IpcMainInvokeEvent, bookId: string, summaries: any) => {
    try { getDB().saveSummaries(bookId, summaries); return true }
    catch (e: any) { log.error('save-summaries', e); return false }
  })

  // ── 用户指令 ──
  ipcMain.handle('get-user-directives', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    try { return getDB().getUserDirectives(bookId) }
    catch (e: any) { log.error('get-directives', e); return [] }
  })
  ipcMain.handle('save-user-directives', async (_e: Electron.IpcMainInvokeEvent, bookId: string, directives: any) => {
    try { getDB().saveUserDirectives(bookId, directives); return true }
    catch (e: any) { log.error('save-directives', e); return false }
  })
}

module.exports = { register }
