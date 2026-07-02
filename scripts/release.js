#!/usr/bin/env node
/**
 * 一键编译 + 发布到 GitHub Release 脚本
 *
 * 用法:
 *   node scripts/release.js              # 编译 mac + win，并发布 Release
 *   node scripts/release.js --build-only # 仅编译，不发布
 *   node scripts/release.js --dry-run    # 干跑，显示会做什么但不执行
 *   node scripts/release.js --skip-mac   # 跳过 macOS 编译
 *   node scripts/release.js --skip-win   # 跳过 Windows 编译
 *   node scripts/release.js --skip-build # 跳过编译，直接发布已有产物
 *
 * 前置条件:
 *   - git (已配置 remote origin)
 *   - gh CLI 并已登录 (brew install gh && gh auth login)
 *   - Node.js >= 18
 *   - Go >= 1.21 (用于编译 ainovel-cli)
 *
 * 产物目录: release/
 *    macOS:  AINovel-{version}-mac-arm64.dmg / .zip
 *    Windows: AINovel-{version}-win-x64.exe / .zip
 */

const { execSync } = require('child_process')
const { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } = require('fs')
const { createHash } = require('crypto')
const { join, basename } = require('path')
const os = require('os')

// ===================== 配置 =====================

const ROOT = join(__dirname, '..')
const RELEASE_DIR = join(ROOT, 'release')
const DOWNLOAD_JSON = join(ROOT, 'download.json')
const PACKAGE_JSON = join(ROOT, 'package.json')

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN = '\x1b[36m'
const BLUE = '\x1b[34m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const BUILD_ONLY = args.includes('--build-only')
const SKIP_MAC = args.includes('--skip-mac')
const SKIP_WIN = args.includes('--skip-win')
const SKIP_BUILD = args.includes('--skip-build')
const DIRTY = args.includes('--dirty')

// ===================== 工具函数 =====================

function log(msg) { console.log(`${CYAN}[release]${RESET} ${msg}`) }
function ok(msg) { console.log(`${GREEN}[release] ✅ ${msg}${RESET}`) }
function warn(msg) { console.log(`${YELLOW}[release] ⚠️  ${msg}${RESET}`) }
function err(msg) { console.log(`${RED}[release] ❌ ${msg}${RESET}`) }
function info(msg) { console.log(`${BLUE}[release] ℹ️  ${msg}${RESET}`) }
function header(msg) {
  console.log('')
  console.log(`${BOLD}${GREEN}═══════════════════════════════════════${RESET}`)
  console.log(`${BOLD}${GREEN}   ${msg}${RESET}`)
  console.log(`${BOLD}${GREEN}═══════════════════════════════════════${RESET}`)
  console.log('')
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
      ...opts,
    })
  } catch (e) {
    if (!opts.ignoreError) throw e
    warn(`Command failed (ignored): ${cmd}`)
    return ''
  }
}

function sha256File(filePath) {
  const hash = createHash('sha256')
  hash.update(readFileSync(filePath))
  return hash.digest('hex')
}

