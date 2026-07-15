export {}

/**
 * 书籍管理 IPC 处理器
 */
const { state, getDB, GUI_DATA_DIR, home } = require('../context')
const { createLogger } = require('../logger')
const { validatePath } = require('../path-validator')
const { join } = require('path')
const { existsSync, mkdirSync, readFileSync, readdirSync, copyFileSync } = require('fs')

const log = createLogger('ipc:books')


/** 清理 books 下已无数据库记录的孤儿目录 */
function cleanupOrphanBookDirs() {
  const { readdirSync, rmSync, existsSync: fExists, statSync } = require('fs')
  const { resolve: pathResolve, join: pJoin } = require('path')
  let known = new Set<string>()
  try {
    const rows = getDB().listBooks() || []
    for (const b of rows) if (b?.id) known.add(String(b.id))
  } catch (e: any) {
    log.error('cleanupOrphanBookDirs:list', e)
    return { removed: [], errors: ['无法读取书籍列表'] }
  }

  const roots = [
    pathResolve(join(GUI_DATA_DIR, 'books')),
    pathResolve(join(home, '.ainovel-gui', 'books')),
  ]
  const seen = new Set<string>()
  const removed: string[] = []
  const errors: string[] = []

  for (const root of roots) {
    try {
      if (!fExists(root)) continue
      const keyRoot = process.platform === 'win32' ? root.toLowerCase() : root
      if (seen.has(keyRoot)) continue
      seen.add(keyRoot)
      for (const name of readdirSync(root)) {
        // 只处理 UUID 形式目录
        if (!/^[0-9a-fA-F-]{8,64}$/.test(name)) continue
        if (known.has(name)) continue
        const full = pJoin(root, name)
        try {
          if (!statSync(full).isDirectory()) continue
          rmSync(full, { recursive: true, force: true, maxRetries: 8, retryDelay: 120 })
          removed.push(full)
          log.info('cleanupOrphanBookDirs:removed', full)
        } catch (e: any) {
          errors.push((e && e.message) || String(e))
          log.error('cleanupOrphanBookDirs:rm', e)
        }
      }
    } catch (e: any) {
      errors.push((e && e.message) || String(e))
    }
  }
  return { removed, errors }
}

