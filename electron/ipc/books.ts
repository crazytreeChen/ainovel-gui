// @ts-nocheck — CJS IPC 模块
/**
 * 书籍管理 IPC 处理器
 */
const { state, getDB, getAinovelBinary, GUI_DATA_DIR, home } = require('../context')
const { createLogger } = require('../logger')
const { validatePath } = require('../path-validator')
const { join, dirname } = require('path')
const { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync, unlinkSync } = require('fs')
const os = require('os')

const log = createLogger('ipc:books')

function register(ipcMain) {
  ipcMain.handle('list-books', async () => {
    try { return getDB().listBooks() }
    catch (e) { log.error('list-books', e); return [] }
  })

  ipcMain.handle('create-book', async (_e, name, style, phase, premise, tags) => {
    const crypto = require('crypto')
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const book = { id, name, premise: premise || '', style: style || 'default', planning_tier: 'short', phase: phase || 'init', flow: 'writing', layered: false, total_word_count: 0, workspace_dir: null, tags: tags || '', created_at: now, updated_at: now, last_opened_at: now }
    getDB().createBook(book)
    const bookDir = join(home, '.ainovel-gui', 'books', id)
    if (!existsSync(bookDir)) mkdirSync(bookDir, { recursive: true })
    return { ...book, completedCount: 0 }
  })

  ipcMain.handle('delete-book', async (_e, id) => {
    getDB().deleteBook(id)
    return true
  })

  ipcMain.handle('get-book', async (_e, id) => {
    return getDB().getBook(id)
  })

  ipcMain.handle('update-book', async (_e, id, fields) => {
    try { getDB().updateBook(id, fields); return true }
    catch (e) { log.error('update-book', e); return false }
  })

  ipcMain.handle('get-book-dir', async (_e, id) => {
    const book = (state.index?.books || []).find(b => b.id === id)
    if (!book) return null
    const fallback = join(GUI_DATA_DIR, 'books', id)
    const candidate = book.workspaceDir || fallback
    try { return validatePath(candidate) }
    catch { return fallback }
  })

  ipcMain.handle('get-gui-data-dir', async () => GUI_DATA_DIR)

  ipcMain.handle('debug-db', async () => {
    try {
      const myDB = getDB()
      const bookCount = myDB.listBooks().length
      const dbPath = join(GUI_DATA_DIR, 'ainovel.db')
      const exists = existsSync(dbPath)
      const size = exists ? readFileSync(dbPath).length : 0
      return { path: dbPath, exists, size, bookCount, home }
    } catch (e) {
      return { error: e.message || String(e) }
    }
  })

  // ── 扫描/导入工作目录 ──
  ipcMain.handle('scan-workspace', async (_e, dir) => {
    try {
      dir = validatePath(dir)
      const outputDirCheck = join(dir, 'output')
      if (!existsSync(outputDirCheck)) return null
      const progress = readStoreJSON(dir, 'meta/progress.json')
      const premiseRaw = readStoreText(dir, 'meta/premise.md')
      const bookJson = readStoreJSON(dir, 'book.json')
      let chapterCount = 0
      const chDir = join(dir, 'chapters')
      if (existsSync(chDir)) chapterCount = readdirSync(chDir).filter(f => f.endsWith('.md')).length
      return {
        name: progress?.novelName || bookJson?.name || '',
        style: bookJson?.style || progress?.style || 'default',
        phase: progress?.phase || 'init', chapterCount,
        totalWordCount: progress?.totalWordCount || 0,
        premise: premiseRaw ? premiseRaw.slice(0, 200) : '',
        hasLayered: progress?.layered || false,
        hasCharacters: existsSync(join(dir, 'characters.json')),
        hasOutline: existsSync(join(dir, 'outline.json')),
      }
    } catch (e) { log.error('scan-workspace', e); return null }
  })

  ipcMain.handle('import-workspace', async (_e, dir) => {
    // Full import logic - preserved from original main.ts
    try {
      dir = validatePath(dir)
      const crypto = require('crypto')
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      const progress = readStoreJSON(dir, 'meta/progress.json')
      const bookJson = readStoreJSON(dir, 'book.json')
      const name = progress?.novelName || bookJson?.name || '未命名作品'
      const style = bookJson?.style || progress?.style || 'default'
      const phase = progress?.phase || 'init'
      const book = {
        id, name, premise: bookJson?.premise || '', style,
        planning_tier: bookJson?.planningTier || bookJson?.planning_tier || 'short',
        phase, flow: 'writing', layered: progress?.layered ? 1 : 0,
        total_word_count: progress?.totalWordCount || 0,
        workspace_dir: dir,
        created_at: now, updated_at: now, last_opened_at: now,
      }
      getDB().createBook(book)
      // Copy cover
      const coverExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp']
      for (const ext of coverExts) {
        const coverFile = join(dir, 'cover' + ext)
        if (existsSync(coverFile)) {
          const destDir = join(GUI_DATA_DIR, 'books', id)
          if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
          copyFileSync(coverFile, join(destDir, 'cover' + ext))
          break
        }
      }
      // Sync data to SQLite
      const db = getDB()
      try {
        const outline = readStoreJSON(dir, 'outline.json')
        if (outline?.length) db.saveOutlineEntries(id, outline)
        const layered = readStoreJSON(dir, 'layered_outline.json')
        if (layered?.length) { db.saveVolumes(id, layered); syncArcs(db, id, layered) }
        const compass = readStoreJSON(dir, 'compass.json')
        if (compass) db.saveCompass(id, compass)
        const chars = readStoreJSON(dir, 'characters.json')
        if (chars?.length) db.saveCharacters(id, chars)
        // ... timeline, foreshadow, relationships, chapters, reviews, etc
        const timeline = readStoreJSON(dir, 'timeline.json')
        if (timeline?.length) db.saveTimelineEvents(id, timeline)
        const foreshadow = readStoreJSON(dir, 'foreshadow_ledger.json')
        if (foreshadow?.length) db.saveForeshadowEntries(id, foreshadow)
        const relations = readStoreJSON(dir, 'relationship_state.json')
        if (relations?.length) db.saveRelationshipEntries(id, relations)
        syncChapters(db, id, dir)
        syncReviews(db, id, dir)
        syncSummaries(db, id, dir)
        const simProfile = readStoreJSON(dir, 'simulation_profile.json')
        if (simProfile) db.saveSimulationProfile(id, simProfile)
        const userRules = readStoreJSON(dir, 'user_rules.json')
        if (userRules) db.saveUserRules(id, userRules)
        const userDirPath = join(dir, 'meta', 'user_directives.json')
        if (existsSync(userDirPath)) {
          try { const d = JSON.parse(readFileSync(userDirPath, 'utf8')); if (d.length) db.saveUserDirectives(id, d) } catch { }
        }
      } catch (e) { log.error('import-workspace:sync', e) }
      return { ...book, completedCount: progress?.completedChapters?.length || 0 }
    } catch (e) { log.error('import-workspace', e); return null }
  })
}

