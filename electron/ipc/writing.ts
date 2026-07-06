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
    state.activeWritingBookId = bookId || ''
    state.lastWritingExitCode = null
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
        state.lastWritingExitCode = code
        state.ainovelProcess = null
        sendProcessExited(code)
      })
      state.ainovelProcess.on('error', (err: Error) => {
        log.error('start-writing:error', err.message)
        state.lastWritingExitCode = -1
        state.ainovelProcess = null
        sendProcessExited(-1)
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
    state.activeWritingBookId = bookId || ''
    state.lastWritingExitCode = null
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
        state.lastWritingExitCode = code
        stopRuntimeSync(); state.ainovelProcess = null
        sendProcessExited(code)
      })
      state.ainovelProcess.on('error', (err: Error) => {
        log.error('resume-writing:error', err.message)
        state.lastWritingExitCode = -1
        stopRuntimeSync(); state.ainovelProcess = null
        sendProcessExited(-1)
      })
      startRuntimeSync()
      return true
    } catch (e: any) { log.error('resume-writing:spawn', e); return false }
  })

  ipcMain.handle('send-input', async (_e: Electron.IpcMainInvokeEvent, text: string) => {
    const now = new Date()
    const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`

    // 进程正在运行：写入 stdin
    if (state.ainovelProcess && state.ainovelProcess.stdin && state.ainovelProcess.exitCode === null) {
      try {
        // 先 SIGINT 暂停当前工作，再发送干预
        try {
          if (state.ainovelProcess.exitCode === null) {
            state.ainovelProcess.kill('SIGINT')
          }
        } catch (e: any) { /* 进程可能已退出，忽略 */ }
        // 短暂等待让 CLI 进入输入处理状态
        await new Promise(r => setTimeout(r, 100))
        state.ainovelProcess.stdin.write(text + '\n')
        state.engineEvents.push({ time: timeStr, category: 'USER', summary: text.slice(0, 120), detail: text, agent: '', depth: 0, level: 'info', duration: 0 })
        return true
      } catch (e: any) { log.error('send-input', e); return false }
    }

    // 进程未运行（规划暂停/已退出）：保存为 pending_steer，下次恢复时生效
    const bookId = getActiveWritingBookId()
    if (bookId) {
      try {
        const db = getDB()
        const existing = db.getRunMeta(bookId) || {}
        db.saveRunMeta(bookId, { ...existing, pending_steer: text, pending_steer_at: timeStr })
        // 同时写入 JSON 文件（CLI 从 meta/run.json 读取）
        const { join: pJoin } = require('path')
        const { existsSync: fExists, writeFileSync: fWrite } = require('fs')
        const { homedir } = require('os')
        const dir = pJoin(homedir(), '.ainovel-gui', 'books', bookId)
        const runJsonPath = pJoin(dir, 'meta', 'run.json')
        if (fExists(runJsonPath)) {
          try {
            const raw = JSON.parse(require('fs').readFileSync(runJsonPath, 'utf8'))
            raw.pending_steer = text
            raw.pending_steer_at = timeStr
            fWrite(runJsonPath, JSON.stringify(raw, null, 2), 'utf8')
          } catch (e: any) { /* 文件可能不存在，忽略 */ }
        } else {
          // 创建 meta 目录和 run.json
          const { mkdirSync } = require('fs')
          const metaDir = pJoin(dir, 'meta')
          if (!fExists(metaDir)) mkdirSync(metaDir, { recursive: true })
          fWrite(runJsonPath, JSON.stringify({ pending_steer: text, pending_steer_at: timeStr }, null, 2), 'utf8')
        }
        state.engineEvents.push({ time: timeStr, category: 'USER', summary: text.slice(0, 120), detail: text, agent: '', depth: 0, level: 'info', duration: 0 })
        log.info('send-input:saved-as-pending-steer', { bookId, text: text.slice(0, 60) })
        return true
      } catch (e: any) { log.error('send-input:save-pending-steer', e); return false }
    }

    return false
  })

  ipcMain.handle('pause-writing', async () => {
    if (!state.ainovelProcess || state.ainovelProcess.exitCode !== null) return false
    try { state.ainovelProcess.kill('SIGINT'); return true } catch (e: any) { log.error('pause-writing', e); return false }
  })

  ipcMain.handle('stop-writing', async () => { await stopAinovelProcess(); return true })

  /**
   * 规划完成后用户确认继续
   * 重置 pendingUserConfirm 标志，重新 spawn CLI 恢复创作
   */
  ipcMain.handle('confirm-continue-writing', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    pendingUserConfirm = false
    lastPhase = '' // 重置相位追踪，避免重复暂停
    log.info('confirm-continue-writing: 用户确认继续', { bookId })
    // 通过 resume-writing 恢复 CLI 进程
    const binary = getAinovelBinary()
    if (!existsSync(binary)) return false
    let cwd = state.outputDir || require('electron').app.getPath('documents')
    if (bookId) {
      try {
        const book = getDB().getBook(bookId)
        if (book?.workspace_dir) cwd = book.workspace_dir
      } catch (e: any) { log.error('confirm-continue-writing:getBook', e) }
    }
    if (!existsSync(cwd)) { mkdirSync(cwd, { recursive: true }); return false }
    state.outputDir = cwd
    state.activeWritingBookId = bookId || ''
    state.lastWritingExitCode = null
    const args = ['--headless']
    if (state.configPath) args.push('--config', state.configPath)
    try {
      state.ainovelProcess = spawn(binary, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } })
      const { join: pJoin } = require('path')
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
        if (code !== 0 && stderrData) log.error('confirm-continue-writing exit:', code, stderrData)
        state.lastWritingExitCode = code
        stopRuntimeSync(); state.ainovelProcess = null; pendingUserConfirm = false
        sendProcessExited(code)
      })
      state.ainovelProcess.on('error', (err: Error) => {
        log.error('confirm-continue-writing:error', err.message)
        state.lastWritingExitCode = -1
        stopRuntimeSync(); state.ainovelProcess = null; pendingUserConfirm = false
        sendProcessExited(-1)
      })
      startRuntimeSync()
      return true
    } catch (e: any) { log.error('confirm-continue-writing:spawn', e); return false }
  })

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

  /**
   * "一句话"自动创建书籍并启动 AI 创作
   * 用户只需提供创作 premise，系统自动生成书名、大纲、开始创作
   */
  ipcMain.handle('create-book-auto', async (_e: Electron.IpcMainInvokeEvent, premise: string, style?: string) => {
    const crypto = require('crypto')
    const { join: pJoin } = require('path')
    const { existsSync: fExists, mkdirSync: fMkdir } = require('fs')
    const { homedir } = require('os')
    
    if (!premise || !premise.trim()) return { error: '请输入创作需求' }
    
    // 1. 创建书籍目录
    const id = crypto.randomUUID()
    const bookDir = pJoin(homedir(), '.ainovel-gui', 'books', id)
    if (!fExists(bookDir)) fMkdir(bookDir, { recursive: true })
    
    // 2. 创建 SQLite 书籍记录（使用 premise 前 30 字作为暂用名，后续会自动更新）
    const now = new Date().toISOString()
    const tempName = premise.trim().slice(0, 30) + (premise.trim().length > 30 ? '…' : '')
    const book = {
      id, name: tempName, premise: premise.trim(),
      style: style || 'default', planning_tier: 'short',
      phase: 'init', flow: 'writing', layered: false,
      total_word_count: 0, workspace_dir: bookDir, tags: '',
      created_at: now, updated_at: now, last_opened_at: now,
    }
    getDB().createBook(book)
    log.info('create-book-auto: 书籍创建完成', { id, tempName })
    
    // 3. 停止已有进程，启动 CLI 带 --prompt
    await stopAinovelProcess()
    const binary = getAinovelBinary()
    if (!fExists(binary)) return { error: '未找到 ainovel-cli 二进制文件', book: { ...book, completedCount: 0 } }
    
    const args = ['--headless', '--prompt', premise.trim()]
    if (state.configPath) args.push('--config', state.configPath)
    
    try {
      state.outputDir = bookDir
      state.activeWritingBookId = id
      state.lastWritingExitCode = null
      state.ainovelProcess = spawn(binary, args, {
        cwd: bookDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      })
      
      // 收集 stderr（事件日志）
      state.ainovelProcess.stderr.on('data', (data: any) => {
        const text = data.toString()
        for (const line of text.split('\n').filter(Boolean)) {
          const match = line.match(/\[(\d{2}:\d{2}:\d{2})\]\s+\[(\w+)\]\s+(.*)/)
          if (match) {
            const timeStr = `${now.slice(0, 10)}T${match[1]}`
            state.engineEvents.push({
              time: timeStr, category: match[2], summary: match[3],
              detail: '', agent: '', depth: 0,
              level: match[2] === 'ERROR' ? 'error' : match[2] === 'WARN' ? 'warn' : 'info',
              duration: 0,
            })
          }
        }
        if (state.engineEvents.length > 2000) state.engineEvents.splice(0, state.engineEvents.length - 2000)
      })
      
      // 处理 stdout（流式输出）
      let streamBuf = '', streamMode = 'content'
      let streamTimer: ReturnType<typeof setTimeout> | null = null
      state.ainovelProcess.stdout.on('data', (data: any) => {
        const text = data.toString()
        const clean = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        if (!clean || !state.mainWindow || state.mainWindow.isDestroyed()) return
        const tIdx = clean.indexOf('[T]'), cIdx = clean.indexOf('[C]')
        if (tIdx >= 0 || cIdx >= 0) {
          if (streamBuf) { state.mainWindow.webContents.send('stream-output', JSON.stringify({ type: streamMode, text: streamBuf })); streamBuf = '' }
          if (tIdx >= 0) streamMode = 'thinking'
          if (cIdx >= 0) streamMode = 'content'
          const idx = tIdx >= 0 ? tIdx + 3 : cIdx + 3
          const rest = clean.substring(idx).trim()
          if (rest) streamBuf = rest
        } else { streamBuf += clean }
        if (streamBuf.length > 100) { state.mainWindow.webContents.send('stream-output', JSON.stringify({ type: streamMode, text: streamBuf })); streamBuf = '' }
        if (!streamTimer) { streamTimer = setTimeout(() => { streamTimer = null; if (streamBuf) { state.mainWindow.webContents.send('stream-output', JSON.stringify({ type: streamMode, text: streamBuf })); streamBuf = '' } }, 500) }
      })
      
      state.ainovelProcess.on('exit', (code: number | null) => {
        state.lastWritingExitCode = code
        stopRuntimeSync(); state.ainovelProcess = null
        sendProcessExited(code)
        // 尝试读取生成的书籍名称更新 SQLite
        try {
          const progJson = readStoreJSON('meta/progress.json')
          if (progJson?.novel_name) {
            getDB().updateBook(id, { name: progJson.novel_name, phase: progJson.phase || 'init' })
          }
        } catch (e: any) { log.error('create-book-auto:update-name', e) }
      })
      state.ainovelProcess.on('error', (err: Error) => {
        log.error('create-book-auto:error', err.message)
        state.lastWritingExitCode = -1
        stopRuntimeSync(); state.ainovelProcess = null
        sendProcessExited(-1)
      })
      
      startRuntimeSync()
      log.info('create-book-auto: CLI 已启动', { id, bookDir })
      return { book: { ...book, completedCount: 0 }, error: null }
    } catch (e: any) {
      log.error('create-book-auto:spawn', e)
      return { error: e.message || '启动创作引擎失败', book: { ...book, completedCount: 0 } }
    }
  })
}

// ── 辅助函数 ──

function findActiveBookDir(baseDir?: string) {
  const rootDir = baseDir || state.outputDir
  if (!rootDir) return null
  const { existsSync, readdirSync } = require('fs')
  const { join } = require('path')
  const outputSub = join(rootDir, 'output')
  if (!existsSync(outputSub)) return rootDir
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

function readStoreJSON(relativePath: string, baseDir?: string) {
  const rootDir = baseDir || state.outputDir
  if (!rootDir) return null
  const { existsSync, readFileSync, readdirSync } = require('fs')
  const { join } = require('path')
  const candidates = [join(rootDir, 'output', relativePath), join(rootDir, relativePath)]
  const outputSub = join(rootDir, 'output')
  if (existsSync(outputSub)) {
    try {
      const entries = readdirSync(outputSub, { withFileTypes: true })
      for (const entry of entries) { if (entry.isDirectory()) candidates.push(join(outputSub, entry.name, relativePath)) }
    } catch (e: any) { log.error('readStoreJSON:scan', e) }
  }
  for (const fullPath of candidates) { if (existsSync(fullPath)) { try { return JSON.parse(readFileSync(fullPath, 'utf8')) } catch { return null } } }
  return null
}

function readStoreJSONAny(relativePaths: string[], baseDir?: string) {
  for (const relativePath of relativePaths) {
    const data = readStoreJSON(relativePath, baseDir)
    if (data) return data
  }
  return null
}

function getBookForSnapshot(bookId?: string) {
  const db = getDB()
  if (bookId) {
    const book = db.getBook(bookId)
    if (book) return book
  }
  if (state.activeWritingBookId) {
    const book = db.getBook(state.activeWritingBookId)
    if (book) return book
  }
  return db.listBooks()?.[0] || null
}

function getBookRuntimeDir(bookId?: string) {
  const book = getBookForSnapshot(bookId)
  if (book?.id && state.activeWritingBookId && book.id === state.activeWritingBookId) {
    return findActiveBookDir() || state.outputDir || book.workspace_dir || null
  }
  return book?.workspace_dir || state.outputDir || null
}

function createSnapshotHandler() {
  return async (_e: Electron.IpcMainInvokeEvent, bookId?: string) => {
    const snap = createEmptySnapshot()
    const activeBook = getBookForSnapshot(bookId)
    const activeBookId = activeBook?.id || ''
    const isAlive = state.ainovelProcess !== null && state.ainovelProcess.exitCode === null
    snap.runtimeState = isAlive ? 'running' : 'idle'
    snap.isRunning = isAlive
    try {
      if (activeBook) {
        snap.novelName = activeBook.name || ''; snap.style = activeBook.style || ''
        snap.phase = activeBook.phase || 'init'; snap.totalWordCount = activeBook.totalWordCount || 0; snap.completedCount = activeBook.completedCount || 0
      }
    } catch (e: any) { log.error('snapshot:book', e) }
    if (isAlive) { fillRunningSnapshot(snap, activeBookId) }
    else { fillDbSnapshot(snap, activeBookId) }
    try { if (activeBookId) applyUsageSnapshot(snap, getDB().getUsageStats(activeBookId)) } catch (e: any) { log.error('snapshot:usage', e) }
    snap.statusLabel = deriveStatusLabel(snap)
    fillFallbackData(snap, activeBookId)
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

function applyProgressSnapshot(snap: any, progress: any) {
  if (!progress) return
  const contextPercent = progress.context_percent ?? progress.contextPercent
  const contextTokens = progress.context_tokens ?? progress.contextTokens
  const contextWindow = progress.context_window ?? progress.contextWindow
  const cacheRead = progress.cache_read ?? progress.cacheRead ?? progress.cache_read_tokens
  const cacheWrite = progress.cache_write ?? progress.cacheWrite ?? progress.cache_write_tokens
  if (contextPercent !== undefined) snap.contextPercent = Number(contextPercent) || 0
  if (contextTokens !== undefined) snap.contextTokens = Number(contextTokens) || 0
  if (contextWindow !== undefined) snap.contextWindow = Number(contextWindow) || 0
  if (cacheRead !== undefined) snap.cacheReadTokens = Number(cacheRead) || 0
  if (cacheWrite !== undefined) snap.cacheWriteTokens = Number(cacheWrite) || 0
}

function applyUsageSnapshot(snap: any, usage: any) {
  if (!usage) return
  snap.totalInputTokens = usage.total_input || 0
  snap.totalOutputTokens = usage.total_output || 0
  snap.totalCostUSD = usage.total_cost || 0
  snap.totalSavedUSD = usage.total_saved || 0
  snap.cacheReadTokens = usage.cache_read || 0
  snap.cacheWriteTokens = usage.cache_write || 0
}

function syncRuntimeMetaAndUsage(bookId: string, snap: any) {
  if (!bookId) return
  const runtimeDir = getBookRuntimeDir(bookId)
  try {
    const meta = readStoreJSONAny(['run.json', 'meta/run.json'], runtimeDir || undefined)
    if (meta) getDB().saveRunMeta(bookId, meta)
  } catch (e: any) { log.error('snapshot:sync-run-meta', e) }
  try {
    const usage = readStoreJSONAny(['usage.json', 'meta/usage.json'], runtimeDir || undefined)
    if (usage) getDB().saveUsageStats(bookId, usage)
  } catch (e: any) { log.error('snapshot:sync-usage', e) }
  try {
    const meta = getDB().getRunMeta(bookId)
    if (meta) {
      snap.provider = meta.provider || snap.provider || ''
      snap.modelName = meta.model || snap.modelName || ''
      snap.pendingSteer = meta.pending_steer || snap.pendingSteer || ''
    }
  } catch (e: any) { log.error('snapshot:apply-run-meta', e) }
  try { applyUsageSnapshot(snap, getDB().getUsageStats(bookId)) } catch (e: any) { log.error('snapshot:apply-usage', e) }
}

function fillRunningSnapshot(snap: any, bookId: string) {
  const runtimeDir = getBookRuntimeDir(bookId)
  const progress = readStoreJSONAny(['progress.json', 'meta/progress.json'], runtimeDir || undefined)
  if (progress) {
    if (progress.novel_name) snap.novelName = progress.novel_name
    snap.phase = progress.phase || snap.phase; snap.flow = progress.flow || ''
    const completed = progress.completed_chapters || []
    snap.completedCount = completed.length > 0 ? completed.length : snap.completedCount
    snap.totalChapters = progress.total_chapters || 0; snap.totalWordCount = progress.total_word_count || snap.totalWordCount
    snap.inProgressChapter = progress.in_progress_chapter || 0; snap.currentChapter = progress.current_chapter || 0
    snap.pendingRewrites = progress.pending_rewrites || []; snap.rewriteReason = progress.rewrite_reason || ''
    snap.layered = progress.layered || false
    applyProgressSnapshot(snap, progress)
    if (progress.current_volume && progress.current_arc) snap.currentVolumeArc = `第${progress.current_volume}卷·第${progress.current_arc}弧`
    if (completed.length > 0) {
      const last = completed[completed.length - 1]; const wc = (progress.chapter_word_counts || {})[last] || ''
      snap.lastCommitSummary = `第${last}章 ${wc}字`
    }
  }

  // 补充大纲列表：优先从 DB chapters 表（已由 startRuntimeSync 同步），合并 outline_entries
  try {
    if (bookId) {
      const dbChapters = getDB().listChapters(bookId)
      if (dbChapters?.length) {
        snap.outline = dbChapters.slice(-30).map((c: any) => ({
          chapter: c.num, title: c.title || `第${c.num}章`, coreEvent: '',
        }))
      }
      // 从 outline_entries 补充 coreEvent 和大纲独有条目
      const dbEntries = getDB().getOutlineEntries(bookId)
      if (dbEntries?.length) {
        const chMap = new Map<number, any>(snap.outline.map((o: any) => [o.chapter, o]))
        for (const e of dbEntries) {
          const ch = e.chapter || 0
          let existing = chMap.get(ch)
          if (existing) {
            if (e.core_event) existing.coreEvent = e.core_event
          } else {
            chMap.set(ch, { chapter: ch, title: e.title || '', coreEvent: e.core_event || '' })
          }
        }
        snap.outline = Array.from(chMap.values()).sort((a: any, b: any) => a.chapter - b.chapter).slice(-30)
      }
      // 如果 outline 为空（还未开始写章节），从分层大纲 arc_chapters 提取规划章节
      if (!snap.outline || snap.outline.length === 0) {
        const arcChs = getDB().getArcChapters(bookId)
        if (arcChs?.length) {
          snap.outline = arcChs.slice(-30).map((ac: any, idx: number) => ({
            chapter: idx + 1,
            title: ac.title || `第${idx + 1}章`,
            coreEvent: ac.core_event || '',
          }))
          snap.totalOutlineCount = arcChs.length
          snap.layered = true
        }
      }
      snap.totalOutlineCount = snap.outline.length
    }
  } catch (e: any) { log.error('fillRunningSnapshot:outline', e) }
  syncRuntimeMetaAndUsage(bookId, snap)
}

function fillDbSnapshot(snap: any, bookId: string) {
  try {
    if (!bookId) return
    try { const fullBook = getDB().getBook(bookId); if (fullBook?.premise) snap.premise = fullBook.premise.slice(0, 200) } catch (e: any) { log.error('snapshot:premise', e) }
    try { const chars = getDB().getCharacters(bookId); if (chars?.length) snap.characters = chars.map((c: any) => c.name + (c.role ? `（${c.role}）` : '')) } catch (e: any) { log.error('snapshot:chars', e) }
    try {
      const dbChapters = getDB().listChapters(bookId)
      if (dbChapters?.length) {
        snap.outline = dbChapters.slice(-30).map((c: any) => ({
          chapter: c.num, title: c.title || `第${c.num}章`, coreEvent: '',
        }))
      }
      const entries = getDB().getOutlineEntries(bookId)
      if (entries?.length) {
        const chMap = new Map<number, any>(snap.outline.map((o: any) => [o.chapter, o]))
        for (const e of entries) {
          const ch = e.chapter || 0
          const existing = chMap.get(ch)
          if (existing) { if (e.core_event) existing.coreEvent = e.core_event }
          else { chMap.set(ch, { chapter: ch, title: e.title || '', coreEvent: e.core_event || '' }) }
        }
        snap.outline = Array.from(chMap.values()).sort((a: any, b: any) => a.chapter - b.chapter).slice(-30)
      }
      // 如果 outline 为空，从分层大纲 arc_chapters 提取规划章节
      if (!snap.outline || snap.outline.length === 0) {
        const arcChs = getDB().getArcChapters(bookId)
        if (arcChs?.length) {
          snap.outline = arcChs.slice(-30).map((ac: any, idx: number) => ({
            chapter: idx + 1,
            title: ac.title || `第${idx + 1}章`,
            coreEvent: ac.core_event || '',
          }))
          snap.totalOutlineCount = arcChs.length
          snap.layered = true
        }
      }
      snap.totalOutlineCount = snap.outline.length
    } catch (e: any) { log.error('snapshot:outline', e) }
    try { const compass = getDB().getCompass(bookId); if (compass) { snap.compassDirection = compass.endingDirection || ''; snap.compassScale = compass.estimatedScale || '' } } catch (e: any) { log.error('snapshot:compass', e) }
    try { const reviews = getDB().getReviews(bookId); if (reviews?.length) { const last = reviews[reviews.length - 1]; snap.lastReviewSummary = last.summary ? `第${last.chapter}章: ${last.summary.slice(0, 80)}` : '' } } catch (e: any) { log.error('snapshot:reviews', e) }
    try { applyUsageSnapshot(snap, getDB().getUsageStats(bookId)) } catch (e: any) { log.error('snapshot:usage', e) }
    try { const meta = getDB().getRunMeta(bookId); if (meta) { snap.provider = meta.provider || ''; snap.modelName = meta.model || ''; snap.pendingSteer = meta.pending_steer || '' } } catch (e: any) { log.error('snapshot:meta', e) }
    try {
      const prog = getDB().database.prepare('SELECT * FROM progress WHERE book_id=?').get(bookId)
      if (prog) {
        snap.layered = !!prog.layered
        if (prog.total_chapters > 0) snap.totalChapters = prog.total_chapters
        snap.completedCount = (() => { try { return JSON.parse(prog.completed_chapters || '[]').length } catch { return 0 } })()
        snap.flow = prog.flow || snap.flow
        snap.inProgressChapter = prog.in_progress_chapter || 0
        snap.currentChapter = prog.current_chapter || 0
      }
    } catch (e: any) { log.error('snapshot:prog', e) }
    try {
      const runtimeDir = getBookRuntimeDir(bookId)
      const progress = readStoreJSONAny(['progress.json', 'meta/progress.json'], runtimeDir || undefined)
      applyProgressSnapshot(snap, progress)
    } catch (e: any) { log.error('snapshot:progress-json', e) }
    syncRuntimeMetaAndUsage(bookId, snap)
  } catch (e: any) { log.error('snapshot:db', e) }
}

function fillFallbackData(snap: any, bookId: string) {
  try {
    if (!bookId) return
    try { const fullBook = getDB().getBook(bookId); if (fullBook?.premise && !snap.premise) snap.premise = fullBook.premise.slice(0, 200) } catch (e: any) { log.error('snapshot:fallback-premise', e) }
    try { const chars = getDB().getCharacters(bookId); if (chars?.length && !snap.characters.length) snap.characters = chars.map((c: any) => c.name + (c.role ? `（${c.role}）` : '')) } catch (e: any) { log.error('snapshot:fallback-chars', e) }
    try { if (!snap.outline.length) {
      const dbChapters = getDB().listChapters(bookId)
      if (dbChapters?.length) {
        snap.outline = dbChapters.slice(-30).map((c: any) => ({ chapter: c.num, title: c.title || `第${c.num}章`, coreEvent: '' }))
      }
      const dbEntries = getDB().getOutlineEntries(bookId)
      if (dbEntries?.length) {
        const chMap = new Map<number, any>(snap.outline.map((o: any) => [o.chapter, o]))
        for (const e of dbEntries) {
          const ch = e.chapter || 0
          const existing = chMap.get(ch)
          if (existing) { if (e.core_event) existing.coreEvent = e.core_event }
          else { chMap.set(ch, { chapter: ch, title: e.title || '', coreEvent: e.core_event || '' }) }
        }
        snap.outline = Array.from(chMap.values()).sort((a: any, b: any) => a.chapter - b.chapter).slice(-30)
      }
      snap.totalOutlineCount = snap.outline.length
    } } catch (e: any) { log.error('snapshot:fallback-outline', e) }
    try { if (!snap.compassDirection) { const compass = getDB().getCompass(bookId); if (compass) { snap.compassDirection = compass.endingDirection || ''; snap.compassScale = compass.estimatedScale || '' } } } catch (e: any) { log.error('snapshot:fallback-compass', e) }
    try { if (!snap.lastReviewSummary) { const reviews = getDB().getReviews(bookId); if (reviews?.length) { const last = reviews[reviews.length - 1]; snap.lastReviewSummary = last.summary ? `第${last.chapter}章: ${last.summary.slice(0, 80)}` : '' } } } catch (e: any) { log.error('snapshot:fallback-review', e) }
    try { if (!snap.totalInputTokens && !snap.totalOutputTokens) applyUsageSnapshot(snap, getDB().getUsageStats(bookId)) } catch (e: any) { log.error('snapshot:fallback-usage', e) }
    try { const meta = getDB().getRunMeta(bookId); if (meta) { if (!snap.provider) snap.provider = meta.provider || ''; if (!snap.modelName) snap.modelName = meta.model || '' } } catch (e: any) { log.error('snapshot:fallback-meta', e) }
    try {
      const runtimeDir = getBookRuntimeDir(bookId)
      const progress = readStoreJSONAny(['progress.json', 'meta/progress.json'], runtimeDir || undefined)
      applyProgressSnapshot(snap, progress)
    } catch (e: any) { log.error('snapshot:fallback-progress-json', e) }
    syncRuntimeMetaAndUsage(bookId, snap)
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
  if (snap.phase === 'complete') return 'COMPLETE'
  if (!snap.isRunning) return 'READY'
  if (snap.flow === 'reviewing') return 'REVIEW'
  if (snap.flow === 'rewriting') return 'REWRITE'
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

function getActiveWritingBookId() {
  if (state.activeWritingBookId) return state.activeWritingBookId
  try { return getDB().listBooks()?.[0]?.id || '' }
  catch (e: any) { log.error('getActiveWritingBookId', e); return '' }
}

function sendProcessExited(code: number | null) {
  if (!state.mainWindow || state.mainWindow.isDestroyed()) return
  state.mainWindow.webContents.send('process-exited', {
    code,
    bookId: state.activeWritingBookId || '',
    pendingUserConfirm,
  })
}

let snapshotTimer: ReturnType<typeof setInterval> | null = null
let runtimeSyncActive = false
let chapterCache: { files: string[]; mtime: number } | null = null
/** JSON 规划文件 mtime 缓存，key=文件名，value=mtimeMs */
let planFileCache: Record<string, number> = {}
/** 上一轮同步时的 phase，用于检测 phase 跃迁 */
let lastPhase = ''
/** 是否已暂停等待用户确认继续写作（避免重复暂停） */
let pendingUserConfirm = false
/** 从大纲数据提取的预定章节标题，按顺序排列（索引 0 → 第1章） */
let plannedChapterTitles: string[] = []

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
    const bookId = getActiveWritingBookId()

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
              const content = readFileSync(join(chDir, file), 'utf8')
              // 优先使用大纲定义的标题，其次用 markdown H1，最后用默认标题
              const planned = num > 0 && num <= plannedChapterTitles.length ? plannedChapterTitles[num - 1] : ''
              const fromContent = content.split('\n')[0]?.replace(/^#\s*/, '').trim() || ''
              const title = planned || fromContent || `第${num}章`
              db.saveChapter(bookId, num, content, title)
              if (planned && planned !== fromContent) {
                log.debug('runtime-sync:chapters 使用预定标题', { num, planned, fromContent })
              }
            }
          }
          chapterCache = { files, mtime: currentMtime }
        }
      } catch (e: any) { log.error('runtime-sync:chapters', e) }
    }

    // 同步 progress.json → SQLite progress 表（确保书籍列表/DB 快照数据最新）
    if (bookId) {
      try {
        const progJson = readStoreJSON('meta/progress.json')
        if (progJson) {
          const completed = JSON.stringify(progJson.completed_chapters || [])
          const wcMap = JSON.stringify(progJson.chapter_word_counts || {})
          db.database.prepare(`INSERT OR REPLACE INTO progress 
            (book_id, novel_name, phase, current_chapter, total_chapters, completed_chapters, 
             total_word_count, chapter_word_counts, in_progress_chapter, flow, 
             pending_rewrites, rewrite_reason, current_volume, current_arc, layered,
             reopened_from_complete, strand_history, hook_history) 
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(
              bookId,
              progJson.novel_name || '',
              progJson.phase || 'init',
              progJson.current_chapter || 0,
              progJson.total_chapters || 0,
              completed,
              progJson.total_word_count || 0,
              wcMap,
              progJson.in_progress_chapter || 0,
              progJson.flow || 'writing',
              JSON.stringify(progJson.pending_rewrites || []),
              progJson.rewrite_reason || '',
              progJson.current_volume || 0,
              progJson.current_arc || 0,
              progJson.layered ? 1 : 0,
              progJson.reopened_from_complete ? 1 : 0,
              JSON.stringify(progJson.strand_history || []),
              JSON.stringify(progJson.hook_history || []),
            )

          // 书名自动更新：CLI 生成的名字覆盖 SQLite 暂用名
          if (progJson.novel_name) {
            const curBook = db.getBook(bookId)
            if (curBook && curBook.name !== progJson.novel_name) {
              db.updateBook(bookId, { name: progJson.novel_name })
            }
          }
        }

        // ── 规划完成检测：phase 从 init/outline 跃迁到 writing 时暂停，等待用户确认 ──
        try {
          const curPhase = progJson?.phase || ''
          const isPlanningPhase = ['init', 'premise', 'outline'].includes(lastPhase)
          const justEnteredWriting = curPhase === 'writing' && isPlanningPhase
          if (justEnteredWriting && !pendingUserConfirm && state.ainovelProcess) {
            pendingUserConfirm = true
            log.info('runtime-sync:planning-complete 规划完成，暂停等待用户确认', { bookId })
            // 暂停 CLI
            try { state.ainovelProcess.kill('SIGINT') } catch {}
            // 通知前端
            if (state.mainWindow && !state.mainWindow.isDestroyed()) {
              state.mainWindow.webContents.send('planning-complete', { bookId })
            }
          }
          lastPhase = curPhase || ''
        } catch (e: any) { log.error('runtime-sync:phase-detect', e) }
      } catch (e: any) { log.error('runtime-sync:progress', e) }
    }

    // 同步规划数据 → SQLite（大纲/角色/时间线/世界观等）
    syncPlanningData(bookDir, db, bookId)

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

