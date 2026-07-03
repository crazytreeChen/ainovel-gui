#!/usr/bin/env node
/**
 * CI/CD 本地发布脚本（GitHub Actions 模式）
 *
 * 流程: bump 版本 → commit → tag → push
 * 构建和 GitHub Release 由 GitHub Actions 在 push tag 后自动完成
 *
 * 用法:
 *   npm run cicd                  # 自动 bump + push tag
 *   npm run cicd:nobump           # 跳过 bump，使用当前版本
 *   npm run cicd:major/minor/patch # 强制指定 bump 级别
 *   npm run cicd:dry              # 干跑预览
 *
 * 前置条件:
 *   - gh CLI 已安装并登录 (brew install gh && gh auth login)
 */

const { execSync } = require('child_process')
const { readFileSync } = require('fs')
const { join } = require('path')

const ROOT = join(__dirname, '..')
const PACKAGE_JSON = join(ROOT, 'package.json')

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const BLUE = '\x1b[34m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function log(msg) { console.log(`${CYAN}[cicd]${RESET} ${msg}`) }
function ok(msg) { console.log(`${GREEN}[cicd] ✅ ${msg}${RESET}`) }
function warn(msg) { console.log(`${YELLOW}[cicd] ⚠️  ${msg}${RESET}`) }
function err(msg) { console.log(`${RED}[cicd] ❌ ${msg}${RESET}`) }
function info(msg) { console.log(`${BLUE}[cicd] ℹ️  ${msg}${RESET}`) }
function header(msg) {
  console.log('')
  console.log(`${BOLD}${GREEN}═══════════════════════════════════════${RESET}`)
  console.log(`${BOLD}${GREEN}  ${msg}${RESET}`)
  console.log(`${BOLD}${GREEN}═══════════════════════════════════════${RESET}`)
  console.log('')
}

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const NO_BUMP = args.includes('--no-bump')
const FORCE_MAJOR = args.includes('--major')
const FORCE_MINOR = args.includes('--minor')
const FORCE_PATCH = args.includes('--patch')
const DRAFT = args.includes('--draft')

function getVersion() {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'))
  return pkg.version
}

function run(cmd, opts = {}) {
  if (DRY_RUN) {
    console.log(`  ${YELLOW}[DRY]${RESET} ${cmd}`)
    return ''
  }
  try {
    return execSync(cmd, {
      cwd: ROOT,
      stdio: opts.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      timeout: opts.timeout || 120000,
    })
  } catch (e) {
    if (opts.ignoreError) {
      warn(`命令失败(已忽略): ${cmd}`)
      return ''
    }
    throw e
  }
}

function hasUncommittedChanges() {
  const status = execSync('git status --porcelain', {
    encoding: 'utf8', cwd: ROOT, stdio: 'pipe',
  }).trim()
  return status.length > 0
}

function preflightCheck() {
  header('Step 1/4: 前置检查')

  try {
    const ghVer = execSync('gh --version 2>&1 | head -1', {
      encoding: 'utf8', stdio: 'pipe',
    }).trim()
    ok(`gh CLI: ${ghVer}`)
  } catch {
    err('gh CLI 未安装或未登录')
    err('  安装: brew install gh')
    err('  登录: gh auth login')
    process.exit(1)
  }

  try {
    const remote = execSync('git remote get-url origin', {
      encoding: 'utf8', cwd: ROOT, stdio: 'pipe',
    }).trim()
    ok(`git remote: ${remote}`)
  } catch {
    err('未配置 git remote origin')
    process.exit(1)
  }

  if (!DRY_RUN && hasUncommittedChanges()) {
    warn('工作区有未提交的更改')
    warn('  请先提交/暂存，或确认继续')
  }

  ok('前置检查通过')
}

function bumpVersion() {
  header('Step 2/4: 版本号迭代')

  const bumpArgs = []
  if (FORCE_MAJOR) bumpArgs.push('--major')
  if (FORCE_MINOR) bumpArgs.push('--minor')
  if (FORCE_PATCH) bumpArgs.push('--patch')
  if (DRY_RUN) bumpArgs.push('--dry-run')

  const cmd = `node scripts/bump-version.cjs ${bumpArgs.join(' ')}`
  try {
    run(cmd)
  } catch (e) {
    err(`版本 bump 失败: ${e.message}`)
    process.exit(1)
  }

  return getVersion()
}

function commitAndTag(version) {
  header('Step 3/4: 提交变更并创建 Tag')

  const files = 'package.json download.json electron/ipc/system.ts'
  const commitMsg = `chore: bump version to ${version}`

  run(`git add ${files}`)
  run(`git commit -m "${commitMsg}"`, { ignoreError: true })
  ok(`已提交: ${commitMsg}`)

  const tag = `v${version}`
  const tagExists = execSync(`git tag -l ${tag}`, {
    encoding: 'utf8', cwd: ROOT, stdio: 'pipe',
  }).trim()

  if (tagExists) {
    warn(`Tag ${tag} 已存在，跳过创建`)
  } else {
    run(`git tag -a ${tag} -m "Release ${tag}"`)
    ok(`已创建 tag: ${tag}`)
  }
}

function pushToRemote() {
  header('Step 4/4: 推送到远程')

  run('git push')
  ok('已推送 commits')

  const version = getVersion()
  const tag = `v${version}`
  const tagExists = execSync(`git tag -l ${tag}`, {
    encoding: 'utf8', cwd: ROOT, stdio: 'pipe',
  }).trim()

  if (tagExists) {
    run(`git push origin ${tag}`)
    ok(`已推送 tag: ${tag}`)
  }

  console.log('')
  info('GitHub Actions 将自动完成构建和 Release 发布')
  info(`  查看进度: https://github.com/crazytreeChen/ainovel-gui/actions`)
}

async function main() {
  console.log('')
  console.log(`${BOLD}${GREEN}╔═══════════════════════════════════════╗${RESET}`)
  console.log(`${BOLD}${GREEN}║   AINovel GUI  CI/CD (GitHub Actions) ║${RESET}`)
  console.log(`${BOLD}${GREEN}║   bump → commit → tag → push         ║${RESET}`)
  console.log(`${BOLD}${GREEN}╚═══════════════════════════════════════╝${RESET}`)
  console.log('')

  if (DRY_RUN) {
    warn('*** DRY RUN 模式 —— 不会执行实际操作 ***')
    console.log('')
  }

  preflightCheck()

  const version = NO_BUMP ? getVersion() : bumpVersion()

  commitAndTag(version)
  pushToRemote()

  header('🎉 CI/CD 触发完成')
  console.log(`  版本:   ${GREEN}v${version}${RESET}`)
  console.log(`  Tag:    ${GREEN}https://github.com/crazytreeChen/ainovel-gui/releases/tag/v${version}${RESET}`)
  console.log(`  Actions: ${BLUE}https://github.com/crazytreeChen/ainovel-gui/actions${RESET}`)
  console.log('')
}

main().catch((e) => {
  err(e.message)
  process.exit(1)
})
