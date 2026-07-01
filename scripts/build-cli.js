#!/usr/bin/env node
/**
 * ainovel-cli 子模块编译脚本
 * 
 * 从 vendor/ainovel-cli/ 编译 Go 二进制到 build/ainovel-cli/bin/
 * 编译完成后尝试 UPX 压缩（需安装 upx），可将 11MB → ~3MB
 * 
 * 用法:
 *   node scripts/build-cli.js          # 编译当前平台
 *   node scripts/build-cli.js --check  # 只检查是否需要编译
 *   node scripts/build-cli.js --no-upx # 编译但不进行 UPX 压缩
 *   node scripts/build-cli.js --only-upx # 只进行 UPX 压缩（已有二进制）
 */

const { execSync } = require('child_process')
const { existsSync, mkdirSync, statSync } = require('fs')
const { join } = require('path')
const os = require('os')

const ROOT = join(__dirname, '..')
const SUBMODULE_DIR = join(ROOT, 'vendor', 'ainovel-cli')
const OUTPUT_DIR = join(ROOT, 'build', 'ainovel-cli', 'bin')
const OUTPUT_BIN = os.platform() === 'win32'
  ? join(OUTPUT_DIR, 'ainovel-cli.exe')
  : join(OUTPUT_DIR, 'ainovel-cli')

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const RESET = '\x1b[0m'

function log(msg) { console.log(`${CYAN}[build-cli]${RESET} ${msg}`) }
function warn(msg) { console.log(`${YELLOW}[build-cli]${RESET} ${msg}`) }
function error(msg) { console.log(`${RED}[build-cli]${RESET} ${msg}`) }

// 检查是否需要编译
function needsBuild() {
  if (process.argv.includes('--check')) {
    if (existsSync(OUTPUT_BIN)) {
      log('ainovel-cli binary already exists: ' + OUTPUT_BIN)
      process.exit(0)
    }
    warn('ainovel-cli binary not found, will build')
    return true
  }
  return true
}

function build() {
  if (!existsSync(SUBMODULE_DIR)) {
    warn('Submodule not found at ' + SUBMODULE_DIR)
    warn('Run: git submodule init && git submodule update')
    warn('Or: git clone --recursive ...')
    return false
  }

  const goBinary = existsSync('/usr/local/go/bin/go') ? '/usr/local/go/bin/go' : 'go'

  // 检查 Go 是否安装
  try {
    const version = execSync(`${goBinary} version 2>&1`, { encoding: 'utf8' }).trim()
    log('Go: ' + version)
  } catch {
    error('Go is not installed. Please install Go >= 1.21')
    error('  brew install go')
    return false
  }

  // 确保输出目录
  mkdirSync(OUTPUT_DIR, { recursive: true })

  // 编译
  const srcDir = join(SUBMODULE_DIR, 'cmd', 'ainovel-cli')
  if (!existsSync(srcDir)) {
    error('Source not found: ' + srcDir)
    return false
  }

  log('Building ainovel-cli from submodule...')

  const outputFlag = os.platform() === 'win32'
    ? `-o "${OUTPUT_BIN}"`
    : `-o '${OUTPUT_BIN}'`

  try {
    execSync(
      `cd '${SUBMODULE_DIR}' && ${goBinary} build -ldflags="-s -w" ${outputFlag} ./cmd/ainovel-cli/`,
      { stdio: 'inherit', timeout: 120000 }
    )

    // 设置执行权限
    if (os.platform() !== 'win32') {
      execSync(`chmod +x '${OUTPUT_BIN}'`)
    }

    const stats = require('fs').statSync(OUTPUT_BIN)
    log(`${GREEN}✅ Built: ${OUTPUT_BIN} (${(stats.size / 1024 / 1024).toFixed(1)} MB)${RESET}`)
    return true
  } catch (e) {
    error('Build failed: ' + e.message)
    return false
  }
}

function upxCompress() {
  if (process.argv.includes('--no-upx')) {
    log('Skipping UPX compression (--no-upx flag)')
    return true
  }
  if (!existsSync(OUTPUT_BIN)) {
    warn('Binary not found, skipping UPX: ' + OUTPUT_BIN)
    return false
  }
  // 检查 UPX 是否可用
  let hasUPX = false
  try {
    execSync('upx --version 2>&1', { encoding: 'utf8' })
    hasUPX = true
  } catch { try {
    execSync('/usr/local/bin/upx --version 2>&1', { encoding: 'utf8' })
    hasUPX = true
  } catch {} }

  if (!hasUPX) {
    warn('UPX not found (install with: brew install upx). Skipping compression.')
    warn('  Binary size: ' + (statSync(OUTPUT_BIN).size / 1024 / 1024).toFixed(1) + ' MB (uncompressed)')
    return true
  }

  const beforeSize = statSync(OUTPUT_BIN).size
  log('Compressing with UPX...')
  try {
    execSync(`upx --best --no-color '${OUTPUT_BIN}'`, { stdio: 'inherit', timeout: 120000 })
    const afterSize = statSync(OUTPUT_BIN).size
    const saved = ((beforeSize - afterSize) / 1024 / 1024).toFixed(1)
    log(`${GREEN}✅ UPX compressed: ${(beforeSize / 1024 / 1024).toFixed(1)} MB → ${(afterSize / 1024 / 1024).toFixed(1)} MB (saved ${saved} MB)${RESET}`)
    return true
  } catch (e) {
    warn('UPX compression failed: ' + e.message)
    warn('  Binary remains uncompressed at ' + OUTPUT_BIN)
    return false
  }
}

function main() {
  // --only-upx 模式：只压缩已有二进制
  if (process.argv.includes('--only-upx')) {
    console.log(`${GREEN}═══════════════════════════════════════${RESET}`)
    console.log(`${GREEN}   UPX Compression Only${RESET}`)
    console.log(`${GREEN}═══════════════════════════════════════${RESET}`)
    upxCompress()
    return
  }

  if (!needsBuild()) return

  console.log(`${GREEN}═══════════════════════════════════════${RESET}`)
  console.log(`${GREEN}   ainovel-cli Submodule Build${RESET}`)
  console.log(`${GREEN}   Platform: ${os.platform()} ${os.arch()}${RESET}`)
  console.log(`${GREEN}═══════════════════════════════════════${RESET}`)

  const ok = build()
  if (!ok) {
    process.exit(1)
    return
  }

  upxCompress()
  process.exit(0)
}

main()
