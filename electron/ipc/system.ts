// @ts-nocheck — CJS IPC 模块
/**
 * 系统 IPC（模型/配置/更新/诊断/目录/封面）
 */
const { state, getDB, getAinovelBinary, GUI_DATA_DIR, home } = require('../context')
const { validatePath } = require('../path-validator')
const { createLogger } = require('../logger')
const { join, dirname, resolve, extname, sep } = require('path')
const { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync, unlinkSync } = require('fs')
const { execFileSync, spawn } = require('child_process')
const os = require('os')

const log = createLogger('ipc:system')

const CONFIG_PATH = join(home, '.ainovel', 'config.json')
const coverExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']

function runCli(binary, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const { cwd, timeout } = opts
    const child = spawn(binary, args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
    const outChunks = []
    const errChunks = []
    let killedByTimeout = false
    const timer = timeout ? setTimeout(() => { killedByTimeout = true; child.kill('SIGTERM') }, timeout) : null
    child.stdout.on('data', d => outChunks.push(d))
    child.stderr.on('data', d => errChunks.push(d))
    child.on('error', err => { if (timer) clearTimeout(timer); reject(err) })
    child.on('close', code => {
      if (timer) clearTimeout(timer)
      const stdout = Buffer.concat(outChunks).toString('utf8')
      const stderr = Buffer.concat(errChunks).toString('utf8')
      const e = killedByTimeout
        ? new Error(`CLI 超时 (${timeout}ms)`)
        : new Error(`CLI exit ${code}`)
      e.stdout = stdout
      e.stderr = stderr
      if (killedByTimeout || code !== 0) return reject(e)
      resolve(stdout)
    })
  })
}

// download-update URL 白名单：仅允许 GitHub 官方 releases 路径，防止 SSRF
const ALLOWED_DOWNLOAD_HOST = 'github.com'
const ALLOWED_DOWNLOAD_PATH_PREFIX = '/crazytreeChen/ainovel-gui/releases/download/'

function validateDownloadUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' &&
           parsed.hostname === ALLOWED_DOWNLOAD_HOST &&
           parsed.pathname.startsWith(ALLOWED_DOWNLOAD_PATH_PREFIX)
  } catch { return false }
}

const ALLOWED_INSTALL_EXTS = ['.dmg', '.exe', '.appimage', '.deb']
function validateInstallPath(filePath) {
  if (typeof filePath !== 'string' || !filePath) return false
  const downloadsDir = require('electron').app.getPath('downloads')
  const resolved = resolve(filePath)
  const downloadsPrefix = downloadsDir.endsWith(sep) ? downloadsDir : downloadsDir + sep
  if (!resolved.startsWith(downloadsPrefix)) return false
  const ext = extname(resolved).toLowerCase()
  if (!ALLOWED_INSTALL_EXTS.includes(ext)) return false
  if (!existsSync(resolved)) return false
  return true
}

