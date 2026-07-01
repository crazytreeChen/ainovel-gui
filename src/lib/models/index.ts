// 数据模型 — 基于 ainovel-cli internal/domain/*.go

// ── 枚举 ──

export type Phase = 'init' | 'premise' | 'outline' | 'writing' | 'complete'
export type FlowState = 'writing' | 'reviewing' | 'rewriting' | 'polishing' | 'steering'
export type PlanningTier = 'short' | 'mid' | 'long'
export type StyleType = 'default' | 'fantasy' | 'suspense' | 'romance'
export type CharacterTier = 'core' | 'important' | 'secondary' | 'decorative'
export type ForeshadowStatus = 'planted' | 'advanced' | 'resolved'
export type ReviewScope = 'chapter' | 'arc' | 'global'
export type ReviewVerdict = 'accept' | 'polish' | 'rewrite'
export type IssueSeverity = 'critical' | 'error' | 'warning'
export type CommitStage = 'started' | 'state_applied' | 'progress_marked' | 'signal_saved'
export type RuntimeQueuePriority = 'control' | 'background'
export type RuntimeQueueKind = 'ui_event' | 'stream_delta' | 'stream_clear' | 'control'

// ── Book（书籍元信息）──

export interface Book {
  id: string          // UUID
  name: string
  premise: string     // Markdown
  style: StyleType
  planningTier: PlanningTier
  phase: Phase
  flow: FlowState
  layered: boolean
  totalWordCount: number
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
  workspaceDir?: string  // 如果是从 ainovel-cli 目录打开的
}

// ── Progress（进度追踪）──

export interface Progress {
  novelName: string
  phase: Phase
  currentChapter: number
  totalChapters: number
  completedChapters: number[]
  totalWordCount: number
  chapterWordCounts: Record<number, number>
  inProgressChapter: number
  flow: FlowState
  pendingRewrites: number[]
  rewriteReason: string
  reopenedFromComplete: boolean
  currentVolume: number
  currentArc: number
  layered: boolean
  strandHistory: string[]
  hookHistory: string[]
}

// ── Outline（大纲）──

export interface OutlineEntry {
  chapter: number
  title: string
  coreEvent: string
  hook: string
  scenes: string[]
}

export interface VolumeOutline {
  index: number
  title: string
  theme: string
  arcs: ArcOutline[]
}

export interface ArcOutline {
  index: number
  title: string
  goal: string
  estimatedChapters?: number
  chapters: OutlineEntry[]
}

export interface StoryCompass {
  endingDirection: string
  openThreads: string[]
  estimatedScale: string
  lastUpdated: number
}

// ── Chapter（章节）──

export interface ChapterPlan {
  chapter: number
  title: string
  goal: string
  conflict: string
  hook: string
  emotionArc: string
  notes: string
  contract: ChapterContract
}

export interface ChapterContract {
  requiredBeats: string[]
  forbiddenMoves: string[]
  continuityChecks: string[]
  evaluationFocus: string[]
  emotionTarget: string
  payoffPoints: string[]
  hookGoal: string
}

export interface ChapterSummary {
  chapter: number
  summary: string
  characters: string[]
  keyEvents: string[]
}

export interface CommitResult {
  chapter: number
  committed: boolean
  wordCount: number
  nextChapter: number
  reviewRequired: boolean
  reviewReason: string
  hookType: string
  dominantStrand: string
  arcEnd: boolean
  volumeEnd: boolean
  volume: number
  arc: number
  needsExpansion: boolean
  needsNewVolume: boolean
  nextVolume: number
  nextArc: number
  bookComplete: boolean
  flow: string
}

export interface PendingCommit {
  chapter: number
  stage: CommitStage
  summary: string
  hookType: string
  dominantStrand: string
  result?: CommitResult
  startedAt: string
  updatedAt: string
}

// ── Character（角色）──

export interface Character {
  name: string
  aliases: string[]
  role: string
  tier: CharacterTier
  description: string
  arc: string
  traits: string[]
}

export interface CharacterSnapshot {
  volume: number
  arc: number
  name: string
  status: string
  power: string
  motivation: string
  relations: string
}

export interface CastEntry {
  name: string
  aliases: string[]
  briefRole: string
  firstSeenChapter: number
  lastSeenChapter: number
  appearanceCount: number
  appearanceChapters: number[]
  promoted: boolean
}

export interface CastIntro {
  name: string
  briefRole: string
}

// ── Timeline（时间线）──

export interface TimelineEvent {
  chapter: number
  time: string
  event: string
  characters: string[]
}

export interface ForeshadowEntry {
  id: string
  description: string
  plantedAt: number
  status: ForeshadowStatus
  resolvedAt?: number
}

export interface ForeshadowUpdate {
  id: string
  action: 'plant' | 'advance' | 'resolve'
  description: string
}

export interface RelationshipEntry {
  characterA: string
  characterB: string
  relation: string
  chapter: number
}

export interface StateChange {
  chapter: number
  entity: string
  field: string
  oldValue: string
  newValue: string
  reason: string
}

// ── Review（评审）──

export interface ReviewEntry {
  chapter: number
  scope: ReviewScope
  issues: ConsistencyIssue[]
  dimensions: DimensionScore[]
  contractStatus: string
  contractMisses: string[]
  contractNotes: string
  verdict: ReviewVerdict
  summary: string
  affectedChapters: number[]
}

