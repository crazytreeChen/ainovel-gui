export {}

/**
 * 创作控制 IPC（start/resume/pause/stop + 流式输出）
 */
const { state, getDB, getAinovelBinary } = require('../context')
const { createLogger } = require('../logger')
const { join } = require('path')
const { existsSync, mkdirSync, readFileSync } = require('fs')
const { spawn } = require('child_process')

const log = createLogger('ipc:writing')

function register(ipcMain: Electron.IpcMain) {
  ipcMain.handle('start-writing', async (_e: Electron.IpcMainInvokeEvent, _prompt: string, bookId: string) => {
    await stopAinovelProcess()
    const binary = getAinovelBinary()
    if (!existsSync(binary)) return false
    let cwd = state.outputDir || require('electron').app.getPath('documents')
    if (bookId) {
      try {
        const book = getDB().getBook(bookId)
        if (book?.workspace_dir) cwd = book.workspace_dir
      } catch (e: any) { log.error('start-writing:getBook', e) }
    }
    if (!existsSync(cwd)) mkdirSync(cwd, { recursive: true })
    state.outputDir = cwd
    const args = ['--headless']
    if (state.configPath) args.push('--config', state.configPath)
    try {
      state.ainovelProcess = spawn(binary, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } })
      state.ainovelProcess.on('exit', (code: number | null) => {
        state.ainovelProcess = null
        if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('process-exited', code)
      })
      state.ainovelProcess.on('error', (err: Error) => {
        log.error('start-writing:error', err.message)
        state.ainovelProcess = null
        if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('process-exited', -1)
      })
      startRuntimeSync()
      return true
    } catch (e: any) { log.error('start-writing:spawn', e); return false }
  })

  ipcMain.handle('resume-writing', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    await stopAinovelProcess()
    const binary = getAinovelBinary()
    if (!existsSync(binary)) return false
    let cwd = state.outputDir || require('electron').app.getPath('documents')
    if (bookId) {
      try {
        const book = getDB().getBook(bookId)
        if (book?.workspace_dir) cwd = book.workspace_dir
      } catch (e: any) { log.error('resume-writing:getBook', e) }
    }
    if (!existsSync(cwd)) { mkdirSync(cwd, { recursive: true }); return false }
    const path = require('path')
    const sep = path.sep
    const outputPattern = new RegExp(`${sep}output${sep}[^${sep}]+$`)
    const outputParent = cwd.replace(outputPattern, '')
    if (outputParent !== cwd && existsSync(join(outputParent, 'output'))) cwd = outputParent
    state.outputDir = cwd
    const args = ['--headless']
    if (state.configPath) args.push('--config', state.configPath)
    try {
      state.ainovelProcess = spawn(binary, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } })
      let stderrData = ''
      state.ainovelProcess.stderr.on('data', (data: any) => {
        const text = data.toString(); stderrData += text
        for (const line of text.split('\n').filter(Boolean)) {
          const match = line.match(/\[(\d{2}:\d{2}:\d{2})\]\s+\[(\w+)\]\s+(.*)/)
          if (match) {
            const now = new Date()
            const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${match[1]}`
            state.engineEvents.push({ time: timeStr, category: match[2], summary: match[3], detail: '', agent: '', depth: 0, level: match[2] === 'ERROR' ? 'error' : match[2] === 'WARN' ? 'warn' : 'info', duration: 0 })
          }
        }
        if (state.engineEvents.length > 2000) state.engineEvents.splice(0, state.engineEvents.length - 2000)
      })
      let streamMode = 'content', streamBuf = '', streamTimer: ReturnType<typeof setTimeout> | null = null
      state.ainovelProcess.stdout.on('data', (data: any) => {
        const text = data.toString()
        const clean = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        if (!clean || !state.mainWindow || state.mainWindow.isDestroyed()) return
        const tIdx = clean.indexOf('[T]'), cIdx = clean.indexOf('[C]')
        if (tIdx >= 0 || cIdx >= 0) {
          if (streamBuf) { state.mainWindow.webContents.send('stream-output', JSON.stringify({type: streamMode, text: streamBuf})); streamBuf = '' }
          if (tIdx >= 0) streamMode = 'thinking'
          if (cIdx >= 0) streamMode = 'content'
          const idx = tIdx >= 0 ? tIdx + 3 : cIdx + 3
          const rest = clean.substring(idx).trim()
          if (rest) streamBuf = rest
        } else { streamBuf += clean }
        if (streamBuf.length > 100) { state.mainWindow.webContents.send('stream-output', JSON.stringify({type: streamMode, text: streamBuf})); streamBuf = '' }
        if (!streamTimer) { streamTimer = setTimeout(() => { streamTimer = null; if (streamBuf) { state.mainWindow.webContents.send('stream-output', JSON.stringify({type: streamMode, text: streamBuf})); streamBuf = '' } }, 500) }
      })
      state.ainovelProcess.on('exit', (code: number | null) => {
        if (code !== 0 && stderrData) log.error('resume exit:', code, stderrData)
        stopRuntimeSync(); state.ainovelProcess = null
        if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('process-exited', code)
      })
      state.ainovelProcess.on('error', (err: Error) => {
        log.error('resume-writing:error', err.message)
        stopRuntimeSync(); state.ainovelProcess = null
        if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('process-exited', -1)
      })
      startRuntimeSync()
      return true
    } catch (e: any) { log.error('resume-writing:spawn', e); return false }
  })

  ipcMain.handle('send-input', async (_e: Electron.IpcMainInvokeEvent, text: string) => {
    if (!state.ainovelProcess || !state.ainovelProcess.stdin || state.ainovelProcess.exitCode !== null) return false
    try {
      state.ainovelProcess.stdin.write(text + '\n')
      const now = new Date()
      const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
      state.engineEvents.push({ time: timeStr, category: 'USER', summary: text.slice(0, 120), detail: text, agent: '', depth: 0, level: 'info', duration: 0 })
      return true
    } catch (e: any) { log.error('send-input', e); return false }
  })

  ipcMain.handle('pause-writing', async () => {
    if (!state.ainovelProcess || state.ainovelProcess.exitCode !== null) return false
    try { state.ainovelProcess.kill('SIGINT'); return true } catch (e: any) { log.error('pause-writing', e); return false }
  })

  ipcMain.handle('stop-writing', async () => { await stopAinovelProcess(); return true })

  // ── 运行时读取（快照/事件/章节）──
  ipcMain.handle('get-snapshot', createSnapshotHandler())
  ipcMain.handle('get-events', createEventsHandler())
  ipcMain.handle('read-chapter', async (_e: Electron.IpcMainInvokeEvent, ch: string) => {
    if (!state.outputDir) return ''
    const bookDir = findActiveBookDir()
    if (!bookDir) return ''
    const f = join(bookDir, 'chapters', `${String(ch).padStart(2, '0')}.md`)
    if (!existsSync(f)) {
      const fallback = join(state.outputDir, 'output', 'chapters', `${String(ch).padStart(2, '0')}.md`)
      if (existsSync(fallback)) try { return readFileSync(fallback, 'utf8') } catch (e: any) { return '' }
      return ''
    }
    try { return readFileSync(f, 'utf8') } catch (e: any) { return '' }
  })

  ipcMain.handle('list-chapters', async () => {
    if (!state.outputDir) return []
    const bookDir = findActiveBookDir()
    if (!bookDir) return []
    const chDir = join(bookDir, 'chapters')
    if (!existsSync(chDir)) return []
    const { readdirSync } = require('fs')
    const files = readdirSync(chDir).filter((f: string) => f.endsWith('.md')).sort()
    const progress = readStoreJSON('meta/progress.json')
    const titles = progress?.chapterTitles || {}
    return files.map((file: string) => {
      const num = parseInt(file.replace('.md', ''), 10)
      if (isNaN(num)) return null
      const content = readFileSync(join(chDir, file), 'utf8')
      return { num, title: titles[num] || content.split('\n')[0]?.replace(/^#\s*/, '').trim() || `第${num}章`, wordCount: content.length }
    }).filter(Boolean)
  })
}

// ── 辅助函数 ──

function findActiveBookDir() {
  if (!state.outputDir) return null
  const { existsSync, readdirSync } = require('fs')
  const { join } = require('path')
  const outputSub = join(state.outputDir, 'output')
  if (!existsSync(outputSub)) return state.outputDir
  try {
    const entries = readdirSync(outputSub, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const progressFile = join(outputSub, entry.name, 'meta', 'progress.json')
        if (existsSync(progressFile)) return join(outputSub, entry.name)
      }
    }
  } catch (e: any) { log.error('findActiveBookDir', e) }
  return join(outputSub)
}

function readStoreJSON(relativePath: string) {
  if (!state.outputDir) return null
  const { existsSync, readFileSync, readdirSync } = require('fs')
  const { join } = require('path')
  const candidates = [join(state.outputDir, 'output', relativePath), join(state.outputDir, relativePath)]
  const outputSub = join(state.outputDir, 'output')
  if (existsSync(outputSub)) {
    try {
      const entries = readdirSync(outputSub, { withFileTypes: true })
      for (const entry of entries) { if (entry.isDirectory()) candidates.push(join(outputSub, entry.name, relativePath)) }
    } catch (e: any) { log.error('readStoreJSON:scan', e) }
  }
  for (const fullPath of candidates) { if (existsSync(fullPath)) { try { return JSON.parse(readFileSync(fullPath, 'utf8')) } catch { return null } } }
  return null
}

function createSnapshotHandler() {
  return async () => {
    const snap = createEmptySnapshot()
    const isAlive = state.ainovelProcess !== null && state.ainovelProcess.exitCode === null
    snap.runtimeState = isAlive ? 'running' : 'idle'
    snap.isRunning = isAlive
    try {
      const books = getDB().listBooks()
      if (books?.length) {
        const book = books[0]; snap.novelName = book.name || ''; snap.style = book.style || ''
        snap.phase = book.phase || 'init'; snap.totalWordCount = book.totalWordCount || 0; snap.completedCount = book.completedCount || 0
      }
    } catch (e: any) { log.error('snapshot:book', e) }
    if (isAlive) { fillRunningSnapshot(snap) }
    else { fillDbSnapshot(snap) }
    snap.statusLabel = deriveStatusLabel(snap)
    fillFallbackData(snap)
    return snap
  }
}

function createEventsHandler() {
  return async () => {
    if (state.engineEvents.length > 0) return [...state.engineEvents].slice(-500)
    if (!state.outputDir) return []
    const bookDir = findActiveBookDir()
    if (!bookDir) return []
    const { existsSync, readFileSync } = require('fs')
    const { join } = require('path')
    const cpPath = join(bookDir, 'meta', 'checkpoints.jsonl')
    if (!existsSync(cpPath)) {
      const altPath = join(bookDir, 'output', 'meta', 'checkpoints.jsonl')
      if (!existsSync(altPath)) return []
      state.cpPathAlt = altPath
    }
    const finalPath = existsSync(cpPath) ? cpPath : state.cpPathAlt
    try {
      const raw = readFileSync(finalPath || cpPath, 'utf8')
      return raw.split('\n').filter(Boolean).slice(-500).map((line: string) => {
        try { const p = JSON.parse(line); return { time: p.time || '', category: p.category || 'SYSTEM', summary: p.summary || '', detail: p.detail || '', agent: p.agent || '', depth: p.depth || 0, level: p.level || 'info', duration: p.duration || 0 } }
        catch (e: any) { return { time: '', category: 'SYSTEM', summary: line, detail: '', agent: '', depth: 0, level: 'info', duration: 0 } }
      })
    } catch (e: any) { log.warn('get-events:read', e?.message || e); return [] }
  }
}

function fillRunningSnapshot(snap: any) {
  const progress = readStoreJSON('meta/progress.json')
  if (!progress) return
  if (progress.novel_name) snap.novelName = progress.novel_name
  snap.phase = progress.phase || snap.phase; snap.flow = progress.flow || ''
  const completed = progress.completed_chapters || []
  snap.completedCount = completed.length > 0 ? completed.length : snap.completedCount
  snap.totalChapters = progress.total_chapters || 0; snap.totalWordCount = progress.total_word_count || snap.totalWordCount
  snap.inProgressChapter = progress.in_progress_chapter || 0; snap.currentChapter = progress.current_chapter || 0
  snap.pendingRewrites = progress.pending_rewrites || []; snap.rewriteReason = progress.rewrite_reason || ''
  snap.layered = progress.layered || false
  // 从 progress.json 读取上下文/缓存数据（ainovel-cli 运行时写入）
  if (progress.context_percent) snap.contextPercent = progress.context_percent
  if (progress.context_tokens) snap.contextTokens = progress.context_tokens
  if (progress.context_window) snap.contextWindow = progress.context_window
  if (progress.context_percent !== undefined) snap.contextPercent = progress.context_percent
  if (progress.cache_read !== undefined) snap.cacheReadTokens = progress.cache_read
  if (progress.cache_write !== undefined) snap.cacheWriteTokens = progress.cache_write
  if (progress.current_volume && progress.current_arc) snap.currentVolumeArc = `第${progress.current_volume}卷·第${progress.current_arc}弧`
  if (completed.length > 0) {
    const last = completed[completed.length - 1]; const wc = (progress.chapter_word_counts || {})[last] || ''
    snap.lastCommitSummary = `第${last}章 ${wc}字`
  }
}

function fillDbSnapshot(snap: any) {
  try {
    const books = getDB().listBooks()
    if (!books?.length) return
    const bookId = books[0].id
    try { const fullBook = getDB().getBook(bookId); if (fullBook?.premise) snap.premise = fullBook.premise.slice(0, 200) } catch (e: any) { log.error('snapshot:premise', e) }
    try { const chars = getDB().getCharacters(bookId); if (chars?.length) snap.characters = chars.map((c: any) => c.name + (c.role ? `（${c.role}）` : '')) } catch (e: any) { log.error('snapshot:chars', e) }
    try { const entries = getDB().getOutlineEntries(bookId); if (entries?.length) { snap.totalOutlineCount = entries.length; snap.outline = entries.slice(-30).map((e: any) => ({ chapter: e.chapter || 0, title: e.title || '', coreEvent: e.core_event || '' })) } } catch (e: any) { log.error('snapshot:outline', e) }
    try { const compass = getDB().getCompass(bookId); if (compass) { snap.compassDirection = compass.endingDirection || ''; snap.compassScale = compass.estimatedScale || '' } } catch (e: any) { log.error('snapshot:compass', e) }
    try { const reviews = getDB().getReviews(bookId); if (reviews?.length) { const last = reviews[reviews.length - 1]; snap.lastReviewSummary = last.summary ? `第${last.chapter}章: ${last.summary.slice(0, 80)}` : '' } } catch (e: any) { log.error('snapshot:reviews', e) }
    try { const usage = getDB().getUsageStats(bookId); if (usage) { snap.totalInputTokens = usage.total_input || 0; snap.totalOutputTokens = usage.total_output || 0; snap.totalCostUSD = usage.total_cost || 0; snap.totalSavedUSD = usage.total_saved || 0; snap.cacheReadTokens = usage.cache_read || 0; snap.cacheWriteTokens = usage.cache_write || 0 } } catch (e: any) { log.error('snapshot:usage', e) }
    try { const meta = getDB().getRunMeta(bookId); if (meta) { snap.provider = meta.provider || ''; snap.modelName = meta.model || '' } } catch (e: any) { log.error('snapshot:meta', e) }
    try { const prog = getDB().database.prepare('SELECT * FROM progress WHERE book_id=?').get(bookId); if (prog) { snap.layered = !!prog.layered; if (prog.total_chapters > 0) snap.totalChapters = prog.total_chapters; snap.completedCount = (() => { try { return JSON.parse(prog.completed_chapters || '[]').length } catch { return 0 } })() } } catch (e: any) { log.error('snapshot:prog', e) }
  } catch (e: any) { log.error('snapshot:db', e) }
}

function fillFallbackData(snap: any) {
  try {
    const books = getDB().listBooks()
    if (!books?.length) return
    const bookId = books[0].id
    try { const fullBook = getDB().getBook(bookId); if (fullBook?.premise && !snap.premise) snap.premise = fullBook.premise.slice(0, 200) } catch (e: any) { log.error('snapshot:fallback-premise', e) }
    try { const chars = getDB().getCharacters(bookId); if (chars?.length && !snap.characters.length) snap.characters = chars.map((c: any) => c.name + (c.role ? `（${c.role}）` : '')) } catch (e: any) { log.error('snapshot:fallback-chars', e) }
    try { if (!snap.outline.length) { const entries = getDB().getOutlineEntries(bookId); if (entries?.length) { snap.totalOutlineCount = entries.length; snap.outline = entries.slice(-30).map((e: any) => ({ chapter: e.chapter || 0, title: e.title || '', coreEvent: e.core_event || '' })) } } } catch (e: any) { log.error('snapshot:fallback-outline', e) }
    try { if (!snap.compassDirection) { const compass = getDB().getCompass(bookId); if (compass) { snap.compassDirection = compass.endingDirection || ''; snap.compassScale = compass.estimatedScale || '' } } } catch (e: any) { log.error('snapshot:fallback-compass', e) }
    try { if (!snap.lastReviewSummary) { const reviews = getDB().getReviews(bookId); if (reviews?.length) { const last = reviews[reviews.length - 1]; snap.lastReviewSummary = last.summary ? `第${last.chapter}章: ${last.summary.slice(0, 80)}` : '' } } } catch (e: any) { log.error('snapshot:fallback-review', e) }
    try { const usage = getDB().getUsageStats(bookId); if (usage) { if (!snap.totalInputTokens) snap.totalInputTokens = usage.total_input || 0; if (!snap.totalOutputTokens) snap.totalOutputTokens = usage.total_output || 0; if (!snap.totalCostUSD) snap.totalCostUSD = usage.total_cost || 0; if (!snap.totalSavedUSD) snap.totalSavedUSD = usage.total_saved || 0; if (!snap.cacheReadTokens) snap.cacheReadTokens = usage.cache_read || 0; if (!snap.cacheWriteTokens) snap.cacheWriteTokens = usage.cache_write || 0 } } catch (e: any) { log.error('snapshot:fallback-usage', e) }
    try { const meta = getDB().getRunMeta(bookId); if (meta) { if (!snap.provider) snap.provider = meta.provider || ''; if (!snap.modelName) snap.modelName = meta.model || '' } } catch (e: any) { log.error('snapshot:fallback-meta', e) }
  } catch (e: any) { log.error('snapshot:fallback', e) }
}

function createEmptySnapshot() {
  return {
    novelName: '', provider: '', modelName: '', style: '', phase: '', flow: '', runtimeState: 'idle',
    isRunning: false, completedCount: 0, totalChapters: 0, totalWordCount: 0, inProgressChapter: 0,
    currentChapter: 0, pendingRewrites: [], rewriteReason: '', layered: false, currentVolumeArc: '',
    premise: '', outline: [], totalOutlineCount: 0, characters: [], compassDirection: '', compassScale: '',
    totalInputTokens: 0, totalOutputTokens: 0, totalCostUSD: 0, totalSavedUSD: 0,
    cacheReadTokens: 0, cacheWriteTokens: 0, contextPercent: 0, contextTokens: 0, contextWindow: 0,
    lastCommitSummary: '', lastReviewSummary: '', pendingSteer: '',
    statusLabel: 'READY', agents: [], recentSummaries: [],
  }
}

function deriveStatusLabel(snap: any) {
  if (!snap.isRunning) return 'READY'
  if (snap.flow === 'reviewing') return 'REVIEW'
  if (snap.flow === 'rewriting') return 'REWRITE'
  if (snap.phase === 'complete') return 'COMPLETE'
  return 'RUNNING'
}

function stopAinovelProcess() {
  return new Promise<void>((resolve) => {
    if (!state.ainovelProcess || state.ainovelProcess.exitCode !== null) { resolve(); return }
    const proc = state.ainovelProcess
    let sigtermTimer: ReturnType<typeof setTimeout> | null = null
    let sigkillTimer: ReturnType<typeof setTimeout> | null = null
    let settled = false

    const onExit = () => {
      if (settled) return
      settled = true
      if (sigtermTimer) clearTimeout(sigtermTimer)
      if (sigkillTimer) clearTimeout(sigkillTimer)
      resolve()
    }

    try {
      proc.kill('SIGTERM')
      proc.on('exit', onExit)
      sigtermTimer = setTimeout(() => {
        if (settled) return
        try {
          proc.kill('SIGKILL')
          sigkillTimer = setTimeout(onExit, 1000)
        } catch {
          log.warn('stopAinovelProcess: SIGKILL failed, process may have already exited')
          onExit()
        }
      }, 5000)
    } catch {
      log.warn('stopAinovelProcess: process may have already exited')
      onExit()
    }
  }).then(() => {
    state.ainovelProcess = null
    state.engineEvents.length = 0
    stopRuntimeSync()
  })
}

let snapshotTimer: ReturnType<typeof setInterval> | null = null
let runtimeSyncActive = false
let chapterCache: { files: string[]; mtime: number } | null = null

function startRuntimeSync() {
  if (runtimeSyncActive) return
  runtimeSyncActive = true
  snapshotTimer = setInterval(() => {
    if (!state.mainWindow || state.mainWindow.isDestroyed()) return
    if (!state.outputDir || state.outputDir.trim() === '') { return }
    const { existsSync, readFileSync, readdirSync, statSync } = require('fs')
    const { join } = require('path')
    const bookDir = findActiveBookDir()
    if (!bookDir) return
    const db = getDB()
    const bookId = getDB().listBooks()?.[0]?.id

    // 自动导入新章节（带目录 mtime 缓存，避免每次全扫）
    const chDir = join(bookDir, 'chapters')
    if (existsSync(chDir)) {
      try {
        const currentMtime = statSync(chDir).mtimeMs
        if (chapterCache && chapterCache.mtime === currentMtime) {
          // 目录未变更，跳过扫描
        } else {
          const files = readdirSync(chDir).filter((f: string) => f.endsWith('.md')).sort()
          for (const file of files) {
            const num = parseInt(file.replace('.md', ''), 10)
            if (!isNaN(num)) {
              const existing = db.getChapter(bookId, num)
              if (!existing) {
                const content = readFileSync(join(chDir, file), 'utf8')
                const title = content.split('\n')[0]?.replace(/^#\s*/, '').trim() || `第${num}章`
                db.saveChapter(bookId, num, content, title)
              }
            }
          }
          chapterCache = { files, mtime: currentMtime }
        }
      } catch (e: any) { log.error('runtime-sync:chapters', e) }
    }

    // 推送最新快照到渲染进程（替代前端轮询）
    try {
      const { ipcMain } = require('electron')
      if (bookId && state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('runtime-update', {
          type: 'sync',
          timestamp: Date.now(),
        })
      }
    } catch (e: any) { log.error('runtime-sync:push', e) }
  }, 10000)
}

function stopRuntimeSync() {
  runtimeSyncActive = false
  if (snapshotTimer) { clearInterval(snapshotTimer); snapshotTimer = null }
}

module.exports = { register }
