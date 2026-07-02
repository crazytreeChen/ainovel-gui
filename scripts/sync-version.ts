#!/usr/bin/env node
/**
 * 版本号同步脚本
 *
 * 用法:
 *   npx tsx scripts/sync-version.ts
 *
 * 功能:
 *   1. 读取 package.json 中的 version 字段 (作为唯一源)
 *   2. 将 download.json 的 version 同步为该版本
 *   3. 将 download.json 的 release_date 更新为当天 (YYYY-MM-DD)
 *   4. 将 electron/ipc/system.ts 中 const APP_VERSION 同步为该版本
 *   5. 回写所有发生变更的文件
 *
 * 约束:
 *   - 不修改 package.json 本身 (package.json 为版本号源)
 *   - 仅在目标文件实际值与期望值不一致时写入 (幂等)
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ===================== 路径 =====================

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = join(__dirname, '..')

const PACKAGE_JSON = join(ROOT, 'package.json')
const DOWNLOAD_JSON = join(ROOT, 'download.json')
const SYSTEM_TS = join(ROOT, 'electron', 'ipc', 'system.ts')

// ===================== 控制台 =====================

const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'

function log(msg: string): void {
  console.log(`${CYAN}[sync-version]${RESET} ${msg}`)
}
function ok(msg: string): void {
  console.log(`${GREEN}[sync-version] ✅ ${msg}${RESET}`)
}
function warn(msg: string): void {
  console.log(`${YELLOW}[sync-version] ⚠️  ${msg}${RESET}`)
}
function err(msg: string): void {
  console.log(`${RED}[sync-version] ❌ ${msg}${RESET}`)
}

// ===================== 工具 =====================

function getTodayDate(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function readPackageVersion(): string {
  const raw = readFileSync(PACKAGE_JSON, 'utf8')
  const pkg = JSON.parse(raw) as { version?: string }
  if (!pkg.version || typeof pkg.version !== 'string') {
    throw new Error('package.json 缺少有效的 version 字段')
  }
  return pkg.version
}

// ===================== download.json =====================

interface DownloadJson {
  version: string
  release_date: string
  release_notes?: string
  downloads?: Record<string, unknown>
  [key: string]: unknown
}

interface SyncResult<T> {
  changed: boolean
  prev: T
}

function syncDownloadJson(version: string, today: string): SyncResult<DownloadJson> {
  const raw = readFileSync(DOWNLOAD_JSON, 'utf8')
  const data = JSON.parse(raw) as DownloadJson
  const prev: DownloadJson = JSON.parse(JSON.stringify(data))
  let changed = false

  if (data.version !== version) {
    log(`download.json.version: ${prev.version} → ${version}`)
    data.version = version
    changed = true
  } else {
    log(`download.json.version: ${version} (无变化)`)
  }

  if (data.release_date !== today) {
    log(`download.json.release_date: ${prev.release_date} → ${today}`)
    data.release_date = today
    changed = true
  } else {
    log(`download.json.release_date: ${today} (无变化)`)
  }

  if (changed) {
    writeFileSync(DOWNLOAD_JSON, JSON.stringify(data, null, 2) + '\n')
  }
  return { changed, prev }
}

// ===================== electron/ipc/system.ts =====================

const APP_VERSION_RE = /^([ \t]*const\s+APP_VERSION\s*=\s*['"])([^'"]+)(['"][ \t]*;?[ \t]*)$/m

function syncSystemTs(version: string): SyncResult<string> {
  const raw = readFileSync(SYSTEM_TS, 'utf8')
  const match = APP_VERSION_RE.exec(raw)
  if (!match) {
    throw new Error('未能在 electron/ipc/system.ts 中找到 const APP_VERSION 定义')
  }
  const prev = match[2]
  if (prev === version) {
    log(`system.ts APP_VERSION: ${version} (无变化)`)
    return { changed: false, prev }
  }
  log(`system.ts APP_VERSION: ${prev} → ${version}`)
  const next = raw.replace(APP_VERSION_RE, `$1${version}$3`)
  writeFileSync(SYSTEM_TS, next)
  return { changed: true, prev }
}

// ===================== 主流程 =====================

function main(): void {
  const version = readPackageVersion()
  const today = getTodayDate()

  console.log('')
  console.log(`${BOLD}${GREEN}═══ 版本号同步 ═══${RESET}`)
  console.log(`  源版本 (package.json): ${BOLD}${version}${RESET}`)
  console.log(`  当天日期:             ${today}`)
  console.log('')

  const dl = syncDownloadJson(version, today)
  const sys = syncSystemTs(version)

  console.log('')
  if (dl.changed || sys.changed) {
    ok('同步完成')
    if (dl.changed) ok('  → download.json')
    if (sys.changed) ok('  → electron/ipc/system.ts')
  } else {
    ok('所有目标文件已是最新版本，无需修改')
  }
  console.log('')
}

try {
  main()
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  err(msg)
  process.exit(1)
}
