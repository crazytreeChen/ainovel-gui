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

interface Logger {
  debug(...args: any[]): void
  info(...args: any[]): void
  warn(...args: any[]): void
  error(...args: any[]): void
}

const logCreator = function(module: string): Logger {
  const prefix = `[${module}]`

  function log(level: string, ...args: any[]) {
    if (level === 'debug' && !DEBUG) return
    const fn: (...a: any[]) => void = level === 'error' ? console.error
      : level === 'warn' ? console.warn
      : console.log
    fn(`${timestamp()} ${prefix}[${level.toUpperCase()}]`, ...args)
  }

  return {
    debug: (...args: any[]) => log('debug', ...args),
    info: (...args: any[]) => log('info', ...args),
    warn: (...args: any[]) => log('warn', ...args),
    error: (...args: any[]) => log('error', ...args),
  }
}

/** 安全执行一个可能会失败的操作，自动错误日志 */
const safeRun = function<T>(logger: Logger, label: string, fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch (e: any) {
    logger.error(`${label}: ${e?.message || e}`)
    return fallback
  }
}

/** 安全执行异步操作，自动错误日志 */
const safeRunAsync = async function<T>(logger: Logger, label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn()
  } catch (e: any) {
    logger.error(`${label}: ${e?.message || e}`)
    return fallback
  }
}

module.exports = { createLogger: logCreator, tryOrLog: safeRun, tryOrLogAsync: safeRunAsync }
