import path from 'path'
import { IO } from './io'
import type {
  Progress, OutlineEntry, VolumeOutline, StoryCompass, Character,
  CharacterSnapshot, CastEntry, TimelineEvent, ForeshadowEntry,
  ForeshadowUpdate, RelationshipEntry, StateChange, WorldRule,
  WritingStyleRules, ReviewEntry, ChapterPlan, ChapterSummary,
  Checkpoint, CheckpointScope, CommitResult, ReviewScope,
  RunMeta, SteerEntry, UsageState, UserRulesSnapshot, Book,
  SimulationProfile, ArcSummary, VolumeSummary, RuntimeQueueItem,
} from '@/lib/models'

// ── IO 工具 ──

class IOWithLock extends IO {
  // ainovel-cli 使用 RWMutex，这里简化用 async 顺序保证
}

// ── ProgressStore ──

export class ProgressStore {
  constructor(private io: IO) {}
  async load(): Promise<Progress | null> { return this.io.readJSON<Progress>('meta/progress.json') }
  async save(p: Progress): Promise<void> { return this.io.writeJSON('meta/progress.json', p) }
  async init(name: string, total: number): Promise<void> {
    return this.save({
      novelName: name, phase: 'init', currentChapter: 0, totalChapters: total,
      completedChapters: [], totalWordCount: 0, chapterWordCounts: {},
      inProgressChapter: 0, flow: 'writing', pendingRewrites: [],
      rewriteReason: '', reopenedFromComplete: false,
      currentVolume: 0, currentArc: 0, layered: false,
      strandHistory: [], hookHistory: [],
    })
  }
}

// ── OutlineStore ──

export class OutlineStore {
  constructor(private io: IO) {}
  async savePremise(content: string): Promise<void> { return this.io.writeMarkdown('premise.md', content) }
  async loadPremise(): Promise<string | null> { return this.io.readText('premise.md') }
  async saveOutline(entries: OutlineEntry[]): Promise<void> { return this.io.writeJSON('outline.json', entries) }
  async loadOutline(): Promise<OutlineEntry[] | null> { return this.io.readJSON<OutlineEntry[]>('outline.json') }
  async saveLayeredOutline(volumes: VolumeOutline[]): Promise<void> { return this.io.writeJSON('layered_outline.json', volumes) }
  async loadLayeredOutline(): Promise<VolumeOutline[] | null> { return this.io.readJSON<VolumeOutline[]>('layered_outline.json') }
  async saveCompass(compass: StoryCompass): Promise<void> { return this.io.writeJSON('compass.json', compass) }
  async loadCompass(): Promise<StoryCompass | null> { return this.io.readJSON<StoryCompass>('compass.json') }
}

// ── DraftStore ──

export class DraftStore {
  constructor(private io: IO) {}
  async saveChapterPlan(plan: ChapterPlan): Promise<void> { return this.io.writeJSON(`drafts/${String(plan.chapter).padStart(2, '0')}.plan.json`, plan) }
  async loadChapterPlan(chapter: number): Promise<ChapterPlan | null> { return this.io.readJSON<ChapterPlan>(`drafts/${String(chapter).padStart(2, '0')}.plan.json`) }
  async saveDraft(chapter: number, content: string): Promise<void> { return this.io.writeMarkdown(`drafts/${String(chapter).padStart(2, '0')}.draft.md`, content) }
  async loadDraft(chapter: number): Promise<string | null> { return this.io.readText(`drafts/${String(chapter).padStart(2, '0')}.draft.md`) }
  async saveFinalChapter(chapter: number, content: string): Promise<void> { return this.io.writeMarkdown(`chapters/${String(chapter).padStart(2, '0')}.md`, content) }
  async loadChapterText(chapter: number): Promise<string | null> { return this.io.readText(`chapters/${String(chapter).padStart(2, '0')}.md`) }
}

// ── SummaryStore ──

