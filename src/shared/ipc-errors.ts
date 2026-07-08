/**
 * IPC 统一错误类型
 * 
 * 所有 IPC 调用返回统一格式，便于错误处理和用户提示。
 */

export interface IPCError {
  code: string
  message: string
  details?: unknown
}

export interface IPCResult<T = unknown> {
  success: boolean
  data?: T
  error?: IPCError
}

// 错误码定义
export const ErrorCodes = {
  // 通用
  UNKNOWN: 'UNKNOWN',
  CANCELLED: 'CANCELLED',
  
  // 书籍相关
  BOOK_NOT_FOUND: 'BOOK_NOT_FOUND',
  BOOK_CREATE_FAILED: 'BOOK_CREATE_FAILED',
  BOOK_UPDATE_FAILED: 'BOOK_UPDATE_FAILED',
  BOOK_DELETE_FAILED: 'BOOK_DELETE_FAILED',
  
  // 章节相关
  CHAPTER_NOT_FOUND: 'CHAPTER_NOT_FOUND',
  CHAPTER_SAVE_FAILED: 'CHAPTER_SAVE_FAILED',
  CHAPTER_READ_FAILED: 'CHAPTER_READ_FAILED',
  
  // 创作相关
  WRITING_START_FAILED: 'WRITING_START_FAILED',
  WRITING_RESUME_FAILED: 'WRITING_RESUME_FAILED',
  WRITING_STOP_FAILED: 'WRITING_STOP_FAILED',
  CLI_NOT_FOUND: 'CLI_NOT_FOUND',
  
  // 审查相关
  REVIEW_SAVE_FAILED: 'REVIEW_SAVE_FAILED',
  AUDIT_FAILED: 'AUDIT_FAILED',
  
  // 数据库相关
  DB_READ_ERROR: 'DB_READ_ERROR',
  DB_WRITE_ERROR: 'DB_WRITE_ERROR',
  
  // 配置相关
  CONFIG_READ_ERROR: 'CONFIG_READ_ERROR',
  CONFIG_WRITE_ERROR: 'CONFIG_WRITE_ERROR',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

// 创建错误对象
export function createIPCError(
  code: ErrorCode,
  message: string,
  details?: unknown
): IPCError {
  return { code, message, details }
}

// 创建成功结果
export function createIPCSuccess<T>(data: T): IPCResult<T> {
  return { success: true, data }
}

// 创建失败结果
export function createIPCFailure<T>(
  code: ErrorCode,
  message: string,
  details?: unknown
): IPCResult<T> {
  return {
    success: false,
    error: createIPCError(code, message, details),
  }
}

// 获取用户友好的错误消息
export function getErrorMessage(error: IPCError): string {
  const messages: Record<string, string> = {
    [ErrorCodes.BOOK_NOT_FOUND]: '未找到该书籍',
    [ErrorCodes.CHAPTER_NOT_FOUND]: '未找到该章节',
    [ErrorCodes.CLI_NOT_FOUND]: '未找到 ainovel-cli，请先安装',
    [ErrorCodes.DB_READ_ERROR]: '数据读取失败',
    [ErrorCodes.DB_WRITE_ERROR]: '数据写入失败',
    [ErrorCodes.WRITING_START_FAILED]: '创作启动失败',
  }
  
  return messages[error.code] || error.message || '操作失败'
}
