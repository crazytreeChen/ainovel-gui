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
      sandbox: false,
    },
  })

  if (isDev) {
    state.mainWindow.loadURL('http://localhost:5173')
    state.mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    state.mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  state.mainWindow.on('ready-to-show', () => state.mainWindow?.show())
  state.mainWindow.on('closed', () => { state.mainWindow = null })

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
  // 停止 ainovel 进程（writing 模块暴露的 stopAinovelProcess 在模块内部
  // 通过 state.ainovelProcess 控制）
  const { spawn } = require('child_process')
  if (state.ainovelProcess && state.ainovelProcess.exitCode === null) {
    try {
      state.ainovelProcess.kill('SIGTERM')
    } catch { /* 进程可能已退出 */ }
  }
  state.engineEvents.length = 0
})
