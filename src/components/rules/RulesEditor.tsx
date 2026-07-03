interface RulesEditorProps {
  data: {
    forbiddenCharacters: string[]
    forbiddenPhrases: string[]
    wordCountRange: { min: number; max: number }
    fatigueWords: string[]
  }
  onUpdate: (updates: any) => void
  onAddForbiddenChar: () => void
  onRemoveForbiddenChar: (index: number) => void
  onAddForbiddenPhrase: () => void
  onRemoveForbiddenPhrase: (index: number) => void
  onAddFatigueWord: () => void
  onRemoveFatigueWord: (word: string) => void
}

export default function RulesEditor({ data, onUpdate, onAddForbiddenChar, onRemoveForbiddenChar, onAddForbiddenPhrase, onRemoveForbiddenPhrase, onAddFatigueWord, onRemoveFatigueWord }: RulesEditorProps) {
  return (
    <div>
      <Section title="字数范围">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
          <input type="number" value={data.wordCountRange.min || ''} onChange={e => onUpdate({ wordCountRange: { ...data.wordCountRange, min: parseInt(e.target.value) || 0 } })}
            style={{ width: 80, padding: '4px 8px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 12 }} />
          <span className="text-dim">~</span>
          <input type="number" value={data.wordCountRange.max || ''} onChange={e => onUpdate({ wordCountRange: { ...data.wordCountRange, max: parseInt(e.target.value) || 0 } })}
            style={{ width: 80, padding: '4px 8px', background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontSize: 12 }} />
          <span className="text-dim">字</span>
        </div>
      </Section>

      <Section title="禁用角色" onAdd={onAddForbiddenChar}>
        {(data.forbiddenCharacters || []).map((item, i) => (
          <Tag key={item} label={item} onRemove={() => onRemoveForbiddenChar(i)} />
        ))}
        {(!data.forbiddenCharacters || data.forbiddenCharacters.length === 0) && <EmptyHint />}
      </Section>

      <Section title="禁用短语" onAdd={onAddForbiddenPhrase}>
        {(data.forbiddenPhrases || []).map((item, i) => (
          <Tag key={item} label={item} onRemove={() => onRemoveForbiddenPhrase(i)} />
        ))}
        {(!data.forbiddenPhrases || data.forbiddenPhrases.length === 0) && <EmptyHint />}
      </Section>

      <Section title="易疲劳词" onAdd={onAddFatigueWord}>
        {(data.fatigueWords || []).map((word) => (
          <Tag key={word} label={word} onRemove={() => onRemoveFatigueWord(word)} />
        ))}
        {(!data.fatigueWords || data.fatigueWords.length === 0) && <EmptyHint />}
      </Section>
    </div>
  )
}

function Section({ title, children, onAdd }: { title: string; children: React.ReactNode; onAdd?: () => void }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="sidebar-section-header" style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span>{title}</span>
        {onAdd && <button onClick={onAdd} className="text-accent" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>+</button>}
      </div>
      {children}
    </div>
  )
}

function Tag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, margin: 2, padding: '2px 8px', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
      {label}
      <button onClick={onRemove} className="text-dim" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
    </span>
  )
}

function EmptyHint() {
  return <span className="text-dim" style={{ fontSize: 12 }}>（无）</span>
}
