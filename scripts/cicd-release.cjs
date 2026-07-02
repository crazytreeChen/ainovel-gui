#!/usr/bin/env node
/**
 * CI/CD 一键发布脚本
 *
 * 完整流程: bump 版本 → commit → push → build → GitHub Release
 *
 * 用法:
 *   npm run cicd                  # 自动 bump + 全流程发布
 *   npm run cicd:nobump           # 跳过 bump，直接发布当前版本
 *   npm run cicd:major            # 强制 major bump + 发布
 *   npm run cicd:minor            # 强制 minor bump + 发布
 *   npm run cicd:patch            # 强制 patch bump + 发布
 *   npm run cicd:dry              # 干跑预览所有步骤
 *
 * 可选参数:
 *   --skip-mac    跳过 macOS 编译
 *   --skip-win    跳过 Windows 编译
 *   --no-sign     跳过 macOS 代码签名（解决 timestamp 错误）
 *   --dirty       允许工作区有未提交内容
 *   --draft       发布为草稿 Release
 *   --dry-run     预览模式（不实际操作）
 *
 * 前置条件:
 *   - gh CLI 已安装并登录 (brew install gh && gh auth login)
 *   - npm 依赖已安装
 *   - Go >= 1.21
 */

const { execSync } = require('child_process')
const { readFileSync } = require('fs')
const { join } = require('path')

// ===================== 配置 =====================

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
const SKIP_MAC = args.includes('--skip-mac')
const SKIP_WIN = args.includes('--skip-win')
const NO_SIGN = args.includes('--no-sign')
const DIRTY = args.includes('--dirty')
const DRAFT = args.includes('--draft')

// ===================== 工具 =====================

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

function versionFilesChanged() {
  const diff = execSync('git diff --name-only', {
    encoding: 'utf8', cwd: ROOT, stdio: 'pipe',
  }).trim()
  const staged = execSync('git diff --cached --name-only', {
    encoding: 'utf8', cwd: ROOT, stdio: 'pipe',
  }).trim()
  const all = [...diff.split('\n'), ...staged.split('\n')].filter(Boolean)
  const targets = ['package.json', 'download.json', 'electron/ipc/system.ts']
  return targets.some(t => all.some(f => f.endsWith(t)))
}

// ===================== Step 1: 前置检查 =====================

function preflightCheck() {
  header('Step 1/5: 前置检查')

  // gh CLI
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

  // git remote
  try {
    const remote = execSync('git remote get-url origin', {
      encoding: 'utf8', stdio: 'pipe',
    }).trim()
    ok(`git remote: ${remote}`)
  } catch {
    err('未配置 git remote origin')
    process.exit(1)
  }

  // 工作区检查
  if (!DIRTY && hasUncommittedChanges()) {
    warn('工作区有未提交的更改')
    if (versionFilesChanged()) {
      warn('  包含版本文件变更，将继续流程')
    } else {
      warn('  使用 --dirty 跳过此检查，或先提交/暂存更改')
      if (!DRY_RUN) process.exit(1)
    }
  }

  // npm
  try {
    execSync('npm --version', { encoding: 'utf8', stdio: 'pipe' })
    ok('npm 就绪')
  } catch {
    err('npm 不可用')
    process.exit(1)
  }

  console.log('')
}

// ===================== Step 2: Bump 版本号 =====================

