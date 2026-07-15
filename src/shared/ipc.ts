/**
 * Electron IPC 通道合约类型
 *
 * 主进程 ↔ 渲染进程 通信的类型定义，两端共享。
 */

import type { UISnapshot, EventItem } from '@/types'
export interface BookItem {
  id: string; name: string; style: string; phase: string; flow: string
  completedCount: number; totalWordCount: number; premise: string
  tags: string; createdAt: string; lastOpenedAt: string; workspaceDir?: string
}

export interface BookCreateParams {
  name: string; style?: string; phase?: string; premise?: string; tags?: string
}

// ── 大纲 ──
export interface OutlineData {
  outline: any[]; layeredOutline: any[]; compass: any | null; premise: string
}

export interface OutlineSaveData {
  outline?: any[]; layeredOutline?: any[]; compass?: any | null; premise?: string
}

// ── 章节 ──
export interface ChapterItem {
  num: number; title: string; wordCount: number; status?: string
}

export interface ChapterDetail {
  num: number; content: string; draft: string; plan: any | null; title: string
}

// ── 角色 ──
export interface CharacterItem {
  name: string; aliases: string[]; role: string
  tier: 'core' | 'important' | 'secondary' | 'decorative'
  description: string; arc: string; traits: string[]
}

// ── 二进制信息 ──
export interface BinaryInfo {
  available: boolean; version: string; path: string
}

// ── 诊断 ──
export interface DiagResult {
  text?: string; error?: string
}

// ── 更新 ──
export interface UpdateInfo {
  available: boolean; currentVersion: string; latestVersion: string
  url: string; notes: string; releaseDate: string
  size: number; sha256: string; error?: string
}

export interface DownloadProgress {
  percent: number; bytesPerSecond: number; downloaded: number; total: number
}

export interface ProcessExitEvent {
  code: number | null
  bookId: string
  pendingUserConfirm?: boolean
}

export interface SearchResults {
  chapters: { type: 'chapter'; num: number; title: string; match: string }[]
  characters: { type: 'character'; name: string; role: string; match: string }[]
  events: { type: 'event'; chapter: number; event: string; match: string }[]
  outline: { type: 'outline'; chapter: number; title: string; match: string }[]
}

export interface CleanTitleChange {
  chapter: number; oldTitle: string; newTitle: string
}

export interface ApplyFixChange {
  chapter: number; type: 'title' | 'content'; oldTitle?: string; newTitle?: string
}

export type ApplyFixSkipReason = 'already_applied' | 'no_fix' | 'missing_file' | 'stale' | 'unchanged'

export interface ApplyFixSkip {
  chapter: number; reason: ApplyFixSkipReason; detail: string
}

export interface ChapterAuditItem {
  chapter: number; reviewedAt: string; contentHash: string
  review: {
    title_score?: number; ai_flavor_score?: number; pacing_score?: number
    outline_alignment_score?: number; word_count_ok?: boolean
    character_continuity_score?: number; timeline_consistency_score?: number; plot_thread_score?: number
  }
  issues: string[]; strengths: string[]; suggestedTitle: string; correctedContent?: string
  missingIntroductions: string[]; characterStateInconsistencies: string[]
  timelineGaps: string[]; droppedThreads: string[]
  needsRewrite: boolean; needsTrimming: boolean; summary: string
  fixAppliedAt?: string; appliedChanges?: ApplyFixChange[]
}

export interface ElectronAPI {
  // 书籍
  listBooks: () => Promise<BookItem[]>
  createBook: (name: string, style: string, phase?: string, premise?: string, tags?: string) => Promise<BookItem>
  deleteBook: (id: string) => Promise<boolean | { ok: boolean; removed?: string[]; errors?: string[] }>
  getBook: (id: string) => Promise<BookItem | null>
  updateBook: (id: string, fields: Record<string, any>) => Promise<boolean>
  getBookDir: (id: string) => Promise<string | null>
  getGuiDataDir: () => Promise<string>

  // 大纲
  getBookOutline: (id: string) => Promise<OutlineData | null>
  saveBookOutline: (id: string, data: OutlineSaveData) => Promise<boolean>

  // 章节
  getBookChapters: (id: string) => Promise<ChapterItem[]>
  getBookChapter: (id: string, num: number) => Promise<ChapterDetail | null>
  saveBookChapter: (id: string, num: number, content: string, title?: string) => Promise<boolean>

