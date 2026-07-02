export const PHASE_LABELS: Record<string, string> = {
  init: '初始化',
  premise: '前提',
  outline: '大纲',
  writing: '写作',
  complete: '完成',
}

export function getPhaseLabel(phase: string): string {
  return PHASE_LABELS[phase] || phase
}