function register(ipcMain: Electron.IpcMain) {
  ipcMain.handle('list-books', () => {
    try {
      try { cleanupOrphanBookDirs() } catch (e: any) { log.warn('list-books:orphan', e?.message || e) }
      return getDB().listBooks()
    } catch (e: any) { log.error('list-books', e); return [] }
  })

  ipcMain.handle('create-book', (_e: Electron.IpcMainInvokeEvent, name: string, style: string, phase: string, premise: string, tags: string) => {
    const crypto = require('crypto')
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const book = { id, name, premise: premise || '', style: style || 'default', planning_tier: 'short', phase: phase || 'init', flow: 'writing', layered: false, total_word_count: 0, workspace_dir: null, tags: tags || '', created_at: now, updated_at: now, last_opened_at: now }
    getDB().createBook(book)
    const bookDir = join(home, '.ainovel-gui', 'books', id)
    if (!existsSync(bookDir)) mkdirSync(bookDir, { recursive: true })
    return { ...book, completedCount: 0 }
  })

    ipcMain.handle('delete-book', async (_e: Electron.IpcMainInvokeEvent, id: string) => {
    if (typeof id !== 'string' || !/^[0-9a-fA-F-]{8,64}$/.test(id)) {
      throw new Error('无效的书籍 ID')
    }

    // 若正在写这本书，先停引擎
    if (state.activeWritingBookId === id && state.ainovelProcess) {
      try { state.ainovelProcess.kill('SIGTERM') } catch {}
      state.ainovelProcess = null
      state.activeWritingBookId = ''
    }

    // 先删数据库
    getDB().deleteBook(id)

    // 强制删除托管目录 books/<id>（处理 junction：~/.ainovel-gui -> zayang）
    const { rmSync, existsSync: fExists, realpathSync } = require('fs')
    const { resolve: pathResolve } = require('path')
    const candidates = [
      join(GUI_DATA_DIR, 'books', id),
      join(home, '.ainovel-gui', 'books', id),
    ]
    const seen = new Set<string>()
    const removed: string[] = []
    const errors: string[] = []

    for (const dir of candidates) {
      try {
        const abs = pathResolve(dir)
        const key = process.platform === 'win32' ? abs.toLowerCase() : abs
        if (seen.has(key)) continue
        seen.add(key)
        if (!fExists(abs)) continue
        // 确认 basename 是 book id，防止误删
        if (require('path').basename(abs) !== id) continue
        rmSync(abs, { recursive: true, force: true, maxRetries: 8, retryDelay: 120 })
        removed.push(abs)
        log.info('delete-book:removed-dir', abs)
        // 也尝试 realpath 后的路径（junction 另一端若仍残留）
        try {
          const real = realpathSync(abs)
          if (real && real !== abs && fExists(real)) {
            rmSync(real, { recursive: true, force: true, maxRetries: 8, retryDelay: 120 })
            removed.push(real)
            log.info('delete-book:removed-realpath', real)
          }
        } catch {}
      } catch (e: any) {
        // 若 abs 已在 rm 中被删掉，realpath 会失败，可忽略
        const msg = e?.message || String(e)
        // ENOENT 不算失败
        if (!/ENOENT|no such file/i.test(msg)) {
          errors.push(msg)
          log.error('delete-book:rm', msg)
        }
      }
    }

    // 再扫一遍确认
    for (const dir of candidates) {
      if (fExists(pathResolve(dir))) {
        errors.push('文件夹仍存在: ' + dir)
      }
    }

    if (errors.length) {
      // 再试一次孤儿清理
      try {
        const orphan = cleanupOrphanBookDirs()
        removed.push(...(orphan.removed || []))
      } catch {}
      if (errors.length && removed.length === 0) {
        throw new Error('书籍记录已删除，但文件夹未删干净: ' + errors[0])
      }
    }

    // 顺手清掉其它已不在库里的 books 残留目录
    try {
      const orphan = cleanupOrphanBookDirs()
      for (const p of (orphan.removed || [])) {
        if (!removed.includes(p)) removed.push(p)
      }
      for (const e of (orphan.errors || [])) errors.push(e)
    } catch (e: any) {
      log.error('delete-book:orphan-cleanup', e)
    }

    return { ok: true, removed, errors }
  })

  ipcMain.handle('get-book', (_e: Electron.IpcMainInvokeEvent, id: string) => {
    return getDB().getBook(id)
  })

  ipcMain.handle('update-book', (_e: Electron.IpcMainInvokeEvent, id: string, fields: Record<string, any>) => {
    try { getDB().updateBook(id, fields); return true }
    catch (e: any) { log.error('update-book', e); return false }
  })

  ipcMain.handle('get-book-dir', async (_e: Electron.IpcMainInvokeEvent, id: string) => {
    try {
      const book = getDB().getBook(id)
      if (book?.workspace_dir) return validatePath(book.workspace_dir)
    } catch (e: any) { log.error('get-book-dir', e) }
    return join(GUI_DATA_DIR, 'books', id)
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
    } catch (e: any) {
      return { error: e.message || String(e) }
    }
  })

  // ── 扫描/导入工作目录 ──
  ipcMain.handle('scan-workspace', async (_e: Electron.IpcMainInvokeEvent, dir: string) => {
    try {
      dir = validatePath(dir)
      const outputDirCheck = join(dir, 'output')
      if (!existsSync(outputDirCheck)) return null
      const progress = readStoreJSON(dir, 'meta/progress.json')
      const premiseRaw = readStoreText(dir, 'meta/premise.md')
      const bookJson = readStoreJSON(dir, 'book.json')
      let chapterCount = 0
      let chDir = join(dir, 'chapters')
      if (!existsSync(chDir)) chDir = join(dir, 'output', 'novel', 'chapters')
      if (existsSync(chDir)) chapterCount = readdirSync(chDir).filter((f: string) => f.endsWith('.md')).length
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
    } catch (e: any) { log.error('scan-workspace', e); return null }
  })

  ipcMain.handle('import-workspace', async (_e: Electron.IpcMainInvokeEvent, dir: string) => {
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
      // 始终落到托管目录 books/<新id>，删除时才能干净清掉
      const destDir = join(GUI_DATA_DIR, 'books', id)
      if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
      try {
        require('fs').cpSync(dir, destDir, { recursive: true, force: true })
        log.info('import-workspace:copied', { from: dir, to: destDir })
      } catch (e: any) {
        log.error('import-workspace:copy', e)
        throw new Error('导入失败：无法复制到托管目录 ' + (e?.message || e))
      }
      const book = {
        id, name, premise: bookJson?.premise || '', style,
        planning_tier: bookJson?.planningTier || bookJson?.planning_tier || 'short',
        phase, flow: 'writing', layered: progress?.layered ? 1 : 0,
        total_word_count: progress?.totalWordCount || 0,
        workspace_dir: destDir,
        created_at: now, updated_at: now, last_opened_at: now,
      }
      getDB().createBook(book)
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
          try { const d: any = JSON.parse(readFileSync(userDirPath, 'utf8')); if (d.length) db.saveUserDirectives(id, d) } catch { }
        }
      } catch (e: any) { log.error('import-workspace:sync', e) }
      return { ...book, completedCount: progress?.completedChapters?.length || 0 }
    } catch (e: any) { log.error('import-workspace', e); return null }
  })
}

