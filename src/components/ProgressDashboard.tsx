import { useState, useEffect } from 'react'
import { useBookStore } from '@/stores/useBookStore'

interface ProgressStats {
  completedChapters: number
  totalChapters: number
  totalWords: number
  avgWordsPerChapter: number
  dailyProgress: DailyProgress[]
  weeklyTrend: number
}

interface DailyProgress {
  date: string
  chapters: number
  words: number
}

export default function ProgressDashboard() {
  const snapshot = useBookStore(s => s.snapshot)
  const [stats, setStats] = useState<ProgressStats | null>(null)

  useEffect(() => {
    calculateStats()
  }, [snapshot])

  function calculateStats() {
    const completed = snapshot.completedCount || 0
    const total = snapshot.totalChapters || 0
    const words = snapshot.totalWordCount || 0
    const avgWords = completed > 0 ? Math.round(words / completed) : 0

    // 模拟每日进度数据（实际应从后端获取）
    const dailyProgress: DailyProgress[] = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      dailyProgress.push({
        date: date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
        chapters: i === 0 ? completed % 3 : Math.floor(Math.random() * 2),
        words: i === 0 ? words % 5000 : Math.floor(Math.random() * 3000),
      })
    }

    // 计算周趋势
    const thisWeekWords = dailyProgress.slice(-7).reduce((sum, d) => sum + d.words, 0)
    const lastWeekWords = dailyProgress.slice(0, 7).reduce((sum, d) => sum + d.words, 0)
    const weeklyTrend = lastWeekWords > 0 ? Math.round((thisWeekWords / lastWeekWords - 1) * 100) : 0

    setStats({
      completedChapters: completed,
      totalChapters: total,
      totalWords: words,
      avgWordsPerChapter: avgWords,
      dailyProgress,
      weeklyTrend,
    })
  }

  if (!stats) return null

  const progressPercent = stats.totalChapters > 0 
    ? Math.round((stats.completedChapters / stats.totalChapters) * 100) 
    : 0

  return (
    <div className="progress-dashboard">
      <h3 className="dashboard-title">创作进度</h3>
      
      {/* 进度条 */}
      <div className="progress-bar-container">
        <div className="progress-bar">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="progress-text">
          {stats.completedChapters}/{stats.totalChapters} 章 ({progressPercent}%)
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalWords.toLocaleString()}</div>
          <div className="stat-label">总字数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.avgWordsPerChapter.toLocaleString()}</div>
          <div className="stat-label">章均字数</div>
        </div>
        <div className="stat-card">
          <div className={`stat-value ${stats.weeklyTrend >= 0 ? 'positive' : 'negative'}`}>
            {stats.weeklyTrend >= 0 ? '+' : ''}{stats.weeklyTrend}%
          </div>
          <div className="stat-label">周趋势</div>
        </div>
      </div>

      {/* 每日进度条形图 */}
      <div className="daily-chart">
        <h4 className="chart-title">近 7 天进度</h4>
        <div className="bar-chart">
          {stats.dailyProgress.map((day, index) => {
            const maxWords = Math.max(...stats.dailyProgress.map(d => d.words))
            const heightPercent = maxWords > 0 ? (day.words / maxWords) * 100 : 0
            return (
              <div key={index} className="bar-item">
                <div className="bar" style={{ height: `${heightPercent}%` }}>
                  <div className="bar-tooltip">{day.words.toLocaleString()} 字</div>
                </div>
                <div className="bar-label">{day.date}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 预计完成时间 */}
      {stats.completedChapters > 0 && stats.totalChapters > stats.completedChapters && (
        <div className="eta-section">
          <div className="eta-label">预计剩余</div>
          <div className="eta-value">
            {Math.ceil((stats.totalChapters - stats.completedChapters) / Math.max(1, stats.completedChapters / 7))} 天
          </div>
        </div>
      )}
    </div>
  )
}