function bumpVersion() {
  header('Step 2/5: 版本号迭代')

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

// ===================== Step 3: Git 提交与推送 =====================

function gitCommitAndPush(version) {
  header('Step 3/5: 提交版本变更并推送')

  const files = 'package.json download.json electron/ipc/system.ts'
  const commitMsg = `chore: bump version to ${version}`

  run(`git add ${files}`)
  run(`git commit -m "${commitMsg}"`, { ignoreError: true })

  log(`提交: ${commitMsg}`)

  // 推送到远端
  run('git push')
  ok(`已推送到 origin/master`)
  console.log('')
}

// ===================== Step 4: 编译构建 =====================

function build() {
  header('Step 4/5: 编译构建')

  // 生成图标
  log('生成应用图标...')
  run('node scripts/generate-icons.cjs')

  // 编译前端 + Electron
  log('编译前端与 Electron 主进程...')
  run('npm run build')

  // 清理旧产物
  if (!DRY_RUN) {
    const { existsSync } = require('fs')
    const releaseDir = join(ROOT, 'release')
    if (existsSync(releaseDir)) {
      run('rm -rf release')
    }
  }

  // macOS
  if (!SKIP_MAC) {
    if (NO_SIGN) {
      info('跳过 macOS 代码签名 (--no-sign)')
      process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
    }
    log('打包 macOS (arm64)...')
    run('npx electron-builder --mac', { timeout: 600000 })
    ok('macOS 编译完成')
  } else {
    info('跳过 macOS 编译')
  }

  // Windows
  if (!SKIP_WIN) {
    log('打包 Windows (x64)...')
    run('npx electron-builder --win', { timeout: 1800000 })
    ok('Windows 编译完成')
  } else {
    info('跳过 Windows 编译')
  }

  console.log('')
}

// ===================== Step 5: 发布 GitHub Release =====================

function publishRelease(version) {
  header('Step 5/5: 发布到 GitHub Release')

  const tag = `v${version}`
  const releaseDir = join(ROOT, 'release')
  const { existsSync, readdirSync, statSync } = require('fs')
  const { createHash } = require('crypto')
  const { basename } = require('path')

  // 收集产物
  if (!existsSync(releaseDir)) {
    err('release/ 目录不存在，请检查编译是否成功')
    process.exit(1)
  }

  const artifacts = []
  function scanDir(dir) {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(full)
      } else if (/\.(dmg|zip|exe|AppImage|deb)$/i.test(entry.name)) {
        artifacts.push(full)
      }
    }
  }
  scanDir(releaseDir)

  if (artifacts.length === 0) {
    err('未找到编译产物')
    process.exit(1)
  }

  log('编译产物:')
  const artifactNames = []
  for (const f of artifacts) {
    const name = basename(f)
    const size = statSync(f).size
    const sha = createHash('sha256').update(readFileSync(f)).digest('hex')
    artifactNames.push({ path: f, name, size, sha })
    console.log(`  ${BOLD}${name}${RESET}`)
    console.log(`    ${(size / 1024 / 1024).toFixed(1)} MB · SHA256: ${sha.slice(0, 16)}...`)
  }

  // 更新 download.json
  const downloadPath = join(ROOT, 'download.json')
  const dd = JSON.parse(readFileSync(downloadPath, 'utf8'))
  dd.version = version
  dd.release_date = new Date().toISOString().split('T')[0]

  for (const a of artifactNames) {
    if (a.name.includes('mac-arm64') && a.name.endsWith('.dmg')) {
      dd.downloads['mac-arm64'] = {
        url: `https://github.com/crazytreeChen/ainovel-gui/releases/download/${tag}/${a.name}`,
        size: a.size, sha256: a.sha,
      }
    } else if (a.name.includes('mac-arm64') && a.name.endsWith('.zip')) {
      dd.downloads['mac-arm64-zip'] = {
        url: `https://github.com/crazytreeChen/ainovel-gui/releases/download/${tag}/${a.name}`,
        size: a.size, sha256: a.sha,
      }
    } else if (a.name.includes('win') && a.name.endsWith('.exe')) {
      dd.downloads['win-x64'] = {
        url: `https://github.com/crazytreeChen/ainovel-gui/releases/download/${tag}/${a.name}`,
        size: a.size, sha256: a.sha,
      }
    } else if (a.name.includes('win') && a.name.endsWith('.zip')) {
      dd.downloads['win-x64-zip'] = {
        url: `https://github.com/crazytreeChen/ainovel-gui/releases/download/${tag}/${a.name}`,
        size: a.size, sha256: a.sha,
      }
    }
  }

  if (!DRY_RUN) {
    const { writeFileSync } = require('fs')
    writeFileSync(downloadPath, JSON.stringify(dd, null, 2) + '\n')
    ok('download.json 已更新')
  }

  // 提交 download.json
  if (!DRY_RUN) {
    run(`git add download.json`)
    run(`git commit -m "chore: 更新 download.json for ${tag}"`, { ignoreError: true })
    run('git push')
  }

  // 创建 tag
  let tagExists = false
  try {
    execSync(`git rev-parse ${tag}`, { encoding: 'utf8', stdio: 'pipe' })
    tagExists = true
  } catch { /* 不存在 */ }

  if (!DRY_RUN && !tagExists) {
    log(`创建 tag: ${tag}`)
    run(`git tag -a ${tag} -m "Release ${tag}"`)
    run(`git push origin ${tag}`)
  }

  // 创建 GitHub Release
  const releaseNotes = dd.release_notes
    ? dd.release_notes.replace(/\\n/g, '\n')
    : `## v${version} 更新内容\n\n### 🚀 编译版本\n\n- macOS arm64: DMG + zip\n- Windows x64: NSIS 安装包 + zip`

  const notesFile = join(releaseDir, 'release-notes.md')

  if (!DRY_RUN) {
    const { writeFileSync } = require('fs')
    writeFileSync(notesFile, releaseNotes)

    const filesArg = artifacts.map(p => `"${p}"`).join(' ')
    const draftFlag = DRAFT ? ' --draft' : ''
    const prereleaseFlag = version.includes('-') ? ' --prerelease' : ''

    try {
      run(
        `gh release create ${tag} ${filesArg} ` +
        `--title "AINovel ${tag}" ` +
        `--notes-file "${notesFile}"` +
        `${draftFlag}${prereleaseFlag}`,
        { timeout: 300000 }
      )
      ok(`Release ${tag} 发布成功!`)
      ok(`  ${GREEN}https://github.com/crazytreeChen/ainovel-gui/releases/tag/${tag}${RESET}`)
    } catch (e) {
      err(`Release 创建失败: ${e.message}`)
      err('请手动执行:')
      console.log(`  gh release create ${tag} ${filesArg} --title "AINovel ${tag}" --notes-file release/release-notes.md`)
      process.exit(1)
    }
  } else {
    console.log(`  ${YELLOW}[DRY]${RESET} gh release create ${tag} ...`)
    console.log(`  ${YELLOW}[DRY]${RESET} 上传 ${artifacts.length} 个产物`)
  }

  console.log('')
}