function readStoreJSON(baseDir: string, relativePath: string): any {
  const fullPath = join(baseDir, relativePath)
  if (!existsSync(fullPath)) return null
  try { return JSON.parse(readFileSync(fullPath, 'utf8')) } catch { return null }
}

function readStoreText(baseDir: string, relativePath: string): string | null {
  const fullPath = join(baseDir, relativePath)
  if (!existsSync(fullPath)) return null
  try { return readFileSync(fullPath, 'utf8') } catch { return null }
}

function syncArcs(db: any, id: string, volumes: any[]) {
  const allArcs: any[] = []; const allArcChapters: any[] = []
  for (const v of volumes) {
    for (const a of (v.arcs || [])) {
      allArcs.push({ volume_idx: v.index || v.idx || 0, idx: a.index || a.idx || 0, title: a.title, goal: a.goal, estimated_chapters: a.estimatedChapters || 0 })
      for (const ac of (a.chapters || [])) allArcChapters.push({ volume_idx: v.index || v.idx || 0, arc_idx: a.index || a.idx || 0, chapter: ac.chapter || 0, title: ac.title, core_event: ac.coreEvent || '', hook: ac.hook || '', scenes: ac.scenes || [] })
    }
  }
  if (allArcs.length) db.saveArcs(id, allArcs)
  if (allArcChapters.length) db.saveArcChapters(id, allArcChapters)
}

function syncChapters(db: any, id: string, dir: string) {
  let chDir = join(dir, 'chapters')
  if (!existsSync(chDir)) chDir = join(dir, 'output', 'novel', 'chapters')
  if (!existsSync(chDir)) return
  for (const file of readdirSync(chDir).filter((f: string) => f.endsWith('.md')).sort()) {
    const num = parseInt(file.replace('.md', ''), 10)
    if (!isNaN(num)) {
      const content = readFileSync(join(chDir, file), 'utf8')
      const title = content.split('\n')[0]?.replace(/^#\s*/, '').trim() || `第${num}章`
      db.saveChapter(id, num, content, title)
    }
  }
}

function syncReviews(db: any, id: string, dir: string) {
  const reviewDir = join(dir, 'reviews')
  if (!existsSync(reviewDir)) return
  const revFiles = readdirSync(reviewDir).filter((f: string) => f.endsWith('.json'))
  const reviews = revFiles.map((f: string) => {
    try { return JSON.parse(readFileSync(join(reviewDir, f), 'utf8')) } catch { return null }
  }).filter(Boolean)
  if (reviews.length) db.saveReviews(id, reviews)
}

function syncSummaries(db: any, id: string, dir: string) {
  const summaryDir = join(dir, 'summaries')
  if (!existsSync(summaryDir)) return
  const files = readdirSync(summaryDir).filter((f: string) => f.endsWith('.json'))
  const summaries = files.map((f: string) => {
    try {
      const s: any = JSON.parse(readFileSync(join(summaryDir, f), 'utf8'))
      if (s.chapter) return { type: 'chapter', ref_key: String(s.chapter), summary: s.summary || '', characters: s.characters || [], key_events: s.keyEvents || s.key_events || [] }
      if (s.arc !== undefined) return { type: 'arc', ref_key: `arc-v${String(s.volume).padStart(2,'0')}a${String(s.arc).padStart(2,'0')}`, summary: s.summary || '', characters: [], key_events: s.keyEvents || s.key_events || [] }
      if (s.volume && s.arc === undefined) return { type: 'volume', ref_key: `vol-v${String(s.volume).padStart(2,'0')}`, summary: s.summary || '', characters: [], key_events: s.keyEvents || s.key_events || [] }
      return null
    } catch { return null }
  }).filter(Boolean)
  if (summaries.length) db.saveSummaries(id, summaries)
}

module.exports = { register }