export interface DimensionScore {
  dimension: string  // consistency / character / pacing / continuity / foreshadow / hook / aesthetic
  score: number      // 0-100
  verdict: 'pass' | 'warning' | 'fail'
  comment: string
}

export interface ConsistencyIssue {
  type: string
  severity: IssueSeverity
  description: string
  evidence: string
  suggestion: string
}

// ── Writing Style（风格）──

export interface WritingStyleRules {
  volume: number
  arc: number
  prose: string[]
  dialogue: CharacterVoice[]
  taboos: string[]
  updatedAt: string
}

export interface CharacterVoice {
  name: string
  rules: string[]
}

export interface ArcSummary {
  volume: number
  arc: number
  title: string
  summary: string
  keyEvents: string[]
}

export interface VolumeSummary {
  volume: number
  title: string
  summary: string
  keyEvents: string[]
}

// ── World（世界观）──

export interface WorldRule {
  category: string   // magic / technology / geography / society / other
  rule: string
  boundary: string
}

// ── Simulation（仿写画像）──

export interface SimulationProfile {
  version: string       // "simulation_profile.v1"
  createdAt: string
  updatedAt: string
  corpus: SimulationCorpusManifest
  sourceReports: SimulationSourceReport[]
  synthesis: SimulationSynthesis
}

export interface SimulationCorpusManifest {
  sourceDir: string
  sources: SimulationSource[]
}

export interface SimulationSource {
  relativePath: string
  sha256: string
  fingerprint: string
  sizeBytes: number
  modTime: string
  analyzedAt: string
}

export interface SimulationSourceReport {
  relativePath: string
  sha256: string
  title: string
  summary: string
  styleObservations: string[]
  commonWords: string[]
  plotPatterns: string[]
  hookPatterns: string[]
  pacingNotes: string[]
  readerAppeal: string[]
  reusableTechniques: string[]
  warnings: string[]
}

export interface SimulationSynthesis {
  style: SimulationStyle
  lexicon: SimulationLexicon
  plotDesign: SimulationPlotDesign
  hookDesign: SimulationHookDesign
  pacingDensity: SimulationPacingDensity
  readerEngagement: SimulationReaderEngagement
  roleGuidance: SimulationRoleGuidance
}

export interface SimulationStyle {
  narrativeVoice: string[]
  sentenceRhythm: string[]
  proseTexture: string[]
  perspective: string[]
  mood: string[]
  doNotCopy: string[]
}

export interface SimulationLexicon {
  commonWords: string[]
  emotionWords: string[]
  sceneWords: string[]
  transitionWords: string[]
  signaturePhrases: string[]
}

export interface SimulationPlotDesign {
  openingPatterns: string[]
  escalationPatterns: string[]
  turningPointPatterns: string[]
  payoffPatterns: string[]
}

export interface SimulationHookDesign {
  hookTypes: string[]
  placement: string[]
  cliffhangerPatterns: string[]
  payoffRules: string[]
}

export interface SimulationPacingDensity {
  sceneDensity: string[]
  informationRelease: string[]
  dialogueActionRatio: string[]
  compressionRules: string[]
}

export interface SimulationReaderEngagement {
  methods: string[]
  emotionalDrivers: string[]
  progressionRewards: string[]
  antiPatterns: string[]
}

export interface SimulationRoleGuidance {
  coordinator: string[]
  architect: string[]
  writer: string[]
  editor: string[]
}

// ── Runtime（运行时）──

export interface RunMeta {
  startedAt: string
  provider: string
  style: string
  model: string
  planningTier: PlanningTier
  steerHistory: SteerEntry[]
  pendingSteer: string
}

export interface SteerEntry {
  input: string
  timestamp: string
}

export interface RuntimeQueueItem {
  seq: number
  time: string
  kind: RuntimeQueueKind
  priority: RuntimeQueuePriority
  taskID: string
  agent: string
  category: string
  summary: string
  payload: any
}

// ── Checkpoint（检查点）──

export interface Checkpoint {
  seq: number
  scope: CheckpointScope
  step: string
  artifact: string
  digest: string
  occurredAt: string
}

export interface CheckpointScope {
  kind: 'chapter' | 'arc' | 'volume' | 'global'
  chapter?: number
  volume?: number
  arc?: number
}

// ── Usage（用量）──

export interface UsageState {
  schema: number
  updatedAt: string
  overall: AgentUsageTotals
  perAgent: Record<string, AgentUsageTotals>
  perModel: Record<string, AgentUsageTotals>
  missingUsage: number
}

export interface AgentUsageTotals {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  cost: number
  saved: number
  cacheCapable: boolean
}

// ── User Rules（用户规则）──

export interface UserRulesSnapshot {
  version: number
  status: 'ready' | 'degraded'
  structured: UserRulesStructured
  preferences: string
  sources: string[]
  uncertain: string[]
}

export interface UserRulesStructured {
  genre?: string
  chapterWords?: WordRange
  forbiddenChars: string[]
  forbiddenPhrases: string[]
  fatigueWords: Record<string, number>
}

export interface WordRange {
  min: number
  max: number
}

export interface Violation {
  rule: string
  target: string
  limit: any
  actual: any
  deviation: number
  severity: 'error' | 'warning'
}