function getVersion() {
  const { version } = JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'))
  return version
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ===================== 前置检查 =====================

function checkPrerequisites() {
  header('前置检查')

  // 检查 gh CLI
  if (!DRY_RUN && !BUILD_ONLY) {
    try {
      const ghVer = execSync('gh --version 2>&1 | head -1', { encoding: 'utf8' }).trim()
      ok(`gh CLI: ${ghVer}`)
    } catch {
      err('gh CLI 未安装或未登录')
      err('  brew install gh')
      err('  gh auth login')
      if (!process.env.GITHUB_TOKEN) {
        err('  或设置环境变量: export GITHUB_TOKEN=ghp_xxxx')
      }
    }
  }

  // 检查 Go
  try {
    execSync('go version', { stdio: 'pipe', encoding: 'utf8' })
    ok('Go 已安装')
  } catch {
    err('Go 未安装: brew install go')
    process.exit(1)
  }

  // 检查是否有未提交的更改
  if (!DRY_RUN) {
    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim()
    if (status && !args.includes('--dirty')) {
      warn('工作区有未提交的更改，建议先 commit')
      warn('  使用 --dirty 跳过此检查')
    }
  }

  console.log('')
}

// ===================== 编译 =====================

async function buildAll() {
  header('编译项目')

  // Step 1: 生成图标
  log('生成应用图标...')
  run('node scripts/generate-icons.js')

  // Step 2: 编译前端 + Electron
  log('编译前端与 Electron...')
  run('npm run build')

  // Step 3: 清理旧产物
  log('清理旧产物...')
  if (!DRY_RUN && existsSync(RELEASE_DIR)) {
    run('rm -rf release')
  }

  // Step 4: 编译 macOS
  if (!SKIP_MAC) {
    header('编译 macOS (arm64)')
    log('正在打包 macOS DMG + zip...')
    run('npx electron-builder --mac', { timeout: 600000 })
    ok('macOS 编译完成')
  } else {
    info('跳过 macOS 编译 (--skip-mac)')
  }

  // Step 5: 编译 Windows
  if (!SKIP_WIN) {
    header('编译 Windows (x64)')
    log('正在打包 Windows NSIS + zip...')
    run('npx electron-builder --win', { timeout: 1800000 })
    ok('Windows 编译完成')
  } else {
    info('跳过 Windows 编译 (--skip-win)')
  }
}

// ===================== 收集产物 =====================

function collectArtifacts() {
  header('收集编译产物')

  if (!existsSync(RELEASE_DIR)) {
    err('release/ 目录不存在，编译可能失败')
    return []
  }

  const version = getVersion()
  const artifacts = []

  // 扫描 release 目录下的所有文件
  const { readdirSync } = require('fs')
  const allFiles = []

  function scanDir(dir, prefix = '') {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        scanDir(fullPath, relPath)
      } else {
        // 只收集安装包文件
        if (/\.(dmg|zip|exe|AppImage|deb)$/i.test(entry.name)) {
          allFiles.push(fullPath)
        }
      }
    }
  }

  scanDir(RELEASE_DIR)

  for (const filePath of allFiles) {
    const name = basename(filePath)
    const size = statSync(filePath).size
    const sha256 = sha256File(filePath)

    artifacts.push({ name, path: filePath, size, sha256 })

    console.log(`  ${BOLD}${name}${RESET}`)
    console.log(`    Size:   ${formatSize(size)}`)
    console.log(`    SHA256: ${sha256}`)
    console.log('')
  }

  return artifacts
}

// ===================== 更新 download.json =====================

function updateDownloadJson(artifacts) {
  const version = getVersion()
  const downloadData = JSON.parse(readFileSync(DOWNLOAD_JSON, 'utf8'))

  downloadData.version = version

  // 映射产物到 download.json 的 downloads 字段
  for (const art of artifacts) {
    const name = art.name

    if (name.includes('mac-arm64') && name.endsWith('.dmg')) {
      downloadData.downloads['mac-arm64'] = {
        url: `https://github.com/crazytreeChen/ainovel-gui/releases/download/v${version}/${name}`,
        size: art.size,
        sha256: art.sha256,
      }
    } else if (name.includes('mac-arm64') && name.endsWith('.zip')) {
      downloadData.downloads['mac-arm64-zip'] = {
        url: `https://github.com/crazytreeChen/ainovel-gui/releases/download/v${version}/${name}`,
        size: art.size,
        sha256: art.sha256,
      }
    } else if (name.includes('win') && name.endsWith('.exe')) {
      downloadData.downloads['win-x64'] = {
        url: `https://github.com/crazytreeChen/ainovel-gui/releases/download/v${version}/${name}`,
        size: art.size,
        sha256: art.sha256,
      }
    } else if (name.includes('win') && name.endsWith('.zip')) {
      downloadData.downloads['win-x64-zip'] = {
        url: `https://github.com/crazytreeChen/ainovel-gui/releases/download/v${version}/${name}`,
        size: art.size,
        sha256: art.sha256,
      }
    }
  }

  if (!DRY_RUN) {
    writeFileSync(DOWNLOAD_JSON, JSON.stringify(downloadData, null, 2) + '\n')
    ok('download.json 已更新')
  }
}

// ===================== 发布到 GitHub Release =====================

