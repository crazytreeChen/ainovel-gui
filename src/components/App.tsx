import { useEffect, useRef } from 'react'
import { HashRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'
import type { ThemeMode } from '@/stores/useAppStore'
import BookList from '@/pages/BookList'
import Workspace from '@/pages/Workspace'
import NewBook from '@/pages/NewBook'
import { OutlinePage, ChapterPage, CharactersPage, TimelinePage, ReviewsPage, SettingsPage, ModelsPage, SimulationPage, UserRulesPage, WorldRulesPage, SummaryPage, BookIntroPage } from '@/pages'
import ToastContainer from './Toast'
import ErrorBoundary from './ErrorBoundary'

function resolveTheme(theme: ThemeMode): string {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  }
  return theme
}

function useThemeEffect() {
  const theme = useAppStore(s => s.theme)

  useEffect(() => {
    const applied = resolveTheme(theme)
    document.documentElement.setAttribute('data-theme', applied)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: light)')
      const handler = () => {
        document.documentElement.setAttribute('data-theme', mq.matches ? 'light' : 'dark')
      }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])
}

function AppRoutes() {
  useThemeEffect()
  const navigate = useNavigate()
  const refreshSnapshot = useAppStore((s) => s.refreshSnapshot)
  const refreshEvents = useAppStore((s) => s.refreshEvents)
  const refreshChapters = useAppStore((s) => s.refreshChapters)
  const setBinaryInfo = useAppStore((s) => s.setBinaryInfo)
  const mode = useAppStore((s) => s.mode)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 初始化：检查 binary + 加载快照
  useEffect(() => {
    async function init() {
      if (window.electronAPI) {
        const info = await window.electronAPI.checkBinary()
        setBinaryInfo(info)
        // 首次加载快照（从 SQLite 读取已有数据）
        await refreshSnapshot()
        await refreshChapters()
      }
    }
    init()
  }, [setBinaryInfo, refreshSnapshot, refreshChapters])

  // 轮询快照和事件
  useEffect(() => {
    if (mode === 'running') {
      pollRef.current = setInterval(async () => {
        await refreshSnapshot()
        await refreshEvents()
        await refreshChapters()
      }, 2000)
    } else {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [mode, refreshSnapshot, refreshEvents, refreshChapters])

  // 监听进程退出
  useEffect(() => {
    if (!window.electronAPI) return
    const cleanup = window.electronAPI.onProcessExited(() => {
      useAppStore.getState().setMode('welcome')
      refreshSnapshot()
    })
    return cleanup
  }, [refreshSnapshot])

  // 监听流式输出
  useEffect(() => {
    if (!window.electronAPI) return
    const cleanup = window.electronAPI.onStreamOutput((data) => {
      try {
        const parsed = JSON.parse(data)
        useAppStore.getState().appendStreamOutput(parsed)
      } catch {
        useAppStore.getState().appendStreamOutput({type: 'content', text: data})
      }
    })
    return cleanup
  }, [])

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (useAppStore.getState().showHelp) useAppStore.getState().toggleHelp()
        if (useAppStore.getState().showDiagnostics) useAppStore.getState().toggleDiagnostics()
        if (useAppStore.getState().showModelSwitch) useAppStore.getState().toggleModelSwitch()
        if (useAppStore.getState().showCoCreate) useAppStore.getState().toggleCoCreate()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <Routes>
      <Route path="/" element={<BookList />} />
      <Route path="/books/new" element={<NewBook />} />
      <Route path="/books/:id" element={<Workspace />} />
      <Route path="/books/:id/workspace" element={<Workspace />} />
      <Route path="/books/:id/outline" element={<OutlinePage />} />
      <Route path="/books/:id/chapters/:num" element={<ChapterPage />} />
      <Route path="/books/:id/characters" element={<CharactersPage />} />
      <Route path="/books/:id/timeline" element={<TimelinePage />} />
      <Route path="/books/:id/reviews" element={<ReviewsPage />} />
      <Route path="/books/:id/simulation" element={<SimulationPage />} />
      <Route path="/books/:id/rules" element={<UserRulesPage />} />
      <Route path="/books/:id/world" element={<WorldRulesPage />} />
      <Route path="/books/:id/summaries" element={<SummaryPage />} />
      <Route path="/books/:id/intro" element={<BookIntroPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/models" element={<ModelsPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <AppRoutes />
        <ToastContainer />
      </ErrorBoundary>
    </HashRouter>
  )
}
