// ── aINovel GUI 类型定义 ──

export interface UISnapshot {
  novelName: string
  provider: string
  modelName: string
  style: string
  phase: string
  flow: string
  runtimeState: string
  isRunning: boolean
  completedCount: number
  totalChapters: number
  totalWordCount: number
  inProgressChapter: number
  currentChapter: number
  pendingRewrites: number[]
  rewriteReason: string
  layered: boolean
  currentVolumeArc: string
  premise: string
  outline: OutlineItem[]
  totalOutlineCount: number  // 实际大纲条目总数（outline 可能被截断）
  characters: string[]
  compassDirection: string
  compassScale: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUSD: number
  totalSavedUSD: number
  cacheReadTokens: number
  cacheWriteTokens: number
  contextPercent: number
  contextTokens: number
  contextWindow: number
  lastCommitSummary: string
  lastReviewSummary: string
  pendingSteer: string
  statusLabel: StatusLabel
  agents: AgentSnapshot[]
  recentSummaries: string[]
}

export type StatusLabel = 'READY' | 'RUNNING' | 'REVIEW' | 'REWRITE' | 'COMPLETE' | 'PAUSED' | 'PAUSING' | 'ERROR'

export interface OutlineItem {
  chapter: number
  title: string
  coreEvent: string
}

export interface AgentSnapshot {
  name: string
  state: 'running' | 'idle' | 'failed'
  taskKind: string
  summary: string
  tool: string
}

export interface EventItem {
  time: string
  category: 'DISPATCH' | 'DONE' | 'TOOL' | 'ERROR' | 'SYSTEM' | 'USER' | 'CONTEXT' | 'COMPACT' | 'REVIEW' | 'CHECK' | 'AGENT'
  summary: string
  detail: string
  agent: string
  depth: number
  level: 'info' | 'warn' | 'error' | 'success' | 'debug'
  duration: number
}

export interface ChapterInfo {
  num: number
  title: string
  wordCount: number
}

export type AppMode = 'welcome' | 'idle' | 'running' | 'paused' | 'completed'

export type StartupMode = 'quick' | 'cocreate'

export type FocusPane = 'events' | 'stream' | 'detail' | 'state'

export interface BinaryInfo {
  available: boolean
  version: string
  path: string
}

// 状态标签配置
export const STATUS_CONFIG: Record<StatusLabel, { icon: string; label: string; color: string }> = {
  READY:    { icon: '○', label: '就绪',     color: '#8a8175' },
  RUNNING:  { icon: '',  label: '运行中',   color: '#b5d075' },
  REVIEW:   { icon: '◆', label: '审阅',     color: '#e09b5a' },
  REWRITE:  { icon: '◆', label: '返工',     color: '#e09b5a' },
  COMPLETE: { icon: '●', label: '完成',     color: '#7ec488' },
  PAUSED:   { icon: '⏸', label: '暂停',     color: '#e5b449' },
  PAUSING:  { icon: '⏸', label: '暂停中',   color: '#e5b449' },
  ERROR:    { icon: '✕', label: '错误',     color: '#e07060' },
}

export const FLOW_LABELS: Record<string, string> = {
  '': '-',
  writing: '写作',
  reviewing: '评审',
  rewriting: '重写',
  polishing: '打磨',
  steering: '干预',
}

export const AGENT_DISPLAY: Record<string, string> = {
  architect: '架构师',
  coordinator: '协调器',
  writer: '写手',
  editor: '编辑',
}

export const AGENT_COLORS: Record<string, string> = {
  architect: '#5fb8a3',
  coordinator: '#e5b449',
  writer: '#7ec5d8',
  editor: '#e09b5a',
}

export const AGENT_TASK_LABELS: Record<string, string> = {
  foundation_plan: '基础规划',
  chapter_write: '章节写作',
  chapter_review: '章节评审',
  chapter_rewrite: '章节重写',
  chapter_polish: '章节打磨',
  arc_expand: '弧展开',
  volume_append: '下一卷规划',
  steer_apply: '处理干预',
  coordinator_decision: '协调推进',
}

export const CATEGORY_COLORS: Record<string, string> = {
  DISPATCH: '#e5b449',
  DONE: '#7ec488',
  TOOL: '#7ec5d8',
  SYSTEM: '#e5b449',
  USER: '#5fb8a3',
  REVIEW: '#e09b5a',
  CHECK: '#7ec488',
  ERROR: '#e07060',
  AGENT: '#b8b09c',
  CONTEXT: '#a890d8',
  COMPACT: '#a890d8',
}

/** 事件摘要中英文 → 中文映射 */
export const EVENT_SUMMARY_LABELS: Record<string, string> = {
  // 工具调用
  edit_chapter: '编辑章节',
  read_chapter: '读取章节',
  commit_chapter: '提交章节',
  check_consistency: '一致性检查',
  novel_context: '小说上下文',
  save_user_rules: '保存用户规则',
  load_user_rules: '加载用户规则',
  update_outline: '更新大纲',
  update_characters: '更新角色',
  update_timeline: '更新时间线',
  update_compass: '更新指南针',
  get_premise: '读取前提',
  get_outline: '读取大纲',
  get_characters: '读取角色',
  get_chapter: '读取章节',
  list_chapters: '章节列表',
  search_memory: '搜索记忆',
  // 策略
  tool_result_microcompact: '工具结果微压缩',
  tool_result_truncate: '工具结果截断',
  context_compact: '上下文压缩',
  // Agent
  subagent: '子代理',
  writer: '写手',
  editor: '编辑',
  architect: '架构师',
  coordinator: '协调器',
  // 其他
  '恢复创作': '恢复创作',
  '写作': '写作',
  '评审': '评审',
  '重写': '重写',
}

/** 翻译事件摘要中的英文关键词为中文 */
export function translateEventSummary(summary: string): string {
  for (const [en, zh] of Object.entries(EVENT_SUMMARY_LABELS)) {
    if (summary.includes(en)) {
      return summary.replace(new RegExp(en, 'g'), zh)
    }
  }
  return summary
}
