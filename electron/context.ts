// @ts-nocheck — CJS 上下文模块
/**
 * Electron 主进程共享上下文
 *
 * 所有 IPC 模块共享的全局状态，避免循环依赖。
 */
const { createLogger } = require('./logger')
const { AppDatabase } = require('./database')
const { join } = require('path')
const { app } = require('electron')
const { existsSync, mkdirSync } = require('fs')

const log = createLogger('ctx')

// ── 全局状态 ──
const state = {
  mainWindow: null,
  ainovelProcess: null,
  outputDir: '',
  configPath: '',
  db: null,
  /** 引擎事件缓冲区（从 stderr 实时捕获，供前端轮询） */
  engineEvents: [],
  /** 检查点文件替代路径 */
  cpPathAlt: null,
}

// ── 数据库 ──
const home = app.getPath('home')
const GUI_DATA_DIR = join(home, '.ainovel-gui')

function getDB() {
  if (!state.db) {
    if (!existsSync(GUI_DATA_DIR)) mkdirSync(GUI_DATA_DIR, { recursive: true })
    state.db = new AppDatabase(join(GUI_DATA_DIR, 'ainovel.db'))
  }
  return state.db
}

function getAinovelBinary() {
  const { execSync } = require('child_process')
  const os = require('os')
  // 1) 打包后的 extraResources
  const { join: pJoin } = require('path')
  const ext = os.platform() === 'win32' ? '.exe' : ''
  const bundled = pJoin(__dirname, '..', 'ainovel-cli', 'ainovel-cli' + ext)
  if (existsSync(bundled)) return bundled

  // 2) PATH
  try {
    const cmd = os.platform() === 'win32' ? 'where ainovel-cli' : 'which ainovel-cli'
    const which = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0]
    if (which) return which
  } catch { log.debug('ainovel-cli not in PATH') }

  // 3) 常见位置
  const h = app.getPath('home')
  const candidates = os.platform() === 'win32'
    ? [pJoin(h, 'AppData', 'Local', 'ainovel-cli', 'ainovel-cli.exe'),
       pJoin(h, 'go', 'bin', 'ainovel-cli.exe')]
    : ['/usr/local/bin/ainovel-cli', '/usr/bin/ainovel-cli',
       pJoin(h, 'go', 'bin', 'ainovel-cli'),
       pJoin(h, '.local', 'bin', 'ainovel-cli')]
  for (const c of candidates) {
    if (existsSync(c)) return c
  }
  return bundled
}

module.exports = { state, getDB, getAinovelBinary, GUI_DATA_DIR, home, log }