export class SummaryStore {
  constructor(private io: IO) {}
  async saveSummary(s: ChapterSummary): Promise<void> { return this.io.writeJSON(`summaries/${String(s.chapter).padStart(2, '0')}.json`, s) }
  async loadSummary(chapter: number): Promise<ChapterSummary | null> { return this.io.readJSON<ChapterSummary>(`summaries/${String(chapter).padStart(2, '0')}.json`) }
  async loadRecentSummaries(current: number, count: number): Promise<ChapterSummary[]> {
    const result: ChapterSummary[] = []
    for (let ch = Math.max(current - count, 1); ch < current; ch++) {
      const s = await this.loadSummary(ch)
      if (s) result.push(s)
    }
    return result
  }
  async saveArcSummary(s: ArcSummary): Promise<void> { return this.io.writeJSON(`summaries/arc-v${String(s.volume).padStart(2, '0')}a${String(s.arc).padStart(2, '0')}.json`, s) }
  async loadArcSummary(volume: number, arc: number): Promise<ArcSummary | null> { return this.io.readJSON<ArcSummary>(`summaries/arc-v${String(volume).padStart(2, '0')}a${String(arc).padStart(2, '0')}.json`) }
  async saveVolumeSummary(s: VolumeSummary): Promise<void> { return this.io.writeJSON(`summaries/vol-v${String(s.volume).padStart(2, '0')}.json`, s) }
  async loadVolumeSummary(volume: number): Promise<VolumeSummary | null> { return this.io.readJSON<VolumeSummary>(`summaries/vol-v${String(volume).padStart(2, '0')}.json`) }
}

// ── CharacterStore ──

export class CharacterStore {
  constructor(private io: IO) {}
  async save(chars: Character[]): Promise<void> {
    await this.io.writeJSON('characters.json', chars)
    await this.io.writeMarkdown('characters.md', renderCharacters(chars))
  }
  async load(): Promise<Character[] | null> { return this.io.readJSON<Character[]>('characters.json') }
  async saveSnapshots(volume: number, arc: number, snapshots: CharacterSnapshot[]): Promise<void> { return this.io.writeJSON(`meta/snapshots/v${String(volume).padStart(2, '0')}a${String(arc).padStart(2, '0')}.json`, snapshots) }
  async loadSnapshots(volume: number, arc: number): Promise<CharacterSnapshot[] | null> { return this.io.readJSON<CharacterSnapshot[]>(`meta/snapshots/v${String(volume).padStart(2, '0')}a${String(arc).padStart(2, '0')}.json`) }
}

function renderCharacters(chars: Character[]): string {
  let md = '# 角色档案\n\n'
  for (const c of chars) {
    md += `## ${c.name}（${c.role}）\n\n${c.description}\n\n`
    if (c.arc) md += `**角色弧线**：${c.arc}\n\n`
    if (c.traits.length) md += `**特征**：${c.traits.join('、')}\n\n`
  }
  return md
}

// ── CastStore ──

export class CastStore {
  constructor(private io: IO) {}
  async load(): Promise<CastEntry[] | null> { return this.io.readJSON<CastEntry[]>('meta/cast_ledger.json') }
  async save(entries: CastEntry[]): Promise<void> { return this.io.writeJSON('meta/cast_ledger.json', entries) }
}

// ── WorldStore ──

