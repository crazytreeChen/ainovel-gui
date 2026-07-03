import { useState } from 'react'
import type { Character } from '@/types/characters'
import { TIER_COLORS, TIER_LABELS } from '@/types/characters'
import ImageViewer from '@/components/ImageViewer'

interface Props {
  character: Character | null       // null = 新建模式
  onSave: (char: Character) => void
  onDelete: (name: string) => void
  onClose: () => void
}

export default function CharacterEditor({ character, onSave, onDelete, onClose }: Props) {
  const isNew = !character
  const [name, setName] = useState(character?.name ?? '')
  const [aliases, setAliases] = useState(character?.aliases.join(', ') ?? '')
  const [role, setRole] = useState(character?.role ?? '')
  const [tier, setTier] = useState(character?.tier ?? 'secondary')
  const [description, setDescription] = useState(character?.description ?? '')
  const [arc, setArc] = useState(character?.arc ?? '')
  const [traits, setTraits] = useState(character?.traits.join(', ') ?? '')
  const [avatar, setAvatar] = useState(character?.avatar ?? '')
  const [genAvatarPrompt, setGenAvatarPrompt] = useState('')
  const [generatingAvatar, setGeneratingAvatar] = useState(false)
  const [showGenAvatar, setShowGenAvatar] = useState(false)
  const [genError, setGenError] = useState('')
  const [viewerOpen, setViewerOpen] = useState(false)

  /** 从角色现有信息自动构建头像生成 prompt */
  function buildAvatarPrompt(): string {
    const parts: string[] = []
    if (name.trim()) parts.push(`角色名：${name.trim()}`)
    if (description.trim()) parts.push(`描述：${description.trim()}`)
    if (traits.trim()) parts.push(`性格特征：${traits.trim()}`)
    if (parts.length === 0) return ''
    parts.push('角色肖像，真人插画，高质量')
    return parts.join('；')
  }

  function openGenAvatar() {
    setGenAvatarPrompt(buildAvatarPrompt())
    setGenError('')
    setShowGenAvatar(true)
  }

  async function handleSelectAvatar() {
    if (!window.electronAPI) return
    const path = await window.electronAPI.selectCoverImage()
    if (!path) return
    // 读取本地图片为 base64
    try {
      const resp = await fetch(path)
      const blob = await resp.blob()
      const reader = new FileReader()
      reader.onload = () => setAvatar(reader.result as string)
      reader.readAsDataURL(blob)
    } catch { /* fallback: 直接存路径 */ }
  }

  async function handleGenerateAvatar() {
    if (!window.electronAPI || !genAvatarPrompt.trim()) return
    setGeneratingAvatar(true); setGenError('')
    try {
      const result = await window.electronAPI.generateImage('', '', genAvatarPrompt.trim(), { size: '1024x1024' })
      if (result.error) { setGenError('生成失败: ' + result.error) }
      else if (result.image) {
        setAvatar(result.image)
        setShowGenAvatar(false)
      }
    } catch (e: any) { setGenError(e.message || '生成失败') }
    setGeneratingAvatar(false)
  }

  function handleSave() {
    if (!name.trim()) return
    onSave({
      name: name.trim(),
      aliases: aliases.split(',').map(s => s.trim()).filter(Boolean),
      role: role.trim(),
      tier,
      description: description.trim(),
      arc: arc.trim(),
      traits: traits.split(',').map(s => s.trim()).filter(Boolean),
      avatar: avatar || undefined,
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 420, maxWidth: 500 }}>
        <div className="modal-title">
          {isNew ? '新建角色' : `编辑角色`}
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="flex-col gap-12">
          {/* 角色头像 */}
          <div className="flex-row items-start gap-16 mb-4">
            <div
              onClick={() => { if (avatar) { setViewerOpen(true) } else { handleSelectAvatar() } }}
              className="cursor-clickable"
              style={{
                width: 80, height: 80, borderRadius: 8, overflow: 'hidden',
                background: avatar ? 'transparent' : 'var(--color-surface-2)',
                border: avatar ? '1px solid var(--color-border)' : '2px dashed var(--color-dim)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, cursor: avatar ? 'zoom-in' : 'pointer',
              }}>
              {avatar ? (
                <img src={avatar} alt="角色头像" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: 32, opacity: 0.3 }}>👤</span>
              )}
            </div>
            <div className="flex-col gap-6">
              <button className="welcome-mode-btn text-xs" onClick={handleSelectAvatar} style={{ padding: '4px 10px' }}>
                上传头像
              </button>
              <button className="welcome-mode-btn text-xs" onClick={openGenAvatar}
                style={{ color: 'var(--color-accent2)', borderColor: 'var(--color-accent2)', padding: '4px 10px' }}>
                🤖 AI 生成
              </button>
              {avatar && (
                <button className="welcome-mode-btn text-xs" onClick={() => setAvatar('')}
                  style={{ color: 'var(--color-error)', padding: '4px 10px' }}>
                  移除头像
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-muted text-sm mb-6 d-block">名称 *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="input-field text-sm" placeholder="角色名" autoFocus />
          </div>

          <div>
            <label className="text-muted text-sm mb-6 d-block">别名</label>
            <input value={aliases} onChange={e => setAliases(e.target.value)}
              className="input-field text-sm" placeholder="用逗号分隔" />
          </div>

          <div className="flex-row gap-12">
            <div className="flex-1">
              <label className="text-muted text-sm mb-6 d-block">角色定位</label>
              <input value={role} onChange={e => setRole(e.target.value)}
                className="input-field text-sm" placeholder="如: 主角好友" />
            </div>
            <div>
              <label className="text-muted text-sm mb-6 d-block">重要度</label>
              <select value={tier} onChange={e => setTier(e.target.value as Character['tier'])}
                className="text-sm" style={{ padding: '7px 8px' }}>
                {Object.entries(TIER_LABELS).map(([k, v]) => (
                  <option key={k} value={k} style={{ color: TIER_COLORS[k] }}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-muted text-sm mb-6 d-block">描述</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              className="textarea-field text-sm" rows={3} placeholder="角色背景、外貌、性格概述..." />
          </div>

          <div>
            <label className="text-muted text-sm mb-6 d-block">人物弧光</label>
            <input value={arc} onChange={e => setArc(e.target.value)}
              className="input-field text-sm" placeholder="角色的成长变化线" />
          </div>

          <div>
            <label className="text-muted text-sm mb-6 d-block">性格特征</label>
            <input value={traits} onChange={e => setTraits(e.target.value)}
              className="input-field text-sm" placeholder="用逗号分隔，如: 勇敢, 正直, 优柔寡断" />
          </div>

          <div className="flex-row gap-8 mt-8">
            {!isNew && (
              <button className="btn btn-danger btn-sm"
                onClick={() => { if (confirm(`确认删除角色「${character!.name}」？`)) onDelete(character!.name) }}>
                删除角色
              </button>
            )}
            <div className="flex-1" />
            <button className="welcome-mode-btn" onClick={onClose}>取消</button>
            <button className="welcome-mode-btn active" onClick={handleSave}
              disabled={!name.trim()}>
              {isNew ? '创建' : '保存'}
            </button>
          </div>
        </div>

        {/* AI 生成头像弹窗 */}
        {showGenAvatar && (
          <div className="modal-overlay" onClick={() => setShowGenAvatar(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ minWidth: 400, maxWidth: 480 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 'bold' }}>🤖 AI 生成角色头像</span>
                <button onClick={() => setShowGenAvatar(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-dim)' }}>✕</button>
              </div>
              <div className="text-dim text-xs mb-12">
                为角色「{name || '(未命名)'}」生成头像。
                {genAvatarPrompt.trim() ? '已从角色信息自动填充描述，可修改后生成。' : '请先填写角色的名称和描述，再生成头像。'}
              </div>
              <div className="mb-12">
                <label className="text-muted text-sm mb-6 d-block">
                  图片描述（Prompt）{!genAvatarPrompt.trim() && <span className="text-error text-xs"> *必填</span>}
                </label>
                <textarea value={genAvatarPrompt} onChange={e => setGenAvatarPrompt(e.target.value)}
                  placeholder={'角色的外貌和风格描述，例如：\n"一位25岁的东方女性剑客，黑色长发束成马尾，眼神锐利，身穿深蓝色劲装，背景竹林，真人风格"'}
                  className="textarea-field text-sm" rows={4}
                  style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <div className="text-dim text-xs mb-8">
                💡 提示：建议关闭此弹窗，先在「描述」和「性格特征」字段中完善角色信息后重新打开，可自动生成更准确的提示词。
              </div>
              {genError && <div className="text-error text-sm mb-8">{genError}</div>}
              <div className="flex-row gap-8" style={{ justifyContent: 'flex-end' }}>
                <button className="welcome-mode-btn" onClick={() => setShowGenAvatar(false)}>取消</button>
                <button className="welcome-mode-btn active" onClick={handleGenerateAvatar} disabled={generatingAvatar || !genAvatarPrompt.trim()}>
                  {generatingAvatar ? '生成中...' : '生成头像'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 头像放大查看 */}
        {viewerOpen && avatar && (
          <ImageViewer src={avatar} alt={name || '角色头像'} onClose={() => setViewerOpen(false)} />
        )}
      </div>
    </div>
  )
}
