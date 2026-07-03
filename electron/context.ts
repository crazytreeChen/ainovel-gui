export {}
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
  const { join: pJoin, resolve } = require('path')
  const ext = os.platform() === 'win32' ? '.exe' : ''
  const binName = 'ainovel-cli' + ext

  // 白名单路径前缀：仅允许这些目录下的二进制
  const h = app.getPath('home')
  const allowedPrefixes = [
    pJoin(process.resourcesPath || '', 'ainovel-cli'),
    pJoin(__dirname, '..', 'build', 'ainovel-cli', 'bin'),
    '/usr/local/bin',
    '/usr/bin',
    pJoin(h, 'go', 'bin'),
    pJoin(h, '.local', 'bin'),
  ]
  if (os.platform() === 'win32') {
    allowedPrefixes.push(
      pJoin(h, 'AppData', 'Local', 'ainovel-cli'),
      pJoin(h, 'go', 'bin'),
    )
  }

  function isAllowed(absPath: string): boolean {
    const resolved = resolve(absPath)
    return allowedPrefixes.some(prefix => resolved.startsWith(prefix))
  }

  // 1) 打包后的 extraResources
  try {
    const packaged = pJoin(process.resourcesPath || '', 'ainovel-cli', binName)
    if (existsSync(packaged) && isAllowed(packaged)) return packaged
  } catch {}

  // 2) 开发构建位置
  const devBin = pJoin(__dirname, '..', 'build', 'ainovel-cli', 'bin', binName)
  if (existsSync(devBin) && isAllowed(devBin)) return devBin

  // 3) PATH（仅接受白名单内的路径）
  try {
    const cmd = os.platform() === 'win32' ? 'where ainovel-cli' : 'which ainovel-cli'
    const which = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0]
    if (which && isAllowed(which)) return which
  } catch { log.debug('ainovel-cli not in PATH') }

  // 4) 常见位置
  const candidates = os.platform() === 'win32'
    ? [pJoin(h, 'AppData', 'Local', 'ainovel-cli', binName),
       pJoin(h, 'go', 'bin', binName)]
    : ['/usr/local/bin/' + binName, '/usr/bin/' + binName,
       pJoin(h, 'go', 'bin', binName),
       pJoin(h, '.local', 'bin', binName)]
  for (const c of candidates) {
    if (existsSync(c) && isAllowed(c)) return c
  }

  // 5) 降级（仅二进制名，依赖 PATH 查找）
  return binName
}

module.exports = { state, getDB, getAinovelBinary, GUI_DATA_DIR, home, log }
