// ── 角色管理共享类型和常量 ──

export interface Character {
  name: string; aliases: string[]; role: string
  tier: 'core' | 'important' | 'secondary' | 'decorative'
  description: string; arc: string; traits: string[]
}

export interface CastEntry {
  name: string; aliases: string[]; briefRole: string
  firstSeenChapter: number; lastSeenChapter: number
  appearanceCount: number; appearanceChapters: number[]; promoted: boolean
}

export interface Relation {
  character_a: string; character_b: string; relation: string; chapter: number
}

export const TIER_COLORS: Record<string, string> = {
  core: '#e5b449', important: '#7ec5d8', secondary: '#8a8175', decorative: '#5a5a5a',
}

export const TIER_LABELS: Record<string, string> = {
  core: '主角', important: '重要', secondary: '次要', decorative: '装饰',
}

export const RELATION_COLORS: Record<string, string> = {
  师徒: '#e5b449', 夫妻: '#e07060', 兄妹: '#7ec488',
  战友: '#7ec5d8', 仇敌: '#a890d8', 同僚: '#5fb8a3',
}

export const PLACEHOLDER_FACES = ['👤', '👥', '🧑', '👩', '👨', '🧔', '👵', '👴']
