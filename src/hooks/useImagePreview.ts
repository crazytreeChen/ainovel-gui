import { useState, useCallback } from 'react'

/**
 * 图片预览 Hook — 统一 NewBook / CharactersPage / BookCover 的图片查看器模式
 */
export function useImagePreview() {
  const [preview, setPreview] = useState<string | null>(null)

  const open = useCallback((src: string) => setPreview(src), [])
  const close = useCallback(() => setPreview(null), [])

  return { preview, open, close }
}
