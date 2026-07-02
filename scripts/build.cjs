#!/usr/bin/env node

/**
 * AINovel GUI 构建脚本
 * 
 * 构建流程:
 *   1. 生成图标
 *   2. 编译 ainovel-cli 二进制（含 UPX 压缩，如有）
 *   3. 清理 node_modules 无用文件（减少 asar 体积）
 *   4. 构建渲染进程 (Vite) + 主进程 (tsc)
 *   5. electron-builder 打包分发
 * 
 * 用法:
 *   node scripts/build.js          # 构建当前平台
 *   node scripts/build.js mac      # 构建 macOS DMG
 *   node scripts/build.js win      # 构建 Windows NSIS
 *   node scripts/build.js all      # 构建所有平台
 *   node scripts/build.js --no-clean # 跳过 node_modules 清理
 * 
 * 环境变量:
 *   AINOVEL_BIN=path  指定 ainovel-cli 路径（自动打包进安装包）
 *   GH_TOKEN=xxx      用于上传 release 的 GitHub token
 */

const { execSync } = require('child_process')
const { existsSync, copyFileSync, mkdirSync, readdirSync } = require('fs')
const { join } = require('path')
const os = require('os')

const ROOT = join(__dirname, '..')
const BUILD_DIR = join(ROOT, 'build')
const AINOVEL_BIN_DIR = join(BUILD_DIR, 'ainovel-cli', 'bin')

// 颜色
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

function log(step, msg) {
  console.log(`${CYAN}[${step}]${RESET} ${msg}`)
}

function warn(msg) {
  console.log(`${YELLOW}[WARN]${RESET} ${msg}`)
}

function error(msg) {
  console.log(`${RED}[ERROR]${RESET} ${msg}`)
}

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`)
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts })
}

function buildCliBinary() {
  log('cli', 'Building ainovel-cli from submodule...')
  try {
    execSync('node scripts/build-cli.js', { cwd: ROOT, stdio: 'inherit' })
  } catch {
    warn('ainovel-cli build failed, continuing without bundled CLI')
  }
}

function prepareAinovelBinary() {
  const binEnv = process.env.AINOVEL_BIN
  if (!binEnv) {
    log('bin', 'AINOVEL_BIN not set, skipping bundled ainovel-cli')
    return
  }

  if (!existsSync(binEnv)) {
    warn(`AINOVEL_BIN path not found: ${binEnv}`)
    return
  }

  mkdirSync(AINOVEL_BIN_DIR, { recursive: true })

  const filename = os.platform() === 'win32' ? 'ainovel-cli.exe' : 'ainovel-cli'
  const dest = join(AINOVEL_BIN_DIR, filename)
  copyFileSync(binEnv, dest)

  // macOS/Linux 设置可执行权限
  if (os.platform() !== 'win32') {
    execSync(`chmod +x "${dest}"`)
  }

  log('bin', `Bundled ainovel-cli: ${dest}`)
}

function generateIcons() {
  log('icons', 'Generating application icons...')
  try {
    run('node scripts/generate-icons.js')
  } catch {
    warn('Icon generation failed, continuing with placeholder icons')
  }
}

function cleanNodeModules() {
  if (process.argv.includes('--no-clean')) {
    log('clean', 'Skipping node_modules cleanup (--no-clean flag)')
    return
  }
  log('clean', 'Cleaning node_modules (removing dev files from asar)...')
  try {
    run('node scripts/clean-node-modules.js')
  } catch {
    warn('node_modules cleanup failed, continuing with original node_modules')
  }
}

function buildApp() {
  log('build', 'Building renderer (Vite)...')
  run('npx vite build')

  log('build', 'Building electron main process...')
  run('npx tsc -p electron/tsconfig.json')
}

function distribute(target) {
  const targets = {
    mac: '--mac',
    win: '--win',
    linux: '--linux',
    all: '--mac --win --linux',
  }

  const flag = targets[target]
  if (!flag) {
    error(`Unknown target: ${target}. Available: mac, win, linux, all`)
    process.exit(1)
  }

  log('dist', `Building distribution for ${target}...`)
  run(`npx electron-builder ${flag}`)
}

function main() {
  const target = process.argv[2] || os.platform() === 'win32' ? 'win' : 'mac'

  console.log(`${GREEN}═══════════════════════════════════════${RESET}`)
  console.log(`${GREEN}   AINovel GUI Build Script${RESET}`)
  console.log(`${GREEN}   Target: ${target}${RESET}`)
  console.log(`${GREEN}   Platform: ${os.platform()} ${os.arch()}${RESET}`)
  console.log(`${GREEN}═══════════════════════════════════════${RESET}`)

  generateIcons()
  buildCliBinary()
  prepareAinovelBinary()
  cleanNodeModules()
  buildApp()
  distribute(target)

  // 显示产物
  const releaseDir = join(ROOT, 'release')
  if (existsSync(releaseDir)) {
    console.log(`\n${GREEN}✅ Build complete! Artifacts:${RESET}`)
    for (const file of readdirSync(releaseDir)) {
      const size = execSync(`ls -lh "${join(releaseDir, file)}"`, { encoding: 'utf8' }).split(' ').filter(Boolean).slice(4, 5).join(' ')
      console.log(`  📦 ${file} (${size || '?'})`)
    }
  }
}

main()
