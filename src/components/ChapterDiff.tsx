import { useMemo } from 'react'
import { diffLines, type Change } from 'diff'

interface Props {
  oldText: string
  newText: string
}

export default function ChapterDiff({ oldText, newText }: Props) {
  const changes: Change[] = useMemo(() => diffLines(oldText, newText), [oldText, newText])

  let lineNumA = 0
  let lineNumB = 0

  return (
    <div className="scroll-y" style={{
      flex: 1, width: '100%', fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6,
      background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
      overflow: 'auto',
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', fontSize: 11, position: 'sticky', top: 0, background: 'var(--color-surface)' }}>
        <div style={{ width: 48, textAlign: 'center', borderRight: '1px solid var(--color-border)', padding: '2px 0', color: 'var(--color-dim)' }}>原稿</div>
        <div style={{ width: 48, textAlign: 'center', borderRight: '1px solid var(--color-border)', padding: '2px 0', color: 'var(--color-dim)' }}>新稿</div>
        <div style={{ flex: 1, padding: '2px 8px', color: 'var(--color-dim)' }}>差异</div>
      </div>
      {changes.map((change, i) => {
        const lines = change.value.replace(/\n$/, '').split('\n')
        return lines.map((line, li) => {
          const added = change.added
          const removed = change.removed
          const lineA = removed ? ++lineNumA : null
          const lineB = added ? ++lineNumB : null
          if (!removed && !added) { lineNumA++; lineNumB++ }
          return (
            <div key={`${i}-${li}`} style={{
              display: 'flex',
              background: added ? 'rgba(126,196,136,0.08)' : removed ? 'rgba(224,112,96,0.08)' : 'transparent',
            }}>
              <div style={{
                width: 48, textAlign: 'center', borderRight: '1px solid var(--color-border)',
                color: removed ? 'var(--color-error)' : 'var(--color-dim)', fontSize: 11,
                userSelect: 'none', padding: '0 4px',
              }}>{lineA || ''}</div>
              <div style={{
                width: 48, textAlign: 'center', borderRight: '1px solid var(--color-border)',
                color: added ? 'var(--color-success)' : 'var(--color-dim)', fontSize: 11,
                userSelect: 'none', padding: '0 4px',
              }}>{lineB || ''}</div>
              <div style={{
                flex: 1, padding: '0 8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                color: added ? '#7ec488' : removed ? '#e07060' : 'var(--color-text)',
                textDecoration: removed ? 'line-through' : 'none',
              }}>{line}</div>
            </div>
          )
        })
      })}
    </div>
  )
}
