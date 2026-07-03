/**
 * 基础类型测试 — 验证核心类型和工具函数
 */
import { describe, it, expect } from 'vitest'
import { translateEventSummary } from '@/types'

describe('translateEventSummary', () => {
  it('should return empty string for empty input', () => {
    expect(translateEventSummary('')).toBe('')
  })

  it('should return string for non-empty input', () => {
    const result = translateEventSummary('test summary')
    expect(result).toBeTruthy()
  })

  it('should handle special characters', () => {
    const result = translateEventSummary('<test & more>')
    expect(result).toContain('test')
  })
})
