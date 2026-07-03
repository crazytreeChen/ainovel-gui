import type { SimulationProfile } from '@/types/simulation'
import { SYNTHESIS_TABS, FIELD_LABELS } from '@/types/simulation'

interface SimOverviewProps {
  profile: SimulationProfile
}

export default function SimOverview({ profile }: SimOverviewProps) {
  return (
    <div>
      <div className="card mb-10">
        <div className="sidebar-section-header text-sm mb-8">语料来源</div>
        <div className="text-sm" style={{ lineHeight: 1.8 }}>
          {(profile.corpus?.sources || []).map((src) => (
            <div key={src.relativePath} className="text-dim" style={{ padding: '2px 0' }}>
              <span className="text-accent fw-bold">{src.title || src.relativePath}</span>
              <span className="text-xs ml-8">{src.sizeBytes ? `${(src.sizeBytes / 1024).toFixed(0)}KB` : ''}</span>
            </div>
          ))}
        </div>
      </div>

      {profile.synthesis && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {SYNTHESIS_TABS.map(({ key, label, color }) => {
            const data = profile.synthesis?.[key] || {}
            const fields = Object.keys(data)
            return (
              <div key={key} className="card" style={{ border: `1px solid ${color}40` }}>
                <div className="mono text-sm mb-8" style={{ color, fontWeight: 'bold' }}>{label}</div>
                {fields.slice(0, 3).map(f => (
                  <div key={f} className="mb-8">
                    <div className="text-dim text-xs mb-4">{FIELD_LABELS[key]?.[f] || f}</div>
                    <div className="text-sm" style={{ lineHeight: 1.5 }}>
                      {(data[f] || []).slice(0, 4).map((item: string) => (
                        <span key={item} className="text-xs" style={{ display: 'inline-block', padding: '1px 6px', margin: 1, background: `${color}10`, color, borderRadius: 3 }}>{item}</span>
                      ))}
                      {(data[f] || []).length > 4 && <span className="text-dim text-xs">+{(data[f] || []).length - 4}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
