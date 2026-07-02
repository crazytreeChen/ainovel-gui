#!/usr/bin/env node
/**
 * 版本号自动迭代脚本
 *
 * 用法:
 *   node scripts/bump-version.cjs              # 根据 commit 自动判断 bump 类型
 *   node scripts/bump-version.cjs --major      # 强制主版本号 +1
 *   node scripts/bump-version.cjs --minor      # 强制次版本号 +1
 *   node scripts/bump-version.cjs --patch      # 强制修订号 +1
 *   node scripts/bump-version.cjs --dry-run    # 干跑，显示会怎样 bump 但不修改
 *
 * 自动判断规则（基于 conventional commits）：
 *   BREAKING CHANGE / feat! → major
 *   feat → minor
 *   fix / perf / refactor → patch
 *   docs / chore / test / style / ci / types / build → 不触发 bump
 *
 * 执行后自动同步版本号到 download.json 和 electron/ipc/system.ts
 */

const { execSync } = require('child_process')
const { readFileSync, writeFileSync } = require('fs')
const { join } = require('path')

// ===================== 配置 =====================

const ROOT = join(__dirname, '..')
const PACKAGE_JSON = join(ROOT, 'package.json')

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function log(msg) { console.log(`${CYAN}[bump]${RESET} ${msg}`) }
function ok(msg) { console.log(`${GREEN}[bump] ✅ ${msg}${RESET}`) }
function warn(msg) { console.log(`${YELLOW}[bump] ⚠️  ${msg}${RESET}`) }
function err(msg) { console.log(`${RED}[bump] ❌ ${msg}${RESET}`) }

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const FORCE_MAJOR = args.includes('--major')
const FORCE_MINOR = args.includes('--minor')
const FORCE_PATCH = args.includes('--patch')

// ===================== 工具函数 =====================

function getCurrentVersion() {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'))
  return pkg.version
}

function getLatestTag() {
  try {
    return execSync('git describe --tags --abbrev=0 2>/dev/null', {
      encoding: 'utf8',
      cwd: ROOT,
      stdio: 'pipe',
    }).trim()
  } catch {
    return null
  }
}

/**
 * 获取自上次 tag 以来（或所有历史）的 commits
 */
function getCommitsSince(tag) {
  let range
  if (tag) {
    range = `${tag}..HEAD`
  } else {
    range = 'HEAD'
  }
  const output = execSync(
    `git log ${range} --pretty=format:"%s%n%b---COMMIT_END---"`,
    { encoding: 'utf8', cwd: ROOT, stdio: 'pipe', maxBuffer: 1024 * 1024 }
  )
  return output
    .split('---COMMIT_END---')
    .map(c => c.trim())
    .filter(c => c.length > 0)
}

/**
 * 分析单条 commit 的 bump 级别
 * 返回: 'major' | 'minor' | 'patch' | null
 */
function analyzeCommit(commitText) {
  const lines = commitText.split('\n')
  const header = lines[0]
  const body = lines.slice(1).join('\n')

  // BREAKING CHANGE 在 body 或 footer 中
  if (/BREAKING[-\s]CHANGE/i.test(body)) {
    return 'major'
  }

  // ! 在 type/scope 后面: feat!:
  if (/^\w+!:/.test(header)) {
    return 'major'
  }

  // feat: → minor
  if (/^feat(\(.+\))?:/.test(header)) {
    return 'minor'
  }

  // fix / perf / refactor → patch
  if (/^(fix|perf|refactor)(\(.+\))?:/.test(header)) {
    return 'patch'
  }

  // docs / chore / test / style / ci / types / build → 不触发
  return null
}

/**
 * 计算最终的 bump 级别
 * 取所有 commit 中最高级别: major > minor > patch > none
 */
function determineBumpLevel(commits) {
  if (commits.length === 0) return null

  let level = null
  const counts = { major: 0, minor: 0, patch: 0 }

  for (const c of commits) {
    const l = analyzeCommit(c)
    if (l === 'major') {
      counts.major++
      level = 'major'
    } else if (l === 'minor' && level !== 'major') {
      counts.minor++
      level = 'minor'
    } else if (l === 'patch' && level === null) {
      counts.patch++
      level = 'patch'
    }
  }

  return { level, counts }
}

