export {}

const { app, BrowserWindow, ipcMain } = require('electron')
const { join } = require('path')
const { existsSync } = require('fs')
const { createLogger } = require('./logger')
const { state, getDB, GUI_DATA_DIR } = require('./context')
const { register: registerBooks } = require('./ipc/books')
const { register: registerWorkspace } = require('./ipc/workspace')
const { register: registerWriting } = require('./ipc/writing')
const { register: registerSystem } = require('./ipc/system')
const { register: registerCocreate } = require('./ipc/cocreate')

const log = createLogger('main')

// ── 运行环境 ──
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')

// ── 窗口创建 ──
function createWindow() {
  state.mainWindow = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1100, minHeight: 700,
    title: 'AINovel',
    backgroundColor: '#1c1c1c',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (isDev) {
    state.mainWindow.loadURL('http://localhost:5173')
  } else {
    state.mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  state.mainWindow.on('ready-to-show', () => state.mainWindow?.show())
  // 点叉号后强制整应用退出，避免 dev 残留/启动 cmd 不结束
  state.mainWindow.on('close', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
  state.mainWindow.on('closed', () => {
    state.mainWindow = null
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  const homeConfig = join(app.getPath('home'), '.ainovel', 'config.json')
  if (existsSync(homeConfig)) state.configPath = homeConfig
}

// ── 生命周期 ──
app.whenReady().then(() => {
  // 注册所有 IPC 模块
  registerBooks(ipcMain)
  registerWorkspace(ipcMain)
  registerWriting(ipcMain)
  registerSystem(ipcMain)
  registerCocreate(ipcMain)
  log.info('All IPC modules registered')

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  // 停止 ainovel 进程并清理运行时同步定时器
  try {
    const { stopAinovelProcess } = require('./ipc/writing')
    if (typeof stopAinovelProcess === 'function') {
      // 给一点时间优雅停写，但不无限卡住退出
      await Promise.race([
        stopAinovelProcess(),
        new Promise((r) => setTimeout(r, 3000)),
      ])
    }
  } catch (e) {
    log.warn('before-quit stopAinovelProcess failed', e)
  }
})

// 确保进程退出时尽量结束子进程，让 concurrently/cmd 一并结束
app.on('will-quit', () => {
  try {
    const { stopAinovelProcess } = require('./ipc/writing')
    if (typeof stopAinovelProcess === 'function') {
      // fire-and-forget best effort
      stopAinovelProcess()
    }
  } catch {}
})