  // 角色
  getBookCharacters: (id: string) => Promise<CharacterItem[]>
  saveBookCharacters: (id: string, chars: CharacterItem[]) => Promise<boolean>

  // 配角名册
  getBookCast: (id: string) => Promise<any[]>
  saveBookCast: (id: string, entries: any[]) => Promise<boolean>

  // 时间线
  getBookTimeline: (id: string) => Promise<any>
  saveBookTimeline: (id: string, data: any) => Promise<boolean>

  // 历史评审兼容 + 质量审查
  getBookReviews: (id: string) => Promise<any[]>
  getBookAudits: (id: string) => Promise<ChapterAuditItem[]>
  saveBookReview: (id: string, review: any) => Promise<boolean>

  // 图片生成
  /** 图片接口格式：openai=标准 OpenAI 格式，agnes=Agnes AI 格式 */
  generateImage: (providerKey: string, model: string, prompt: string, options?: { size?: string; style?: string }) =>
    Promise<{ image?: string; error?: string }>
  saveImageProviderConfig: (imageProvider: string, imageModel: string, imageFormat?: string) => Promise<boolean>

  // 封面
  selectCoverImage: () => Promise<string | null>
  saveBookCover: (id: string, imagePath: string) => Promise<boolean | string>
  getBookCover: (id: string) => Promise<string | null>

  // 仿写画像
  getSimulationProfile: (id: string) => Promise<any>
  saveSimulationProfile: (id: string, profile: any) => Promise<boolean>

  // 用户规则
  getUserRules: (id: string) => Promise<any>
  saveUserRules: (id: string, rules: any) => Promise<boolean>

  // 模型
  fetchModels: (baseUrl: string, apiKey: string, protocol: string) => Promise<{ models?: string[]; error?: string }>
  loadProviderConfig: () => Promise<any>
  saveProviderConfig: (config: any) => Promise<boolean>
  applyProviderToBook: (bookId?: string) => Promise<boolean>

  // 全局配置
  saveConfigValue: (key: string, value: any) => Promise<boolean>
  loadConfigValue: (key: string) => Promise<any>

  // 快照/事件/章节
  getSnapshot: (bookId?: string) => Promise<UISnapshot>
  getEvents: (bookId?: string) => Promise<EventItem[]>
  clearEvents: () => Promise<boolean>
  readChapter: (chapterNum: number, bookId?: string) => Promise<string>
  listChapters: (bookId?: string) => Promise<ChapterItem[]>

  // 创作控制
  startWriting: (prompt: string, bookId?: string) => Promise<{ ok: boolean; error?: string }>
  createBookAuto: (premise: string, style?: string) => Promise<{ book?: BookItem; error?: string | null }>
  resumeWriting: (bookId: string) => Promise<{ ok: boolean; error?: string }>
  sendInput: (text: string, bookId?: string) => Promise<boolean>
  pauseWriting: () => Promise<boolean>
  stopWriting: () => Promise<boolean>
  cocreateGetContext: (bookId?: string) => Promise<{ opener: string; summary: string; bookId: string; error?: string }>
  cocreateChat: (payload: { bookId?: string; history?: { role: string; content: string }[]; userText?: string; kickoff?: boolean; prevDraft?: string }) => Promise<{ error?: string | null; message: string; draft: string; ready: boolean; suggestions: string[]; summary?: string; raw?: string }>

  // 诊断
  runDiag: () => Promise<string>
  readDiagReport: () => Promise<string>
  runSimulate: (bookId: string) => Promise<string>

  // 导出
  runExport: (bookId: string, args: string) => Promise<string>

  // 目录
  selectDirectory: () => Promise<string | null>
  scanWorkspace: (dir: string) => Promise<any>
  importWorkspace: (dir: string) => Promise<any>
  setDirectory: (dir: string) => Promise<boolean>
  getDirectory: () => Promise<string>
  openDirectory: (dir: string) => Promise<void>

  // 系统
  checkBinary: () => Promise<BinaryInfo>
  debugDb: () => Promise<any>

  // 世界观/风格规则
  getWorldRules: (id: string) => Promise<any[]>
  saveWorldRules: (id: string, rules: any[]) => Promise<boolean>
  getStyleRules: (id: string) => Promise<any>
  saveStyleRules: (id: string, rules: any) => Promise<boolean>