function readStoreJSON(baseDir, relativePath) {
  const fullPath = join(baseDir, relativePath)
  if (!existsSync(fullPath)) return null
  try { return JSON.parse(readFileSync(fullPath, 'utf8')) } catch { return null }
}

function readStoreText(baseDir, relativePath) {
  const fullPath = join(baseDir, relativePath)
  if (!existsSync(fullPath)) return null
  try { return readFileSync(fullPath, 'utf8') } catch { return null }
}

function syncArcs(db, id, volumes) {
  const allArcs = []; const allArcChapters = []
  for (const v of volumes) {
    for (const a of (v.arcs || [])) {
      allArcs.push({ volume_idx: v.index || v.idx || 0, idx: a.index || a.idx || 0, title: a.title, goal: a.goal, estimated_chapters: a.estimatedChapters || 0 })
      for (const ac of (a.chapters || [])) allArcChapters.push({ volume_idx: v.index || v.idx || 0, arc_idx: a.index || a.idx || 0, chapter: ac.chapter || 0, title: ac.title, core_event: ac.coreEvent || '', hook: ac.hook || '', scenes: ac.scenes || [] })
    }
  }
  if (allArcs.length) db.saveArcs(id, allArcs)
  if (allArcChapters.length) db.saveArcChapters(id, allArcChapters)
}

function syncChapters(db, id, dir) {
  const chDir = join(dir, 'chapters')
  if (!existsSync(chDir)) return
  for (const file of readdirSync(chDir).filter(f => f.endsWith('.md')).sort()) {
    const num = parseInt(file.replace('.md', ''), 10)
    if (!isNaN(num)) {
      const content = readFileSync(join(chDir, file), 'utf8')
      const title = content.split('\n')[0]?.replace(/^#\s*/, '').trim() || `第${num}章`
      db.saveChapter(id, num, content, title)
    }
  }
}

function syncReviews(db, id, dir) {
  const reviewDir = join(dir, 'reviews')
  if (!existsSync(reviewDir)) return
  const revFiles = readdirSync(reviewDir).filter(f => f.endsWith('.json'))
  const reviews = revFiles.map(f => {
    try { return JSON.parse(readFileSync(join(reviewDir, f), 'utf8')) } catch { return null }
  }).filter(Boolean)
  if (reviews.length) db.saveReviews(id, reviews)
}

function syncSummaries(db, id, dir) {
  const summaryDir = join(dir, 'summaries')
  if (!existsSync(summaryDir)) return
  const files = readdirSync(summaryDir).filter(f => f.endsWith('.json'))
  const summaries = files.map(f => {
    try {
      const s = JSON.parse(readFileSync(join(summaryDir, f), 'utf8'))
      if (s.chapter) return { type: 'chapter', ref_key: String(s.chapter), summary: s.summary || '', characters: s.characters || [], key_events: s.keyEvents || s.key_events || [] }
      if (s.arc !== undefined) return { type: 'arc', ref_key: `arc-v${String(s.volume).padStart(2,'0')}a${String(s.arc).padStart(2,'0')}`, summary: s.summary || '', characters: [], key_events: s.keyEvents || s.key_events || [] }
      if (s.volume && s.arc === undefined) return { type: 'volume', ref_key: `vol-v${String(s.volume).padStart(2,'0')}`, summary: s.summary || '', characters: [], key_events: s.keyEvents || s.key_events || [] }
      return null
    } catch { return null }
  }).filter(Boolean)
  if (summaries.length) db.saveSummaries(id, summaries)
}

module.exports = { register }
