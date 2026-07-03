import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'
import type { ThemeMode } from '@/stores/useAppStore'
import BookList from '@/pages/BookList'
import Workspace from '@/pages/Workspace'
import NewBook from '@/pages/NewBook'
import { OutlinePage, ChapterPage, CharactersPage, TimelinePage, ReviewsPage, SettingsPage, ModelsPage, SimulationPage, UserRulesPage, WorldRulesPage, SummaryPage, BookIntroPage, DashboardPage } from '@/pages'
import ToastContainer from './Toast'
import ErrorBoundary from './ErrorBoundary'
import SearchModal from './SearchModal'
import { useIPCListeners } from '@/hooks/useIPCListeners'

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
  useIPCListeners()
  const [showSearch, setShowSearch] = useState(false)
  const showHelp = useAppStore((s) => s.showHelp)
  const showDiagnostics = useAppStore((s) => s.showDiagnostics)
  const showModelSwitch = useAppStore((s) => s.showModelSwitch)
  const showCoCreate = useAppStore((s) => s.showCoCreate)

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K 全局搜索
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(s => !s)
        return
      }
      if (e.key === 'Escape') {
        if (showSearch) { setShowSearch(false); return }
        if (showHelp) useAppStore.getState().toggleHelp()
        if (showDiagnostics) useAppStore.getState().toggleDiagnostics()
        if (showModelSwitch) useAppStore.getState().toggleModelSwitch()
        if (showCoCreate) useAppStore.getState().toggleCoCreate()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSearch, showHelp, showDiagnostics, showModelSwitch, showCoCreate])

  return (
    <>
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
      <Route path="/books/:id/dashboard" element={<DashboardPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/models" element={<ModelsPage />} />
    </Routes>
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    </>
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