/**
 * 从 CLI 输出目录同步规划数据到 SQLite
 * 涵盖：大纲、卷弧、指南针、角色、配角、时间线、伏笔、关系、
 *       世界观、风格规则、评审、摘要、仿写画像、用户规则、用户指令
 * 使用 mtime 缓存避免重复扫描
 */
function syncPlanningData(bookDir: string, db: any, bookId: string) {
  if (!bookId || !bookDir) return
  const { existsSync, readFileSync, readdirSync, statSync } = require('fs')
  const { join } = require('path')

  const planFiles: { key: string; path: string; save: (data: any) => void }[] = [
    // 大纲（扁平）
    {
      key: 'outline', path: join(bookDir, 'outline.json'),
      save: (data: any) => { if (data?.length) db.saveOutlineEntries(bookId, data) },
    },
    // 分层大纲（卷+弧）— CLI 输出用 index 字段，需归一化到 idx
    {
      key: 'layered_outline', path: join(bookDir, 'layered_outline.json'),
      save: (data: any) => {
        if (data?.length) {
          // 归一化：index → idx（CLI 输出用 index，DB schema 用 idx）
          const normalized = data.map((v: any) => ({
            ...v,
            idx: v.idx ?? v.index ?? 0,
            arcs: (v.arcs || []).map((a: any) => ({
              ...a,
              idx: a.idx ?? a.index ?? 0,
              chapters: (a.chapters || []).map((c: any) => ({
                ...c,
                chapter: c.chapter ?? 0,
              })),
            })),
          }))
          db.saveVolumes(bookId, normalized)
          const allArcs: any[] = []; const allArcChapters: any[] = []
          for (const v of normalized) {
            for (const a of (v.arcs || [])) {
              allArcs.push({ volume_idx: v.idx, idx: a.idx, title: a.title, goal: a.goal, estimated_chapters: a.estimatedChapters || 0 })
              for (const ac of (a.chapters || [])) allArcChapters.push({ volume_idx: v.idx, arc_idx: a.idx, chapter: ac.chapter || 0, title: ac.title, core_event: ac.coreEvent || '', hook: ac.hook || '', scenes: ac.scenes || [] })
            }
          }
          if (allArcs.length) db.saveArcs(bookId, allArcs)
          if (allArcChapters.length) db.saveArcChapters(bookId, allArcChapters)
          // 按卷/弧顺序提取预定章节标题，供写入章节时使用
          plannedChapterTitles = allArcChapters.map((ac: any) => ac.title || '')
          log.info('runtime-sync:plan 已提取预定章节标题', { count: plannedChapterTitles.length })
        }
      },
    },
    // 指南针
    {
      key: 'compass', path: join(bookDir, 'compass.json'),
      save: (data: any) => { if (data) db.saveCompass(bookId, data) },
    },
    // 角色
    {
      key: 'characters', path: join(bookDir, 'characters.json'),
      save: (data: any) => { if (data?.length) db.saveCharacters(bookId, data) },
    },
    // 配角名册
    {
      key: 'cast', path: join(bookDir, 'cast_ledger.json'),
      save: (data: any) => { if (data?.length) db.saveCastEntries(bookId, data) },
    },
    // 时间线
    {
      key: 'timeline', path: join(bookDir, 'timeline.json'),
      save: (data: any) => { if (data?.length) db.saveTimelineEvents(bookId, data) },
    },
    // 伏笔
    {
      key: 'foreshadow', path: join(bookDir, 'foreshadow_ledger.json'),
      save: (data: any) => { if (data?.length) db.saveForeshadowEntries(bookId, data) },
    },
    // 关系
    {
      key: 'relationships', path: join(bookDir, 'relationship_state.json'),
      save: (data: any) => { if (data?.length) db.saveRelationshipEntries(bookId, data) },
    },
    // 状态变化
    {
      key: 'state_changes', path: join(bookDir, 'state_changes.json'),
      save: (data: any) => { if (data?.length) db.saveStateChanges(bookId, data) },
    },
    // 世界观规则
    {
      key: 'world_rules', path: join(bookDir, 'world_rules.json'),
      save: (data: any) => { if (data?.length) db.saveWorldRules(bookId, data) },
    },
    // 风格规则
    {
      key: 'style_rules', path: join(bookDir, 'style_rules.json'),
      save: (data: any) => { if (data) db.saveStyleRules(bookId, data) },
    },
    // 仿写画像
    {
      key: 'simulation_profile', path: join(bookDir, 'simulation_profile.json'),
      save: (data: any) => { if (data) db.saveSimulationProfile(bookId, data) },
    },
    // 用户规则
    {
      key: 'user_rules', path: join(bookDir, 'user_rules.json'),
      save: (data: any) => { if (data) db.saveUserRules(bookId, data) },
    },
  ]

  for (const pf of planFiles) {
    try {
      if (!existsSync(pf.path)) continue
      const mtime = statSync(pf.path).mtimeMs
      const cached = planFileCache[pf.key]
      if (cached === mtime) continue // 未变更，跳过
      const raw = readFileSync(pf.path, 'utf8')
      const data = JSON.parse(raw)
      pf.save(data)
      planFileCache[pf.key] = mtime
      log.info('runtime-sync:plan', { key: pf.key, bookId })
    } catch (e: any) {
      // JSON 解析失败等静默跳过（CLI 正在写入中的半成品文件）
      log.debug('runtime-sync:plan-skip', { key: pf.key, error: e.message })
    }
  }

  // 评审（reviews/ 目录下的独立 JSON 文件）
  try {
    const reviewDir = join(bookDir, 'reviews')
    if (existsSync(reviewDir)) {
      const files = readdirSync(reviewDir).filter((f: string) => f.endsWith('.json')).sort()
      if (files.length > 0) {
        const cacheKey = 'reviews_dir'
        const dirMtime = statSync(reviewDir).mtimeMs
        if (planFileCache[cacheKey] !== dirMtime) {
          const reviews = files.map((f: string) => {
            try { return JSON.parse(readFileSync(join(reviewDir, f), 'utf8')) } catch { return null }
          }).filter(Boolean)
          if (reviews.length) db.saveReviews(bookId, reviews)
          planFileCache[cacheKey] = dirMtime
          log.info('runtime-sync:plan', { key: 'reviews', bookId, count: reviews.length })
        }
      }
    }
  } catch (e: any) { log.debug('runtime-sync:plan-skip', { key: 'reviews', error: e.message }) }

  // 摘要（summaries/ 目录下的独立 JSON 文件）
  try {
    const summaryDir = join(bookDir, 'summaries')
    if (existsSync(summaryDir)) {
      const files = readdirSync(summaryDir).filter((f: string) => f.endsWith('.json')).sort()
      if (files.length > 0) {
        const cacheKey = 'summaries_dir'
        const dirMtime = statSync(summaryDir).mtimeMs
        if (planFileCache[cacheKey] !== dirMtime) {
          const summaries = files.map((f: string) => {
            try {
              const s: any = JSON.parse(readFileSync(join(summaryDir, f), 'utf8'))
              if (s.chapter) return { type: 'chapter', ref_key: String(s.chapter), summary: s.summary || '', characters: s.characters || [], key_events: s.keyEvents || s.key_events || [] }
              if (s.arc !== undefined) return { type: 'arc', ref_key: `arc-v${String(s.volume).padStart(2,'0')}a${String(s.arc).padStart(2,'0')}`, summary: s.summary || '', characters: [], key_events: s.keyEvents || s.key_events || [] }
              if (s.volume && s.arc === undefined) return { type: 'volume', ref_key: `vol-v${String(s.volume).padStart(2,'0')}`, summary: s.summary || '', characters: [], key_events: s.keyEvents || s.key_events || [] }
              return null
            } catch { return null }
          }).filter(Boolean)
          if (summaries.length) db.saveSummaries(bookId, summaries)
          planFileCache[cacheKey] = dirMtime
          log.info('runtime-sync:plan', { key: 'summaries', bookId, count: summaries.length })
        }
      }
    }
  } catch (e: any) { log.debug('runtime-sync:plan-skip', { key: 'summaries', error: e.message }) }

  // 用户指令（meta/user_directives.json）
  try {
    const userDirPath = join(bookDir, 'meta', 'user_directives.json')
    const cacheKey = 'user_directives'
    if (existsSync(userDirPath)) {
      const mtime = statSync(userDirPath).mtimeMs
      if (planFileCache[cacheKey] !== mtime) {
        const raw = readFileSync(userDirPath, 'utf8')
        const data = JSON.parse(raw)
        if (data?.length) db.saveUserDirectives(bookId, data)
        planFileCache[cacheKey] = mtime
        log.info('runtime-sync:plan', { key: 'user_directives', bookId })
      }
    }
  } catch (e: any) { log.debug('runtime-sync:plan-skip', { key: 'user_directives', error: e.message }) }
}

module.exports = { register }
