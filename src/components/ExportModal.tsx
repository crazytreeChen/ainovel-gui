import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'

interface ExportOption { key: string; label: string; desc: string; args: string }

const EXPORT_FORMATS: ExportOption[] = [
  { key: 'txt', label: 'TXT 纯文本', desc: '合并所有章节为单个 TXT 文件', args: '/format txt' },
  { key: 'epub', label: 'EPUB 电子书', desc: '生成标准 EPUB 格式电子书', args: '/format epub' },
  { key: 'markdown', label: 'Markdown', desc: '保留 Markdown 格式导出', args: '/format markdown' },
  { key: 'full', label: '完整项目', desc: '导出完整项目目录（含大纲/角色/时间线）', args: '/format full' },
]

export default function ExportModal() {
  const { id } = useParams<{ id: string }>()
  const toggleExport = useAppStore((s) => s.toggleExport)
  const runExport = useAppStore((s) => s.runExport)

  const [selected, setSelected] = useState('txt')
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState('')
  const [includeMetadata, setIncludeMetadata] = useState(false)
  const [chapterRange, setChapterRange] = useState('all')

  async function handleExport() {
    if (!id) return
    setRunning(true)
    setOutput('')
    const opt = EXPORT_FORMATS.find(f => f.key === selected)
    if (!opt) { setRunning(false); return }

    let args = opt.args
    if (includeMetadata) args += ' /metadata'
    if (chapterRange !== 'all') args += ` /chapters ${chapterRange}`

    try {
      const api = window.electronAPI
      if (api) {
        const result = await api.runExport(args)
        setOutput(result || '导出完成')
      }
    } catch (e: any) {
      setOutput('导出失败: ' + (e.message || '未知错误'))
    }
    setRunning(false)
  }

  return (
    <div className="modal-overlay" onClick={toggleExport}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: 520 }}>
        <button className="modal-close" onClick={toggleExport}>✕</button>
        <div className="modal-title">导出管理</div>

        <div className="mb-16">
          <div className="sidebar-section-header text-sm mb-8">导出格式</div>
          <div className="flex-col" style={{ gap: 6 }}>
            {EXPORT_FORMATS.map((fmt) => (
              <label key={fmt.key} className="cursor-clickable flex-row items-center gap-10"
                style={{ padding: '8px 12px', borderRadius: 'var(--radius)',
                  background: selected === fmt.key ? 'var(--color-surface-2)' : 'transparent',
                  border: `1px solid ${selected === fmt.key ? 'var(--color-accent)' : 'var(--color-border)'}`, cursor: 'pointer', transition: 'all 0.15s' }}>
                <input type="radio" name="export-format" checked={selected === fmt.key}
                  onChange={() => setSelected(fmt.key)} style={{ accentColor: 'var(--color-accent)' }} />
                <div>
                  <div className="text-sm" style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>{fmt.label}</div>
                  <div className="text-dim text-xs">{fmt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <div className="sidebar-section-header text-sm mb-8">选项</div>
          <div className="flex-row items-center gap-12 flex-wrap text-sm">
            <label className="cursor-clickable flex-row items-center gap-6">
              <input type="checkbox" checked={includeMetadata} onChange={e => setIncludeMetadata(e.target.checked)}
                style={{ accentColor: 'var(--color-accent)' }} />
              <span>包含元数据（单词数、时间戳等）</span>
            </label>
            <div className="flex-row items-center gap-6 text-sm">
              <span className="text-dim">章节范围:</span>
              <select value={chapterRange} onChange={e => setChapterRange(e.target.value)}>
                <option value="all">全部章节</option>
                <option value="1-10">1-10 章</option>
                <option value="11-20">11-20 章</option>
                <option value="21-50">21-50 章</option>
                <option value="custom">自定义...</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-row gap-8 mb-12">
          <button onClick={handleExport} disabled={running}
            className="welcome-mode-btn active"
            style={{ fontSize: 13, padding: '8px 20px', opacity: running ? 0.6 : 1 }}>
            {running ? '导出中...' : '开始导出'}
          </button>
        </div>

        <div className="card mono text-sm" style={{ background: 'var(--color-bg)', minHeight: 80, maxHeight: 200, overflow: 'auto', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: output ? 'var(--color-text)' : 'var(--color-dim)' }}>
          {output || '选择格式后点击"开始导出"\n\n支持格式：\n· TXT — 纯文本，兼容性最好\n· EPUB — 标准电子书格式\n· Markdown — 保留标记格式\n· 完整项目 — 导出全部项目文件'}
        </div>
      </div>
    </div>
  )
}