export class WorldStore {
  constructor(private io: IO) {}
  async saveTimeline(events: TimelineEvent[]): Promise<void> { return this.io.writeJSON('timeline.json', events) }
  async loadTimeline(): Promise<TimelineEvent[] | null> { return this.io.readJSON<TimelineEvent[]>('timeline.json') }
  async saveForeshadowLedger(entries: ForeshadowEntry[]): Promise<void> { return this.io.writeJSON('foreshadow_ledger.json', entries) }
  async loadForeshadowLedger(): Promise<ForeshadowEntry[] | null> { return this.io.readJSON<ForeshadowEntry[]>('foreshadow_ledger.json') }
  async saveRelationships(entries: RelationshipEntry[]): Promise<void> { return this.io.writeJSON('relationship_state.json', entries) }
  async loadRelationships(): Promise<RelationshipEntry[] | null> { return this.io.readJSON<RelationshipEntry[]>('relationship_state.json') }
  async saveStateChanges(changes: StateChange[]): Promise<void> { return this.io.writeJSON('meta/state_changes.json', changes) }
  async loadStateChanges(): Promise<StateChange[] | null> { return this.io.readJSON<StateChange[]>('meta/state_changes.json') }
  async saveWorldRules(rules: WorldRule[]): Promise<void> { return this.io.writeJSON('world_rules.json', rules) }
  async loadWorldRules(): Promise<WorldRule[] | null> { return this.io.readJSON<WorldRule[]>('world_rules.json') }
  async saveStyleRules(rules: WritingStyleRules): Promise<void> { return this.io.writeJSON('meta/style_rules.json', rules) }
  async loadStyleRules(): Promise<WritingStyleRules | null> { return this.io.readJSON<WritingStyleRules>('meta/style_rules.json') }
  async saveReview(r: ReviewEntry): Promise<void> { return this.io.writeJSON(`reviews/${r.chapter}.json`, r) }
  async loadReview(chapter: number): Promise<ReviewEntry | null> { return this.io.readJSON<ReviewEntry>(`reviews/${chapter}.json`) }
}

// ── CheckpointStore ──

export class CheckpointStore {
  private cache: Checkpoint[] = []
  constructor(private io: IO) {}
  async load(): Promise<void> {
    const text = await this.io.readText('meta/checkpoints.jsonl')
    if (!text) { this.cache = []; return }
    this.cache = text.split('\n').filter(Boolean).map(l => JSON.parse(l))
  }
  async append(scope: CheckpointScope, step: string, artifact: string = '', digest: string = ''): Promise<Checkpoint> {
    const cp: Checkpoint = {
      seq: this.cache.length + 1, scope, step, artifact, digest,
      occurredAt: new Date().toISOString(),
    }
    await this.io.appendLine('meta/checkpoints.jsonl', JSON.stringify(cp))
    this.cache.push(cp)
    return cp
  }
  latestGlobal(): Checkpoint | undefined { return this.cache.length > 0 ? this.cache[this.cache.length - 1] : undefined }
  all(): Checkpoint[] { return [...this.cache] }
}

// ── RunMetaStore ──

export class RunMetaStore {
  constructor(private io: IO) {}
  async load(): Promise<RunMeta | null> { return this.io.readJSON<RunMeta>('meta/run.json') }
  async save(meta: RunMeta): Promise<void> { return this.io.writeJSON('meta/run.json', meta) }
}

// ── UsageStore ──

export class UsageStore {
  constructor(private io: IO) {}
  async load(): Promise<UsageState | null> { return this.io.readJSON<UsageState>('meta/usage.json') }
  async save(state: UsageState): Promise<void> { return this.io.writeJSON('meta/usage.json', state) }
}

// ── UserRulesStore ──

export class UserRulesStore {
  constructor(private io: IO) {}
  async load(): Promise<UserRulesSnapshot | null> { return this.io.readJSON<UserRulesSnapshot>('meta/user_rules.json') }
  async save(snap: UserRulesSnapshot): Promise<void> { return this.io.writeJSON('meta/user_rules.json', snap) }
}

// ── SimulationStore ──

export class SimulationStore {
  constructor(private io: IO) {}
  async load(): Promise<SimulationProfile | null> { return this.io.readJSON<SimulationProfile>('meta/simulation_profile.json') }
  async save(profile: SimulationProfile): Promise<void> { return this.io.writeJSON('meta/simulation_profile.json', profile) }
}

// ── Store（组合根）──

