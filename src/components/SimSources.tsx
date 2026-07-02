import { useState } from 'react'
import type { SimulationSourceReport } from '@/types/simulation'
import SimTagList from './SimTagList'

interface SimSourcesProps {
  profile: { sourceReports?: SimulationSourceReport[] }
}

export default function SimSources({ profile }: SimSourcesProps) {
  const [expandedSource, setExpandedSource] = useState<number | null>(null)

  return (
    <div>
      {(profile.sourceReports || []).map((report, i) => (
        <SourceReportCard key={report.relativePath} report={report}
          index={i} expanded={expandedSource === i}
          onToggle={() => setExpandedSource(expandedSource === i ? null : i)} />
      ))}
      {(!profile.sourceReports || profile.sourceReports.length === 0) && (
        <div className="text-dim text-center mt-40 text-sm">暂无语料分析数据</div>
      )}
    </div>
  )
}

function SourceReportCard({ report, index, expanded, onToggle }: {
  report: SimulationSourceReport; index: number; expanded: boolean; onToggle: () => void
}) {
  return (
    <div className="card-sm mb-8 overflow-hidden">
      <div className="cursor-clickable flex-row items-center justify-between"
        onClick={onToggle} style={{ padding: '10px 14px' }}>
        <div>
          <span className="text-sm" style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>
            {report.title || report.relativePath}
          </span>
          <span className="text-dim text-xs ml-8">{report.relativePath}</span>
        </div>
        <span className="text-dim text-xs">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="card-sm" style={{ borderTop: '1px solid var(--color-border)' }}>
          {report.summary && (
            <div className="text-sm mb-10" style={{ lineHeight: 1.6 }}>
              <div className="sidebar-section-header text-xs mb-8">摘要</div>
              <div className="text-dim">{report.summary}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            {report.styleObservations?.length > 0 && (
              <div><div className="sidebar-section-header text-xs mb-4">风格观察</div>
                <SimTagList items={report.styleObservations} color="#7ec5d8" /></div>
            )}
            {report.commonWords?.length > 0 && (
              <div><div className="sidebar-section-header text-xs mb-4">常用词</div>
                <SimTagList items={report.commonWords} color="#7ec488" /></div>
            )}
            {report.plotPatterns?.length > 0 && (
              <div><div className="sidebar-section-header text-xs mb-4">情节模式</div>
                <SimTagList items={report.plotPatterns} color="#e09b5a" /></div>
            )}
            {report.hookPatterns?.length > 0 && (
              <div><div className="sidebar-section-header text-xs mb-4">钩子模式</div>
                <SimTagList items={report.hookPatterns} color="#e5b449" /></div>
            )}
            {report.pacingNotes?.length > 0 && (
              <div><div className="sidebar-section-header text-xs mb-4">节奏笔记</div>
                <SimTagList items={report.pacingNotes} color="#a890d8" /></div>
            )}
            {report.readerAppeal?.length > 0 && (
              <div><div className="sidebar-section-header text-xs mb-4">读者吸引力</div>
                <SimTagList items={report.readerAppeal} color="#e07060" /></div>
            )}
          </div>

          {report.reusableTechniques?.length > 0 && (
            <div className="mt-8">
              <div className="sidebar-section-header text-xs mb-4">可复用技巧</div>
              <SimTagList items={report.reusableTechniques} color="#5fb8a3" />
            </div>
          )}

          {report.warnings?.length > 0 && (
            <div className="mt-8 card-sm" style={{ background: 'rgba(224,112,96,0.1)' }}>
              <div className="text-xs" style={{ color: '#e07060', fontWeight: 'bold', marginBottom: 2 }}>⚠ 警告</div>
              <SimTagList items={report.warnings} color="#e07060" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
