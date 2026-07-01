// @ts-nocheck — CJS 工具模块，类型由运行时保证
/**
 * ainovel-gui Electron 主进程日志工具
 *
 * 统一日志输出，支持模块化标签和可选的日志级别过滤。
 */

// 标记为模块，避免 TypeScript CJS 导出冲突
export {}

const DEBUG = process.env.NODE_ENV === 'development' || process.env.DEBUG

function timestamp() {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`
}

const logCreator = function(module) {
  const prefix = `[${module}]`

  function log(level, ...args) {
    if (level === 'debug' && !DEBUG) return
    const fn = level === 'error' ? console.error
      : level === 'warn' ? console.warn
      : console.log
    fn(`${timestamp()} ${prefix}[${level.toUpperCase()}]`, ...args)
  }

  return {
    debug: (...args) => log('debug', ...args),
    info: (...args) => log('info', ...args),
    warn: (...args) => log('warn', ...args),
    error: (...args) => log('error', ...args),
  }
}

/** 安全执行一个可能会失败的操作，自动错误日志 */
const safeRun = function(logger, label, fn, fallback) {
  try {
    return fn()
  } catch (e) {
    logger.error(`${label}: ${e?.message || e}`)
    return fallback
  }
}

/** 安全执行异步操作，自动错误日志 */
const safeRunAsync = async function(logger, label, fn, fallback) {
  try {
    return await fn()
  } catch (e) {
    logger.error(`${label}: ${e?.message || e}`)
    return fallback
  }
}

module.exports = { createLogger: logCreator, tryOrLog: safeRun, tryOrLogAsync: safeRunAsync }