// ===================== 主流程 =====================

async function main() {
  console.log('')
  console.log(`${BOLD}${GREEN}╔═══════════════════════════════════════╗${RESET}`)
  console.log(`${BOLD}${GREEN}║   AINovel GUI  CI/CD 一键发布          ║${RESET}`)
  console.log(`${BOLD}${GREEN}║   bump → commit → push → build → release║${RESET}`)
  console.log(`${BOLD}${GREEN}╚═══════════════════════════════════════╝${RESET}`)
  console.log('')

  if (DRY_RUN) {
    warn('*** DRY RUN 模式 —— 不会执行实际操作 ***')
    console.log('')
  }

  // Step 1: 前置检查
  preflightCheck()

  // Step 2: Bump 版本号
  let version
  if (NO_BUMP) {
    header('Step 2/5: 版本号迭代 (跳过)')
    version = getVersion()
    info(`使用当前版本: ${version}`)
  } else {
    version = bumpVersion()
  }

  // Step 3: Git 提交与推送
  gitCommitAndPush(version)

  // Step 4: 编译构建
  build()

  // Step 5: 发布 GitHub Release
  publishRelease(version)

  // 完成
  header('🎉 CI/CD 发布完成')
  console.log(`  版本:   ${GREEN}v${version}${RESET}`)
  console.log(`  Release: ${GREEN}https://github.com/crazytreeChen/ainovel-gui/releases/tag/v${version}${RESET}`)
  console.log('')

  if (DRY_RUN) {
    warn('以上为 DRY RUN 预览，实际未修改任何内容')
    console.log('')
  }
}

main().catch((e) => {
  err(e.message)
  process.exit(1)
})