export class Store {
  readonly dir: string
  readonly outline: OutlineStore
  readonly progress: ProgressStore
  readonly drafts: DraftStore
  readonly summaries: SummaryStore
  readonly characters: CharacterStore
  readonly cast: CastStore
  readonly world: WorldStore
  readonly checkpoints: CheckpointStore
  readonly runMeta: RunMetaStore
  readonly usage: UsageStore
  readonly userRules: UserRulesStore
  readonly simulation: SimulationStore

  constructor(baseDir: string) {
    this.dir = baseDir
    const io = new IO(baseDir)
    this.outline = new OutlineStore(io)
    this.progress = new ProgressStore(new IO(baseDir))
    this.drafts = new DraftStore(new IO(baseDir))
    this.summaries = new SummaryStore(new IO(baseDir))
    this.characters = new CharacterStore(new IO(baseDir))
    this.cast = new CastStore(new IO(baseDir))
    this.world = new WorldStore(new IO(baseDir))
    this.checkpoints = new CheckpointStore(new IO(baseDir))
    this.runMeta = new RunMetaStore(new IO(baseDir))
    this.usage = new UsageStore(new IO(baseDir))
    this.userRules = new UserRulesStore(new IO(baseDir))
    this.simulation = new SimulationStore(new IO(baseDir))
  }

  async init(): Promise<void> {
    const io = new IO(this.dir)
    await io.ensureDirs([
      'chapters', 'summaries', 'drafts', 'reviews',
      'meta', 'meta/snapshots', 'meta/runtime',
    ])
  }

  async foundationMissing(): Promise<string[]> {
    const missing: string[] = []
    if (!await this.outline.loadPremise()) missing.push('premise')
    const outline = await this.outline.loadOutline()
    if (!outline || outline.length === 0) missing.push('outline')
    const chars = await this.characters.load()
    if (!chars || chars.length === 0) missing.push('characters')
    const rules = await this.world.loadWorldRules()
    if (!rules || rules.length === 0) missing.push('world_rules')
    return missing
  }
}

// ── BookManager（书籍管理器）──

export class BookManager {
  private booksDir: string

  constructor(baseDir: string) {
    this.booksDir = baseDir
  }

  async listBooks(): Promise<Book[]> {
    const index = await new IO(this.booksDir).readJSON<{ books: Book[] }>('books/index.json')
    return index?.books || []
  }

  async getBook(id: string): Promise<Book | null> {
    const books = await this.listBooks()
    return books.find(b => b.id === id) || null
  }

  async createBook(name: string, style: string = 'default'): Promise<{ book: Book; store: Store }> {
    const id = crypto.randomUUID()
    const book: Book = {
      id, name, premise: '', style: style as any,
      planningTier: 'short', phase: 'init', flow: 'writing',
      layered: false, totalWordCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    }
    // 更新索引
    const index = await this.listBooks()
    index.push(book)
    await new IO(this.booksDir).writeJSON('books/index.json', { books: index })

    // 创建书籍目录并初始化
    const bookDir = new IO(path.join(this.booksDir, 'books', id))
    await bookDir.ensureDirs(['chapters', 'summaries', 'drafts', 'reviews', 'meta', 'meta/snapshots'])
    const store = new Store(path.join(this.booksDir, 'books', id))
    return { book, store }
  }

  async openFromWorkspace(workspaceDir: string): Promise<{ book: Book; store: Store }> {
    // 从 ainovel-cli 工作目录打开
    const progress = await new IO(workspaceDir).readJSON<Progress>('meta/progress.json')
    const id = crypto.randomUUID()
    const book: Book = {
      id, name: progress?.novelName || path.basename(workspaceDir),
      premise: '', style: 'default', planningTier: 'short',
      phase: progress?.phase || 'init', flow: progress?.flow || 'writing',
      layered: progress?.layered || false,
      totalWordCount: progress?.totalWordCount || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      workspaceDir,
    }
    const store = new Store(workspaceDir)
    return { book, store }
  }
}
