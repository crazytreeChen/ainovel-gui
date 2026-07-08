/**
 * IPC 调用封装
 * 
 * 统一错误处理，提供类型安全的 IPC 调用接口。
 */

import type { IPCResult, ErrorCode } from './ipc-errors'
import { createIPCFailure, ErrorCodes } from './ipc-errors'

// 通用 IPC 调用封装
export async function callIPC<T>(
  fn: () => Promise<T>,
  errorCode: ErrorCode = ErrorCodes.UNKNOWN
): Promise<IPCResult<T>> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[IPC] ${errorCode}:`, message)
    return createIPCFailure(errorCode, message, err)
  }
}

// 带超时的 IPC 调用
export async function callIPCTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorCode: ErrorCode = ErrorCodes.UNKNOWN
): Promise<IPCResult<T>> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('操作超时')), timeoutMs)
  })
  
  try {
    const data = await Promise.race([fn(), timeoutPromise])
    return { success: true, data }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[IPC] ${errorCode}:`, message)
    return createIPCFailure(errorCode, message, err)
  }
}

// 批量 IPC 调用
export async function callIPCBatch<T>(
  calls: Array<() => Promise<T>>
): Promise<IPCResult<T>[]> {
  const results = await Promise.allSettled(calls.map(call => call()))
  
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return { success: true, data: result.value }
    } else {
      const message = result.reason instanceof Error 
        ? result.reason.message 
        : String(result.reason)
      console.error(`[IPC] batch[${index}]:`, message)
      return createIPCFailure(ErrorCodes.UNKNOWN, message, result.reason)
    }
  })
}
