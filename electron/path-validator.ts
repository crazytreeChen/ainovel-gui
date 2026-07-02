// @ts-nocheck — CJS 路径校验工具
/**
 * IPC 路径校验工具
 *
 * 防止渲染进程通过 IPC 提交恶意路径，访问应用允许范围之外的文件系统位置。
 * 任何未落在白名单基目录之下的路径都会被拒绝。
 */
const { app } = require('electron')
const { resolve, sep } = require('path')
const { state, GUI_DATA_DIR, home } = require('./context')

function getAllowedBases() {
  const bases = [GUI_DATA_DIR, home]
  let docs = ''
  try { docs = app.getPath('documents') } catch {}
  if (docs) bases.push(docs)
  if (state.outputDir) bases.push(state.outputDir)
  return bases
}

function isUnder(child, parent) {
  const c = resolve(child)
  const p = resolve(parent)
  if (process.platform === 'win32') {
    const cl = c.toLowerCase()
    const pl = p.toLowerCase()
    if (cl === pl) return true
    return cl.startsWith(pl + sep.toLowerCase())
  }
  if (c === p) return true
  return c.startsWith(p + sep)
}

/**
 * 校验并规范化路径。
 * @param {string} input 待校验的路径
 * @returns {string} 规范化后的绝对路径
 * @throws {Error} 路径为空、包含 `..` 段或不在白名单内
 */
function validatePath(input) {
  if (typeof input !== 'string' || input.length === 0) {
    throw new Error('路径不能为空')
  }

  const segments = input.split(/[\\/]+/).filter(Boolean)
  if (segments.includes('..')) {
    throw new Error('路径包含非法的 .. 段')
  }

  const resolved = resolve(input)
  const bases = getAllowedBases()
  for (const base of bases) {
    if (isUnder(resolved, base)) return resolved
  }

  throw new Error('路径超出允许范围')
}

module.exports = { validatePath }
