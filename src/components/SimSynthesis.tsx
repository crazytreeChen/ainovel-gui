import { useState } from 'react'
import type { SimulationProfile, SynthesisKey } from '@/types/simulation'
import { SYNTHESIS_TABS, FIELD_LABELS } from '@/types/simulation'
import SimTagList from './SimTagList'
import SimSectionCard from './SimSectionCard'

interface SimSynthesisProps {
  profile: SimulationProfile
}

export default function SimSynthesis({ profile }: SimSynthesisProps) {
  const [synthTab, setSynthTab] = useState<SynthesisKey>('style')

  return (
    <div>
      {/* 综合画像子标签 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', flexShrink: 0 }}>
        {SYNTHESIS_TABS.map(({ key, label, color }) => (
          <button key={key}
            className={`welcome-mode-btn ${synthTab === key ? 'active' : ''}`}
            onClick={() => setSynthTab(key)}
            style={{ fontSize: 11, borderColor: synthTab === key ? color : undefined }}
          >{label}</button>
        ))}
      </div>

      {profile.synthesis ? (
        <div>
          {SYNTHESIS_TABS.filter(t => t.key === synthTab).map(({ key, label, color }) => {
            const data = profile.synthesis?.[key] || {}
            const fields = Object.keys(data)
            return (
              <div key={key}>
                <div style={{
                  color, fontSize: 16, fontWeight: 'bold', marginBottom: 12,
                  fontFamily: 'var(--font-mono)', letterSpacing: 1,
                }}>{label}</div>
                {fields.map(f => (
                  <SimSectionCard key={f} title={FIELD_LABELS[key]?.[f] || f} borderColor={color}>
                    <SimTagList items={data[f] || []} color={color} />
                  </SimSectionCard>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-dim" style={{ textAlign: 'center', marginTop: 40 }}>
          暂无综合画像数据
        </div>
      )}
    </div>
  )
}
