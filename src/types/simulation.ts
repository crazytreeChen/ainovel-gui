// ── 仿写画像类型定义（从 SimulationPage 抽出） ──

export interface SimulationSource { relativePath: string; title: string; sizeBytes: number }

export interface SimulationSourceReport {
  relativePath: string; sha256: string; title: string; summary: string
  styleObservations: string[]; commonWords: string[]; plotPatterns: string[]
  hookPatterns: string[]; pacingNotes: string[]; readerAppeal: string[]
  reusableTechniques: string[]; warnings: string[]
}

export type SynthesisKey = 'style' | 'lexicon' | 'plotDesign' | 'hookDesign' | 'pacingDensity' | 'readerEngagement' | 'roleGuidance'

export interface SimulationProfile {
  version: string; createdAt: string; updatedAt: string
  corpus: { sourceDir: string; sources: SimulationSource[] }
  sourceReports: SimulationSourceReport[]
  synthesis?: Record<SynthesisKey, Record<string, string[]>>
}

// ── 分类元数据 ──

export const SYNTHESIS_TABS: ReadonlyArray<{ key: SynthesisKey; label: string; color: string }> = [
  { key: 'style', label: '风格', color: '#7ec5d8' },
  { key: 'lexicon', label: '词汇', color: '#7ec488' },
  { key: 'plotDesign', label: '情节设计', color: '#e09b5a' },
  { key: 'hookDesign', label: '钩子设计', color: '#e5b449' },
  { key: 'pacingDensity', label: '节奏密度', color: '#a890d8' },
  { key: 'readerEngagement', label: '读者互动', color: '#e07060' },
  { key: 'roleGuidance', label: 'Agent 指南', color: '#5fb8a3' },
]

export const FIELD_LABELS: Record<string, Record<string, string>> = {
  style: { narrativeVoice: '叙事视角', sentenceRhythm: '句子节奏', proseTexture: '描写质感', perspective: '视点', mood: '情绪基调', doNotCopy: '禁止模仿' },
  lexicon: { commonWords: '常用词汇', emotionWords: '情感词汇', sceneWords: '场景词汇', transitionWords: '过渡表达', signaturePhrases: '标志短语' },
  plotDesign: { openingPatterns: '开篇模式', escalationPatterns: '升级模式', turningPointPatterns: '转折模式', payoffPatterns: '收束模式' },
  hookDesign: { hookTypes: '钩子类型', placement: '放置位置', cliffhangerPatterns: '悬念模式', payoffRules: '收束规则' },
  pacingDensity: { sceneDensity: '场景密度', informationRelease: '信息释放', dialogueActionRatio: '对白动作比', compressionRules: '压缩规则' },
  readerEngagement: { methods: '方法', emotionalDrivers: '情感驱动', progressionRewards: '进度奖励', antiPatterns: '反模式' },
  roleGuidance: { coordinator: '协调 Agent', architect: '架构 Agent', writer: '写作 Agent', editor: '编辑 Agent' },
}
