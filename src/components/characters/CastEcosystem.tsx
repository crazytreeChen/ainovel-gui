import type { Character, CastEntry, Relation } from '@/types/characters'

interface CastEcosystemProps {
  chars: Character[]
  cast: CastEntry[]
  relations: Relation[]
}

export default function CastEcosystem({ chars, cast, relations }: CastEcosystemProps) {
  const castMap = new Map(cast.map(c => [c.name, c.name]))
  const charNames = new Set(chars.map(c => c.name))

  if (cast.length === 0) {
    return (
      <div className="flex-1 flex-col flex-center text-dim">
        <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>🌿</div>
        <div style={{ fontSize: 14 }}>暂无配角生态数据</div>
        <div className="text-xs mt-8">配角由创作引擎在写作过程中自动记录</div>
      </div>
    )
  }

  const chapterGroups: Record<number, string[]> = {}
  for (const c of cast) {
    for (const ch of (c.appearanceChapters || [])) {
      if (!chapterGroups[ch]) chapterGroups[ch] = []
      chapterGroups[ch].push(c.name)
    }
  }
  const pairCount = new Map<string, number>()
  for (const [ch, names] of Object.entries(chapterGroups)) {
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const key = [names[i], names[j]].sort().join('||')
        pairCount.set(key, (pairCount.get(key) || 0) + 1)
      }
    }
  }
  const topPairs = [...pairCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)

  const charRels: Record<string, { target: string; count: number }[]> = {}
  for (const r of relations) {
    if (!charRels[r.character_a]) charRels[r.character_a] = []
    if (!charRels[r.character_b]) charRels[r.character_b] = []
    const e1 = charRels[r.character_a].find(e => e.target === r.character_b)
    if (e1) e1.count++; else charRels[r.character_a].push({ target: r.character_b, count: 1 })
    const e2 = charRels[r.character_b].find(e => e.target === r.character_a)
    if (e2) e2.count++; else charRels[r.character_b].push({ target: r.character_a, count: 1 })
  }

  return (
    <div className="flex-1 scroll-y">
      <div className="flex-row gap-12 mb-16">
        <div className="panel-surface flex-1 text-center">
          <div className="text-accent mono text-lg">{cast.length}</div>
          <div className="text-dim text-xs">配角总数</div>
        </div>
        <div className="panel-surface flex-1 text-center">
          <div className="text-accent mono text-lg">{cast.filter(c => c.promoted).length}</div>
          <div className="text-dim text-xs">已晋级</div>
        </div>
        <div className="panel-surface flex-1 text-center">
          <div className="text-accent mono text-lg">{topPairs.length}</div>
          <div className="text-dim text-xs">关联对</div>
        </div>
      </div>

      <div className="mb-16">
        <div className="sidebar-section-header mb-8">🥇 出场频次 TOP 10</div>
        <div className="flex-col gap-4">
          {[...cast].sort((a, b) => b.appearanceCount - a.appearanceCount).slice(0, 10).map((c, i) => {
            const maxCount = Math.max(...cast.map(x => x.appearanceCount), 1)
            return (
              <div key={c.name} className="flex-row items-center gap-8">
                <span className="text-dim mono text-xs" style={{ width: 20 }}>#{i + 1}</span>
                <span className="text-sm" style={{ width: 120, fontWeight: 'bold' }}>{c.name}</span>
                <div className="flex-1" style={{ height: 14, background: 'var(--color-surface-2)', borderRadius: 7, overflow: 'hidden' }}>
                  <div style={{ width: `${(c.appearanceCount / maxCount) * 100}%`, height: '100%', background: c.promoted ? 'var(--color-accent)' : 'var(--color-accent2)', borderRadius: 7, transition: 'width 0.3s' }} />
                </div>
                <span className="text-dim mono text-xs text-right" style={{ width: 40 }}>{c.appearanceCount}次</span>
              </div>
            )
          })}
        </div>
      </div>

      {topPairs.length > 0 && (
        <div className="mb-16">
          <div className="sidebar-section-header mb-8">🔗 同章关联网络</div>
          <div className="flex-row flex-wrap" style={{ gap: 6 }}>
            {topPairs.map(([key, count]) => {
              const [a, b] = key.split('||')
              const aPromoted = cast.find(c => c.name === a)?.promoted
              const bPromoted = cast.find(c => c.name === b)?.promoted
              return (
                <div key={key} className="panel-surface-2 flex-row items-center text-sm" style={{ gap: 6 }}>
                  <span style={{ color: aPromoted ? 'var(--color-accent)' : 'var(--color-text)', fontWeight: 'bold' }}>{a}</span>
                  <span className="text-dim">↔</span>
                  <span style={{ color: bPromoted ? 'var(--color-accent)' : 'var(--color-text)', fontWeight: 'bold' }}>{b}</span>
                  <span className="text-dim text-xs">{count}章</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {relations.length > 0 && (
        <div>
          <div className="sidebar-section-header mb-8">🕸️ 配角关联关系</div>
          <div className="flex-col" style={{ gap: 6 }}>
            {cast.map(c => {
              const rels = charRels[c.name] || []
              if (rels.length === 0) return null
              const filtered = rels.filter(r => charNames.has(r.target) || castMap.has(r.target)).slice(0, 5)
              if (filtered.length === 0) return null
              return (
                <div key={c.name} className="panel-surface text-sm">
                  <div className="flex-row items-center gap-8 mb-8">
                    <span style={{ fontWeight: 'bold', color: c.promoted ? 'var(--color-accent)' : 'var(--color-text)' }}>{c.name}</span>
                    <span className="text-dim text-xs">出场 {c.appearanceCount} 次</span>
                    {c.promoted && <span className="text-accent tag-sm" style={{ border: '1px solid var(--color-accent)' }}>晋级</span>}
                  </div>
                  <div className="flex-row flex-wrap gap-4">
                    {filtered.map(rel => (
                      <span key={rel.target} className="text-dim" style={{ padding: '2px 8px', background: 'var(--color-surface-2)', borderRadius: 10, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {rel.target}
                        <span className="mono text-2xs" style={{ color: 'var(--color-muted)' }}>×{rel.count}</span>
                      </span>
                    ))}
                    {rels.length > 5 && <span className="text-dim text-xs">+{rels.length - 5}...</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