  // 运行元/用量
  getRunMeta: (id: string) => Promise<any>
  saveRunMeta: (id: string, meta: any) => Promise<boolean>
  getUsageStats: (id: string) => Promise<any>
  saveUsageStats: (id: string, stats: any) => Promise<boolean>

  // 摘要
  getBookSummaries: (id: string) => Promise<any[]>
  saveBookSummaries: (id: string, summaries: any[]) => Promise<boolean>

  // 用户指令
  getUserDirectives: (id: string) => Promise<any[]>
  saveUserDirectives: (id: string, directives: any[]) => Promise<boolean>

  // 全局搜索
  searchBook: (id: string, query: string) => Promise<SearchResults>

  // 批量清洗
  previewCleanTitles: (id: string) => Promise<{ changes: CleanTitleChange[]; total: number; error?: string }>
  batchCleanTitles: (id: string) => Promise<{ cleaned: number; total: number; error?: string }>

  // AI 批量生成标题
  batchGenerateTitles: (id: string) => Promise<{
    success: boolean; updated: number; total: number; error?: string
    results?: { chapter: number; oldTitle: string; newTitle: string; error?: string }[]
  }>

  // 质量审查修复 Agent
  batchAuditBook: (id: string, apply?: boolean, startChapter?: number, endChapter?: number, force?: boolean) => Promise<{
    success: boolean; canceled?: boolean; total: number; error?: string
    stats: {
      reviewed: number; contentCorrected: number; titleUpdated: number
      contentFixCandidates?: number; titleFixCandidates?: number
      needsRewrite: number; needsTrimming: number
      errors: number; skipped: number
      avgTitleScore: number; avgAiFlavorScore: number
      avgPacingScore: number; avgOutlineScore: number
      avgCharContinuityScore: number; avgTimelineScore: number; avgPlotThreadScore: number
      totalMissingIntros: number; totalCharStateInconsistencies: number; totalTimelineGaps: number; totalDroppedThreads: number
    }
    results: {
      chapter: number; oldTitle: string; newTitle?: string
      review?: {
        title_score: number; ai_flavor_score: number; pacing_score: number
        outline_alignment_score: number; word_count_ok: boolean
        character_continuity_score: number; timeline_consistency_score: number; plot_thread_score: number
      }
      issues?: string[]; strengths?: string[]
      missingIntroductions?: string[]; characterStateInconsistencies?: string[]; timelineGaps?: string[]; droppedThreads?: string[]
      applied?: string[]; needsRewrite?: boolean; needsTrimming?: boolean
      summary?: string; error?: string; skipped?: boolean; reason?: string; reviewedAt?: string
    }[]
  }>

  // 更新
  checkUpdate: () => Promise<UpdateInfo>
  downloadUpdate: (url: string, sha256: string) => Promise<{ success: boolean; path?: string; error?: string }>
  installUpdate: (path: string) => Promise<{ success: boolean; error?: string }>
  onDownloadProgress: (callback: (data: DownloadProgress) => void) => () => void

  // 数据备份与恢复
  backupData: () => Promise<{ success: boolean; path?: string; error?: string }>
  restoreData: () => Promise<{ success: boolean; error?: string }>

  // 事件监听
  onProcessExited: (callback: (data: ProcessExitEvent) => void) => () => void
  onSnapshotUpdate: (callback: (data: UISnapshot) => void) => () => void
  onStreamOutput: (callback: (data: string) => void) => () => void
  onRuntimeUpdate: (callback: () => void) => () => void

  // 规划完成事件（确认继续写作）
  onPlanningComplete: (callback: (data: { bookId: string }) => void) => () => void
  confirmContinueWriting: (bookId: string) => Promise<{ ok: boolean; error?: string }>

  // 质量审查进度
  onAuditProgress: (callback: (data: { current: number; total: number; chapter: number; elapsed: number; remaining: number }) => void) => () => void

  // 取消质量审查
  cancelAudit: () => Promise<boolean>

  // 应用审查修复（从保存的审查结果中执行修复，不重新调用 LLM）
  batchApplyFixes: (id: string, chapters?: number[]) => Promise<{
    success: boolean; titleUpdated: number; contentFixed: number; skippedStale?: number
    skipped?: ApplyFixSkip[]; skipStats?: Partial<Record<ApplyFixSkipReason, number>>
    error?: string; applied?: ApplyFixChange[]
  }>
}
