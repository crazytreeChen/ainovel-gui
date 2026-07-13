import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'
import type { ThemeMode } from '@/stores/useAppStore'
import BookList from '@/pages/BookList'
import Workspace from '@/pages/Workspace'
import NewBook from '@/pages/NewBook'
import { OutlinePage, ChapterPage, CharactersPage, TimelinePage, ReviewsPage, SettingsPage, ModelsPage, SimulationPage, UserRulesPage, WorldRulesPage, SummaryPage, BookIntroPage, DashboardPage, ProgressDashboard } from '@/pages'
import ToastContainer from './Toast'
import ConfirmModalHost from './ConfirmModal'
import ErrorBoundary from './ErrorBoundary'
import SearchModal from './SearchModal'
import ShortcutHelpModal from './ShortcutHelpModal'
import ModalHost from './ModalHost'
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
  const [showShortcutHelp, setShowShortcutHelp] = useState(false)

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K 全局搜索
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowSearch(s => !s)
        return
      }
      // ? 快捷键帮助
      if (e.key === '?' && !showSearch) {
        setShowShortcutHelp(s => !s)
        return
      }
      // Escape 只处理搜索和快捷键帮助，其他模态框由 ModalHost 处理
      if (e.key === 'Escape') {
        if (showSearch) { setShowSearch(false); return }
        if (showShortcutHelp) { setShowShortcutHelp(false); return }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSearch, showShortcutHelp])

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
      <Route path="/books/:id/progress" element={<ProgressDashboard />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/models" element={<ModelsPage />} />
    </Routes>
      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
      {showShortcutHelp && <ShortcutHelpModal />}
      <ModalHost />
    </>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ErrorBoundary>
        <AppRoutes />
        <ConfirmModalHost />
        <ToastContainer />
      </ErrorBoundary>
    </HashRouter>
  )
}
