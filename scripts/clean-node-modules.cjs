#!/usr/bin/env node
/**
 * node_modules 清理脚本
 *
 * 在打包前运行，移除 node_modules 中构建和运行时不需要的文件，
 * 减小 asar 体积。保守清理，只删明确无用的文件类型。
 *
 * 用法:
 *   node scripts/clean-node-modules.cjs          # 清理当前 node_modules
 *   node scripts/clean-node-modules.cjs --dry-run # 只列出不做删除
 */

const { existsSync, readdirSync, statSync, unlinkSync, rmdirSync } = require('fs')
const { join, relative, extname, basename } = require('path')

const ROOT = join(__dirname, '..')
const NM = join(ROOT, 'node_modules')

// ── 安全删除的文件/目录模式 ──
// 这些文件在运行时 100% 不需要
const DELETE_FILES = new Set([
  'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE',
  'LICENCE.md', 'LICENCE.txt',
  'README', 'README.md', 'README.txt', 'README.markdown',
  'CHANGELOG', 'CHANGELOG.md', 'CHANGELOG.txt',
  'HISTORY', 'HISTORY.md',
  'CONTRIBUTING', 'CONTRIBUTING.md',
  'AUTHORS', 'AUTHORS.txt',
  'CODE_OF_CONDUCT.md', 'SECURITY.md', 'SUPPORT.md',
  'CODEOWNERS',
  '.npmignore', '.gitignore', '.editorconfig',
  '.eslintrc', '.eslintrc.json', '.eslintrc.yml',
  '.prettierrc', '.prettierrc.json', '.prettierignore',
  '.babelrc', '.browserslistrc',
  'tsconfig.json', 'tsconfig.tsbuildinfo',
  'Makefile', 'Gulpfile.js', 'Gruntfile.js',
  'index.d.ts', 'index.d.ts.map',
])

// 这些扩展名的文件在 asar 中无用（仅开发时需要）
const DELETE_EXTS = new Set([
  '.h', '.hpp',           // C/C++ headers
  '.o', '.obj',            // compiled objects
  '.node.map',             // native module source maps
  '.d.ts', '.d.ts.map',    // TS declarations (not needed at runtime)
])

// 这些目录名应直接删除（dev-only）
const DELETE_DIRS = new Set([
  'test', 'tests',
  '__tests__', '__test__',
  'spec', 'specs',
  'example', 'examples',
  'demo', 'demos',
  'benchmark', 'benchmarks',
  'perf',
  'docs', 'doc', 'documentation',
  'website',
])

// ── 需要保护的包和目录（不清理） ──
const PROTECTED_PKGS = new Set([
  // native 模块需要保留完整的构建产物
  'better-sqlite3',
])

function isInProtected(pkgName) {
  // 检查路径是否属于受保护的包
  for (const p of PROTECTED_PKGS) {
    if (pkgName.startsWith(p + '/') || pkgName === p) return true
  }
  return false
}

let cleanedCount = 0
let cleanedBytes = 0

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function cleanDir(dirPath, pkgPrefix) {
  if (!existsSync(dirPath)) return

  let entries
  try { entries = readdirSync(dirPath) } catch { return }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry)
    let stats
    try { stats = statSync(fullPath) } catch { continue }

    const relPath = pkgPrefix + '/' + entry

    // 跳过受保护包的根目录
    if (isInProtected(relPath)) continue

    if (stats.isDirectory()) {
      // 跳过链接目录（作用域包 @scope/name）
      if (entry.startsWith('@')) {
        cleanDir(fullPath, relPath)
        continue
      }
      // 跳过 .git, .github, bin, dist, build 等必要目录
      if (entry === '.git' || entry === '.github' || entry === 'bin' || entry === '.bin') continue

      // 删除 dev-only 目录
      if (DELETE_DIRS.has(entry) || entry.endsWith('.git')) {
        const size = dirSize(fullPath)
        cleanedCount++
        cleanedBytes += size
        if (!process.argv.includes('--dry-run')) {
          try { rmSync(fullPath) } catch { try { rmdirSync(fullPath) } catch {} }
        }
        console.log(`  ${process.argv.includes('--dry-run') ? '[DRY]' : '[DEL]'} ${relPath}/ (${formatSize(size)})`)
        continue
      }
      cleanDir(fullPath, relPath)
    } else if (stats.isFile()) {
      const ext = extname(entry)
      const name = basename(entry, ext)

      // 删除已知的无用文件
      if (DELETE_FILES.has(entry) || DELETE_FILES.has(name)) {
        cleanedCount++
        cleanedBytes += stats.size
        if (!process.argv.includes('--dry-run')) {
          try { unlinkSync(fullPath) } catch {}
        }
        console.log(`  ${process.argv.includes('--dry-run') ? '[DRY]' : '[DEL]'} ${relPath} (${formatSize(stats.size)})`)
        continue
      }

      // 删除已知的无用扩展名
      if (DELETE_EXTS.has(ext)) {
        cleanedCount++
        cleanedBytes += stats.size
        if (!process.argv.includes('--dry-run')) {
          try { unlinkSync(fullPath) } catch {}
        }
        console.log(`  ${process.argv.includes('--dry-run') ? '[DRY]' : '[DEL]'} ${relPath} (${formatSize(stats.size)})`)
        continue
      }
    }
  }
}

function dirSize(dirPath) {
  let total = 0
  if (!existsSync(dirPath)) return 0
  try {
    const entries = readdirSync(dirPath)
    for (const entry of entries) {
      const fullPath = join(dirPath, entry)
      try {
        const stats = statSync(fullPath)
        if (stats.isDirectory()) {
          total += dirSize(fullPath)
        } else {
          total += stats.size
        }
      } catch {}
    }
  } catch {}
  return total
}

// 兼容 rmSync 版本差异
function rmSync(dirPath) {
  try {
    const entries = readdirSync(dirPath)
    for (const entry of entries) {
      const fullPath = join(dirPath, entry)
      try {
        const stats = statSync(fullPath)
        if (stats.isDirectory()) {
          rmSync(fullPath)
        } else {
          unlinkSync(fullPath)
        }
      } catch {}
    }
    rmdirSync(dirPath)
  } catch {}
}

function main() {
  if (!existsSync(NM)) {
    console.log('node_modules not found at ' + NM)
    process.exit(0)
  }

  const isDryRun = process.argv.includes('--dry-run')
  console.log('═══════════════════════════════════════')
  console.log('   node_modules 清理')
  console.log('   Mode: ' + (isDryRun ? 'DRY RUN (no changes)' : 'LIVE'))
  console.log('═══════════════════════════════════════')
  console.log('')

  const startSize = dirSize(NM)
  console.log('Before: ' + formatSize(startSize))
  console.log('')

  cleanDir(NM, 'node_modules')

  console.log('')
  const endSize = dirSize(NM)
  console.log('After:  ' + formatSize(endSize))
  console.log('Files removed: ' + cleanedCount)
  console.log('Space saved:   ' + formatSize(cleanedBytes))
  console.log('Net change:    ' + formatSize(startSize - endSize))
  console.log('')
  console.log('Done.')
}

main()
