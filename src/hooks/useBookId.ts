import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

/**
 * 从路由参数中提取 bookId，若无效则自动跳转回首页。
 * 消除 12 个页面中重复的 useParams + guard 模式。
 */
export function useBookId(): string {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (!id || !window.electronAPI) {
      navigate('/')
    }
  }, [id, navigate])

  return id ?? ''
}
