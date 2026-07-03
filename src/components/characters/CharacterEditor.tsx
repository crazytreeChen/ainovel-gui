import { useState } from 'react'
import type { Character } from '@/types/characters'
import { TIER_COLORS, TIER_LABELS } from '@/types/characters'

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
      </div>
    </div>
  )
}
