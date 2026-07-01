import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '@/stores/useAppStore'

interface ExportOption {
  key: string
  label: string
  desc: string
  args: string
}

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

        {/* 格式选择 */}
        <div style={{ marginBottom: 16 }}>
          <div className="sidebar-section-header" style={{ fontSize: 12, marginBottom: 8 }}>导出格式</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {EXPORT_FORMATS.map((fmt) => (
              <label key={fmt.key} className="cursor-clickable" style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 'var(--radius)',
                background: selected === fmt.key ? 'var(--color-surface-2)' : 'transparent',
                border: `1px solid ${selected === fmt.key ? 'var(--color-accent)' : 'var(--color-border)'}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                <input
                  type="radio" name="export-format"
                  checked={selected === fmt.key}
                  onChange={() => setSelected(fmt.key)}
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 13, color: 'var(--color-text)' }}>{fmt.label}</div>
                  <div className="text-dim" style={{ fontSize: 11 }}>{fmt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 选项 */}
        <div style={{ marginBottom: 16 }}>
          <div className="sidebar-section-header" style={{ fontSize: 12, marginBottom: 8 }}>选项</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="cursor-clickable" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <input type="checkbox" checked={includeMetadata} onChange={e => setIncludeMetadata(e.target.checked)}
                style={{ accentColor: 'var(--color-accent)' }} />
              <span>包含元数据（单词数、时间戳等）</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span className="text-dim">章节范围:</span>
              <select value={chapterRange} onChange={e => setChapterRange(e.target.value)}
                style={{
                  padding: '4px 8px', background: 'var(--color-bg)', color: 'var(--color-text)',
                  border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                  fontSize: 12, outline: 'none',
                }}>
                <option value="all">全部章节</option>
                <option value="1-10">1-10 章</option>
                <option value="11-20">11-20 章</option>
                <option value="21-50">21-50 章</option>
                <option value="custom">自定义...</option>
              </select>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            onClick={handleExport}
            disabled={running}
            style={{
              background: 'var(--color-accent)', color: '#1c1c1c', border: 'none',
              borderRadius: 'var(--radius)', padding: '8px 20px', fontWeight: 'bold',
              cursor: running ? 'not-allowed' : 'pointer', fontSize: 13, opacity: running ? 0.6 : 1,
            }}
          >
            {running ? '导出中...' : '开始导出'}
          </button>
        </div>

        {/* 输出 */}
        <div style={{
          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)', padding: 12, minHeight: 80, maxHeight: 200,
          overflow: 'auto', fontFamily: 'var(--font-mono)', fontSize: 12,
          lineHeight: 1.6, whiteSpace: 'pre-wrap',
          color: output ? 'var(--color-text)' : 'var(--color-dim)',
        }}>
          {output || '选择格式后点击"开始导出"\n\n支持格式：\n· TXT — 纯文本，兼容性最好\n· EPUB — 标准电子书格式\n· Markdown — 保留标记格式\n· 完整项目 — 导出全部项目文件'}
        </div>
      </div>
    </div>
  )
}