function register(ipcMain) {
  // ── 目录管理 ──
  ipcMain.handle('select-directory', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: '选择小说工作目录', message: '选择存放 output/ 的父目录（即运行 ainovel-cli 的工作目录）' })
    if (result.canceled || result.filePaths.length === 0) return null
    state.outputDir = result.filePaths[0]
    return state.outputDir
  })

  ipcMain.handle('set-directory', async (_e, dir) => {
    const safeDir = validatePath(dir)
    state.outputDir = safeDir
    if (!existsSync(safeDir)) mkdirSync(safeDir, { recursive: true })
    return true
  })

  ipcMain.handle('get-directory', async () => state.outputDir)
  ipcMain.handle('open-directory', async (_e, dir) => { require('electron').shell.openPath(validatePath(dir)) })

  // ── CLI 二进制检查 ──
  ipcMain.handle('check-binary', async () => {
    try {
      const binary = getAinovelBinary()
      if (!existsSync(binary)) return { available: false, version: '', path: binary }
      const version = execFileSync(binary, ['--version'], { encoding: 'utf8', shell: false }).trim()
      return { available: true, version, path: binary }
    } catch (e) { log.warn('check-binary', e?.message || e); return { available: false, version: '', path: '' } }
  })

  // ── 诊断 ──
  ipcMain.handle('run-diag', async () => {
    const binary = getAinovelBinary()
    const cwd = state.outputDir || require('electron').app.getPath('documents')
    try { return await runCli(binary, ['--headless', '--diag'], { cwd, timeout: 60000 }) }
    catch (e) { return e.stdout || e.stderr || e.message || '诊断执行失败' }
  })

  ipcMain.handle('read-diag-report', async () => {
    if (!state.outputDir) return ''
    const f = join(state.outputDir, 'output', 'meta', 'diag-export.md')
    if (!existsSync(f)) return ''
    return readFileSync(f, 'utf8')
  })

  ipcMain.handle('run-simulate', async (_e, bookId) => {
    const binary = getAinovelBinary()
    let cwd = state.outputDir || require('electron').app.getPath('documents')
    if (bookId) { try { const book = getDB().getBook(bookId); if (book?.workspace_dir) cwd = book.workspace_dir } catch (e) { log.error('run-simulate:getBook', e) } }
    try { return await runCli(binary, ['--headless', '--prompt', '/simulate'], { cwd, timeout: 120000 }) }
    catch (e) { return e.stdout || e.stderr || e.message || '仿写分析执行失败' }
  })

  ipcMain.handle('run-export', async (_e, args) => {
    const binary = getAinovelBinary()
    const cwd = state.outputDir || require('electron').app.getPath('documents')
    const argv = ['--headless', '/export', ...args.split(' ').filter(Boolean)]
    try { return await runCli(binary, argv, { cwd, timeout: 60000 }) }
    catch (e) { return e.stdout || e.stderr || e.message || '导出失败' }
  })

  // ── 配置管理 ──
  ipcMain.handle('save-config-value', async (_e, key, value) => { getDB().setConfig(key, value); return true })
  ipcMain.handle('load-config-value', async (_e, key) => { return getDB().getConfig(key) })

  // ── 模型管理 ──
  ipcMain.handle('fetch-models', async (_e, baseUrl, apiKey, protocol) => {
    try {
      const url = protocol === 'openai' ? baseUrl.replace(/\/+$/, '') + '/models' : baseUrl.replace(/\/+$/, '') + '/v1/models'
      const headers = { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' }
      const resp = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
      if (!resp.ok) return { error: 'HTTP ' + resp.status + ': ' + resp.statusText }
      const data = await resp.json()
      const models = (data.data || data.models || []).map(m => m.id || m.name).filter(Boolean)
      return { models }
    } catch (e) { return { error: e.message || '请求失败' } }
  })

  ipcMain.handle('load-provider-config', async () => {
    try {
      const config = getDB().getConfig('provider_config')
      if (config) return config
    } catch (e) { log.error('load-provider-config:db', e) }
    if (!existsSync(CONFIG_PATH)) return null
    try {
      const jsonConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
      getDB().setConfig('provider_config', jsonConfig)
      return jsonConfig
    } catch (e) { log.error('load-provider-config:file', e); return null }
  })

  ipcMain.handle('save-provider-config', async (_e, config) => {
    try { getDB().setConfig('provider_config', config) } catch (e) { log.error('save-provider-config:db', e) }
    const dir = dirname(CONFIG_PATH)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
    return true
  })

  // ── 封面图片 ──
  ipcMain.handle('select-cover-image', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog({ properties: ['openFile'], title: '选择封面图片', filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('save-book-cover', async (_e, id, imagePath) => {
    const { join: pJoin } = require('path')
    const safeImagePath = validatePath(imagePath)
    const dir = pJoin(GUI_DATA_DIR, 'books', id)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    if (!existsSync(safeImagePath)) { log.error('save-cover: image not found:', safeImagePath); return false }
    const ext = coverExts.find(e => safeImagePath.toLowerCase().endsWith(e)) || '.png'
    const dest = pJoin(dir, 'cover' + ext)
    for (const e of coverExts) { const old = pJoin(dir, 'cover' + e); if (old !== dest && existsSync(old)) try { unlinkSync(old) } catch (e) { log.error('save-cover:unlink', e) } }
    try { copyFileSync(safeImagePath, dest); return true } catch (e) { log.error('save-cover:copy', e); return e.message }
  })

  ipcMain.handle('get-book-cover', async (_e, id) => {
    const { join: pJoin } = require('path')
    const dir = validatePath(pJoin(GUI_DATA_DIR, 'books', id))
    if (!existsSync(dir)) return null
    for (const ext of coverExts) {
      const coverFile = pJoin(dir, 'cover' + ext)
      if (existsSync(coverFile)) {
        const data = readFileSync(coverFile)
        const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/bmp'
        return `data:${mime};base64,${data.toString('base64')}`
      }
    }
    return null
  })

  // ── 自动更新 ──
  ipcMain.handle('check-update', async () => {
    try {
      const apiUrl = 'https://api.github.com/repos/crazytreeChen/ainovel-gui/releases/latest'
      const apiResp = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'ainovel-gui' }, signal: AbortSignal.timeout(10000) })
      if (!apiResp.ok) return { available: false, error: 'HTTP ' + apiResp.status }
      const release = await apiResp.json()
      const latestVersion = (release.tag_name || '').replace(/^v/, '') || '0.0.0'
      const manifestUrl = `https://github.com/crazytreeChen/ainovel-gui/releases/download/v${latestVersion}/download.json`
      const manifestResp = await fetch(manifestUrl, { signal: AbortSignal.timeout(10000) })
      if (!manifestResp.ok) return { available: false, error: '无法获取版本清单' }
      const manifest = await manifestResp.json()
      const platform = os.platform() === 'darwin' ? (os.arch() === 'arm64' ? 'mac-arm64' : 'mac-x64') : os.platform() === 'win32' ? 'win-x64' : 'linux-x64'
      const download = manifest.downloads?.[platform]
      const available = semverGt(latestVersion, APP_VERSION)
      return { available, currentVersion: APP_VERSION, latestVersion, url: download?.url || '', notes: manifest.release_notes || '', releaseDate: manifest.release_date || '', size: download?.size || 0, sha256: download?.sha256 || '' }
    } catch (e) { return { available: false, error: e.message || '检查更新失败' } }
  })

  ipcMain.handle('download-update', async (_e, url, expectedSha256) => {
    try {
      if (!validateDownloadUrl(url)) return { success: false, error: 'URL 不在白名单内，仅允许 https://github.com/crazytreeChen/ainovel-gui/releases/download/ 路径' }
      const crypto = require('crypto')
      const destDir = require('electron').app.getPath('downloads')
      const filename = url.split('/').pop() || 'ainovel-update'
      const destPath = join(destDir, filename)
      const response = await fetch(url, { signal: AbortSignal.timeout(600000) })
      if (!response.ok) return { success: false, error: 'HTTP ' + response.status }
      const totalSize = parseInt(response.headers.get('content-length') || '0')
      const chunks = []; let downloaded = 0
      for await (const chunk of response.body) { chunks.push(Buffer.from(chunk)); downloaded += chunk.length; if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('download-progress', { percent: totalSize > 0 ? Math.round((downloaded / totalSize) * 100) : 0, bytesPerSecond: 0, downloaded, total: totalSize }) }
      const fileBuffer = Buffer.concat(chunks)
      writeFileSync(destPath, fileBuffer)
      if (expectedSha256) {
        const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
        if (actualHash !== expectedSha256.toLowerCase()) { unlinkSync(destPath); return { success: false, error: 'SHA256 校验失败' } }
      }
      return { success: true, path: destPath, size: fileBuffer.length }
    } catch (e) { return { success: false, error: e.message || '下载失败' } }
  })

  ipcMain.handle('install-update', async (_e, filePath) => {
    try {
      if (!validateInstallPath(filePath)) return { success: false, error: '非法的安装包路径：仅允许 downloads 目录下的 .dmg/.exe/.AppImage/.deb 文件' }
      if (os.platform() === 'win32') { require('child_process').spawn(filePath, ['/S'], { detached: true, stdio: 'ignore' }); return { success: true } }
      else { require('electron').shell.openPath(filePath); return { success: true } }
    } catch (e) { return { success: false, error: e.message || '启动安装失败' } }
  })
}

const APP_VERSION = '0.2.0'
function semverGt(a, b) {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false }
  return false
}

module.exports = { register }
