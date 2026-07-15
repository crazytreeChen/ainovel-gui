import { useState, useEffect, useCallback } from 'react'
import type { BookItem } from '@/shared/ipc'
import { confirmAction } from '@/components/ConfirmModal'
import { showToast } from '@/components/Toast'

export interface UseBookCRUDReturn {
  books: BookItem[]
  loading: boolean
  viewMode: 'card' | 'detail'
  setViewMode: (mode: 'card' | 'detail') => void
  editBook: BookItem | null
  editName: string
  setEditName: (name: string) => void
  editStyle: string
  setEditStyle: (style: string) => void
  editPhase: string
  setEditPhase: (phase: string) => void
  editTags: string
  setEditTags: (tags: string) => void
  editPremise: string
  setEditPremise: (premise: string) => void
  editSaving: boolean
  deleteTarget: BookItem | null
  deleteConfirm: string
  setDeleteConfirm: (confirm: string) => void
  loadBooks: () => Promise<void>
  handleDelete: (id: string, e: React.MouseEvent) => void
  handleDeleteConfirm: () => Promise<void>
  handleEditClick: (book: BookItem, e: React.MouseEvent) => void
  handleEditSave: () => Promise<void>
  handleImport: () => Promise<void>
  handleOpenFolder: (book: BookItem, e: React.MouseEvent) => Promise<void>
  closeEdit: () => void
  closeDelete: () => void
}

/**
 * 书籍列表的 CRUD 操作：加载、删除、编辑、导入
 */
export function useBookCRUD(): UseBookCRUDReturn {
  const [books, setBooks] = useState<BookItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editBook, setEditBook] = useState<BookItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editStyle, setEditStyle] = useState('default')
  const [editPhase, setEditPhase] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editPremise, setEditPremise] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BookItem | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [viewMode, setViewMode] = useState<'card' | 'detail'>('card')

  const loadBooks = useCallback(async () => {
    setLoading(true)
    try {
      if (window.electronAPI) {
        const list = await window.electronAPI.listBooks()
        setBooks(list || [])
      }
    } catch (e) { console.error('loadBooks error:', e) }
    setLoading(false)
  }, [])

  useEffect(() => { loadBooks() }, [loadBooks])

  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const book = books.find(b => b.id === id)
    if (!book) return
    setDeleteTarget(book)
    setDeleteConfirm('')
  }, [books])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || deleteConfirm !== '确认删除') return
    if (!window.electronAPI) return
    try {
      const result: any = await window.electronAPI.deleteBook(deleteTarget.id)
      setDeleteTarget(null)
      setDeleteConfirm('')
      await loadBooks()
      const removed = (result && result.removed) || []
      if (Array.isArray(removed) && removed.length > 0) {
        showToast('书籍与文件夹已删除', 'success')
      } else {
        showToast('书籍已删除（未找到可删文件夹或已不存在）', 'success')
      }
    } catch (e: any) {
      showToast(e?.message || '删除失败', 'error')
    }
  }, [deleteTarget, deleteConfirm, loadBooks])

  const handleEditClick = useCallback((book: BookItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditBook(book)
    setEditName(book.name)
    setEditStyle(book.style || 'default')
    setEditPhase(book.phase || 'writing')
    setEditTags(book.tags || '')
    setEditPremise(book.premise || '')
  }, [])

  const handleEditSave = useCallback(async () => {
    if (!editBook || !editName.trim() || !window.electronAPI) return
    setEditSaving(true)
    const fields: Record<string, any> = { name: editName.trim(), style: editStyle }
    if (editPhase) fields.phase = editPhase
    if (editTags) fields.tags = editTags
    if (editPremise) fields.premise = editPremise
    await window.electronAPI.updateBook(editBook.id, fields)
    setEditSaving(false)
    setEditBook(null)
    await loadBooks()
  }, [editBook, editName, editStyle, editPhase, editTags, editPremise, loadBooks])

  const handleImport = useCallback(async () => {
    if (!window.electronAPI) return
    const dir = await window.electronAPI.selectDirectory()
    if (!dir) return

    const info = await window.electronAPI.scanWorkspace(dir)
    if (!info) {
      showToast('所选目录不是有效的 ainovel-cli 工作目录（缺少 output/ 子目录）', 'error')
      return
    }

    const confirmed = await confirmAction({
      title: '导入作品',
      message: `确认导入作品「${info.name || '未命名'}」？`,
      confirmText: '导入',
      details: [
        `阶段: ${info.phase || 'init'}`,
        `章节: ${info.chapterCount || 0}`,
        `字数: ${(info.totalWordCount || 0).toLocaleString()}`,
      ],
    })
    if (!confirmed) return

    const book = await window.electronAPI.importWorkspace(dir)
    if (book) {
      await loadBooks()
      showToast('作品已导入', 'success')
    } else {
      showToast('导入失败', 'error')
    }
  }, [loadBooks])

  const handleOpenFolder = useCallback(async (book: BookItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.electronAPI) return
    try {
      const dir = await window.electronAPI.getBookDir(book.id)
      if (!dir) {
        showToast('未找到书籍目录', 'error')
        return
      }
      await window.electronAPI.openDirectory(dir)
    } catch (err: any) {
      showToast(err?.message || '打开目录失败', 'error')
    }
  }, [])

  const closeEdit = useCallback(() => {
    setEditBook(null)
  }, [])

  const closeDelete = useCallback(() => {
    setDeleteTarget(null)
    setDeleteConfirm('')
  }, [])

  return {
    books,
    loading,
    viewMode,
    setViewMode,
    editBook,
    editName,
    setEditName,
    editStyle,
    setEditStyle,
    editPhase,
    setEditPhase,
    editTags,
    setEditTags,
    editPremise,
    setEditPremise,
    editSaving,
    deleteTarget,
    deleteConfirm,
    setDeleteConfirm,
    loadBooks,
    handleDelete,
    handleDeleteConfirm,
    handleEditClick,
    handleEditSave,
    handleImport,
    handleOpenFolder,
    closeEdit,
    closeDelete,
  }
}