function bumpVersion(version, level) {
  const parts = version.split('.').map(Number)
  switch (level) {
    case 'major':
      parts[0]++
      parts[1] = 0
      parts[2] = 0
      break
    case 'minor':
      parts[1]++
      parts[2] = 0
      break
    case 'patch':
      parts[2]++
      break
  }
  return parts.join('.')
}

function updatePackageJson(newVersion) {
  const raw = readFileSync(PACKAGE_JSON, 'utf8')
  const pkg = JSON.parse(raw)
  const oldVersion = pkg.version
  pkg.version = newVersion

  if (!DRY_RUN) {
    writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n')
  }

  return oldVersion
}

function syncVersion() {
  // 调用 sync-version.ts 同步版本号到其他文件
  try {
    const cmd = 'npx tsx scripts/sync-version.ts'
    if (DRY_RUN) {
      log(`[DRY] ${cmd}`)
      return
    }
    execSync(cmd, { encoding: 'utf8', cwd: ROOT, stdio: 'inherit' })
  } catch (e) {
    err(`版本同步失败: ${e.message}`)
    process.exit(1)
  }
}

// ===================== 主流程 =====================

function main() {
  const currentVersion = getCurrentVersion()
  const tag = getLatestTag()
  const commits = getCommitsSince(tag)

  // 确定 bump 级别
  let bumpLevel
  let reason

  if (FORCE_MAJOR) {
    bumpLevel = 'major'
    reason = '--major 强制指定'
  } else if (FORCE_MINOR) {
    bumpLevel = 'minor'
    reason = '--minor 强制指定'
  } else if (FORCE_PATCH) {
    bumpLevel = 'patch'
    reason = '--patch 强制指定'
  } else {
    const result = determineBumpLevel(commits)
    bumpLevel = result?.level
    if (bumpLevel) {
      reason = [
        result.counts.major > 0 && `${result.counts.major} 个 BREAKING CHANGE`,
        result.counts.minor > 0 && `${result.counts.minor} 个 feat`,
        result.counts.patch > 0 && `${result.counts.patch} 个 fix/perf/refactor`,
      ]
        .filter(Boolean)
        .join(', ')
    }
  }

  // 打印报告
  console.log('')
  console.log(`${BOLD}${GREEN}═══ 版本号自动迭代 ═══${RESET}`)
  console.log(`  当前版本:  ${BOLD}${currentVersion}${RESET}`)
  console.log(`  对比基准:  ${tag || '(无 tag，分析所有提交)'}`)
  console.log(`  提交数:    ${commits.length}`)
  console.log('')

  if (!bumpLevel) {
    warn('未检测到需要 bump 版本的变更（无 feat/fix/refactor/perf/BREAKING CHANGE）')
    if (commits.length > 0) {
      warn(`  ${commits.length} 个提交均为 docs/chore/test/style/ci/types/build 类型，跳过`)
    }
    console.log('')
    return
  }

  const newVersion = bumpVersion(currentVersion, bumpLevel)

  console.log(`  Bump 级别: ${BOLD}${bumpLevel.toUpperCase()}${RESET}`)
  console.log(`  判定依据:  ${reason}`)
  console.log(`  新版本号:  ${GREEN}${BOLD}${currentVersion} → ${newVersion}${RESET}`)
  console.log('')

  if (DRY_RUN) {
    warn('*** DRY RUN 模式 - 不会修改任何文件 ***')
    warn(`  将会: package.json version → ${newVersion}`)
    warn('  将会: 同步 download.json / electron/ipc/system.ts')
    console.log('')
    return
  }

  // 更新 package.json
  const oldVersion = updatePackageJson(newVersion)
  ok(`package.json: ${oldVersion} → ${newVersion}`)

  // 同步版本号
  syncVersion()
  ok(`版本号已同步到 download.json / electron/ipc/system.ts`)

  console.log('')
  console.log(`${GREEN}${BOLD}✅ 版本号迭代完成${RESET}`)
  console.log(`  接下来可以提交并发布:`)
  console.log(`    git add package.json download.json electron/ipc/system.ts`)
  console.log(`    git commit -m "chore: bump version to ${newVersion}"`)
  console.log(`    git tag v${newVersion}`)
  console.log(`    npm run release`)
  console.log('')
}

main()