function publishRelease(artifacts) {
  if (BUILD_ONLY) {
    info('仅编译模式，跳过发布 (--build-only)')
    return
  }

  header('发布到 GitHub Release')

  const version = getVersion()
  const tag = `v${version}`

  // 检查 tag 是否存在
  let tagExists = false
  try {
    execSync(`git rev-parse ${tag}`, { encoding: 'utf8', stdio: 'pipe' })
    tagExists = true
  } catch {
    // tag 不存在
  }

  // 读取 release notes
  let notes = ''
  const releaseDate = new Date().toISOString().split('T')[0]

  if (existsSync(DOWNLOAD_JSON)) {
    const dd = JSON.parse(readFileSync(DOWNLOAD_JSON, 'utf8'))
    if (dd.release_notes) {
      notes = dd.release_notes.replace(/\\n/g, '\n')
    }
  }

  if (!notes) {
    notes = `## v${version} 更新内容\n\n### 🚀 编译版本\n\n- macOS arm64: DMG + zip\n- Windows x64: NSIS 安装包 + zip\n\n> 由 \`scripts/release.js\` 一键发布 ${releaseDate}`
  }

  // 收集产物文件路径
  const artifactPaths = artifacts.map(a => a.path)

  // 检查是否是草稿发布模式
  const draftFlag = args.includes('--draft') ? ' --draft' : ''
  const prereleaseFlag = version.includes('-') ? ' --prerelease' : ''

  if (!DRY_RUN) {
    // 先 commit 并推送 download.json（如果有更新）
    try {
      const ds = execSync('git diff --name-only', { encoding: 'utf8' }).trim()
      if (ds.includes('download.json')) {
        log('提交 download.json 更新...')
        run('git add download.json')
        run(`git commit -m "chore: 更新 download.json for v${version}"`)
        run('git push')
      }
    } catch {
      // 可能没有变更
    }

    // 确保 tag 存在
    if (!tagExists) {
      log(`创建 tag: ${tag}`)
      run(`git tag -a ${tag} -m "Release ${tag}"`)
      run(`git push origin ${tag}`)
    }

    // 创建 Release 并上传
    log(`创建 GitHub Release: ${tag}`)
    const notesFile = join(RELEASE_DIR, 'release-notes.md')
    writeFileSync(notesFile, notes)

    const filesArg = artifactPaths.map(p => `"${p}"`).join(' ')

    try {
      run(
        `gh release create ${tag} ${filesArg} ` +
        `--title "AINovel ${tag}" ` +
        `--notes-file "${notesFile}" ` +
        `${draftFlag}${prereleaseFlag}`,
        { timeout: 300000 }
      )
      ok(`Release ${tag} 发布成功!`)
      ok(`  ${GREEN}https://github.com/crazytreeChen/ainovel-gui/releases/tag/${tag}${RESET}`)
    } catch (e) {
      err(`发布失败: ${e.message}`)
      err('请手动执行:')
      console.log(`  gh release create ${tag} ${filesArg} --title "AINovel ${tag}" --notes-file release/release-notes.md`)
    }
  } else {
    console.log(`  ${YELLOW}[DRY]${RESET} 将创建 Release: ${tag}`)
    console.log(`  ${YELLOW}[DRY]${RESET} 上传文件: ${artifactPaths.join(', ')}`)
  }
}

// ===================== 主流程 =====================

async function main() {
  const version = getVersion()
  const platform = `${os.platform()} ${os.arch()}`

  console.log('')
  console.log(`${BOLD}${GREEN}╔═══════════════════════════════════════╗${RESET}`)
  console.log(`${BOLD}${GREEN}║   AINovel GUI 一键编译发布脚本        ║${RESET}`)
  console.log(`${BOLD}${GREEN}║   Version: ${version.padEnd(26)} ║${RESET}`)
  console.log(`${BOLD}${GREEN}║   Platform: ${platform.padEnd(24)} ║${RESET}`)
  console.log(`${BOLD}${GREEN}╚═══════════════════════════════════════╝${RESET}`)
  console.log('')

  if (DRY_RUN) {
    warn('*** DRY RUN 模式 - 不会执行实际操作 ***')
    console.log('')
  }

  if (SKIP_BUILD) {
    info('跳过编译步骤 (--skip-build)，直接使用 release/ 目录已有产物')
  }

  // 1. 前置检查
  if (!SKIP_BUILD) {
    checkPrerequisites()
  }

  // 2. 编译
  if (!SKIP_BUILD) {
    await buildAll()
  }

  // 3. 收集产物
  const artifacts = collectArtifacts()

  if (artifacts.length === 0) {
    err('没有找到编译产物，请检查编译是否成功')
    process.exit(1)
  }

  // 4. 更新 download.json
  updateDownloadJson(artifacts)

  // 5. 发布到 GitHub Release
  publishRelease(artifacts)

  // 总结
  header('发布完成')
  console.log(`  版本:  ${GREEN}v${version}${RESET}`)
  console.log(`  产物:  release/`)
  for (const art of artifacts) {
    console.log(`    - ${art.name} (${formatSize(art.size)})`)
  }
  if (!BUILD_ONLY) {
    console.log(`  Release: ${GREEN}https://github.com/crazytreeChen/ainovel-gui/releases/tag/v${version}${RESET}`)
  }
  console.log('')
}

main().catch((e) => {
  err(e.message)
  process.exit(1)
})
