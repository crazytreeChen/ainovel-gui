import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'

const COMMANDS = [
  { name: 'help', usage: '/help', desc: '查看命令列表' },
  { name: 'model', usage: '/model [role]', desc: '切换默认或角色模型' },
  { name: 'diag', usage: '/diag', desc: '诊断小说创作健康度' },
  { name: 'import', usage: '/import <path> [from=N]', desc: '反推外部小说续写' },
  { name: 'export', usage: '/export [path] [from=N] [to=M]', desc: '导出已完成章节' },
  { name: 'cocreate', usage: '/cocreate', desc: '共创规划后续阶段走向' },
  { name: 'simulate', usage: '/simulate', desc: '生成仿写画像' },
  { name: 'importsim', usage: '/importsim <file>', desc: '导入仿写画像' },
]

/** 默认系统提示词：要求 AI 用中文思考和输出 */
const SYSTEM_PROMPT = '请始终使用中文思考和回复。请用中文进行所有思考和创作输出。'

export default function InputBox() {
  const mode = useAppStore((s) => s.mode)
  const startupMode = useAppStore((s) => s.startupMode)
  const snapshot = useAppStore((s) => s.snapshot)
  const inputValue = useAppStore((s) => s.inputValue)
  const setInputValue = useAppStore((s) => s.setInputValue)
  const setMode = useAppStore((s) => s.setMode)
  const sendInput = useAppStore((s) => s.sendInput)
  const startWriting = useAppStore((s) => s.startWriting)
  const pauseWriting = useAppStore((s) => s.pauseWriting)
  const stopWriting = useAppStore((s) => s.stopWriting)
  const runDiag = useAppStore((s) => s.runDiag)
  const toggleHelp = useAppStore((s) => s.toggleHelp)
  const toggleModelSwitch = useAppStore((s) => s.toggleModelSwitch)
  const toggleCoCreate = useAppStore((s) => s.toggleCoCreate)
  const toggleExport = useAppStore((s) => s.toggleExport)
  const clearStreamOutput = useAppStore((s) => s.clearStreamOutput)

  const [showCommands, setShowCommands] = useState(false)
  const [cmdIndex, setCmdIndex] = useState(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const filteredCmds = inputValue.startsWith('/')
    ? COMMANDS.filter((c) => c.name.startsWith(inputValue.slice(1).toLowerCase()))
    : []

  const handleSubmit = useCallback(async () => {
    const text = inputValue.trim()
    if (!text) return

    // 处理斜杠命令
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(' ')
      const cmdName = parts[0].toLowerCase()
      const cmdArgs = parts.slice(1).join(' ')

      setInputValue('')
      setShowCommands(false)

      switch (cmdName) {
        case 'help':
          toggleHelp()
          return
        case 'model':
          toggleModelSwitch()
          return
        case 'diag':
          await runDiag()
          return
        case 'export':
          toggleExport()
          return
        case 'cocreate':
          toggleCoCreate()
          return
        case 'clear':
          clearStreamOutput()
          return
        default:
          // 发送给后端处理
          await sendInput(text)
          return
      }
    }

    setInputValue('')

    if (mode === 'welcome') {
      // 欢迎模式: 添加默认系统提示词后开始创作
      await startWriting(SYSTEM_PROMPT + '\n\n' + text)
      return
    }

    // 运行模式: 发送干预/继续指令
    await sendInput(text)
  }, [inputValue, mode, setInputValue, startWriting, sendInput, toggleHelp, toggleModelSwitch, runDiag, toggleExport, toggleCoCreate, clearStreamOutput])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
      return
    }

    if (e.key === 'Escape') {
      setInputValue('')
      setShowCommands(false)
      return
    }

    if (e.key === 'ArrowUp' && showCommands) {
      e.preventDefault()
      setCmdIndex((i) => Math.max(0, i - 1))
      return
    }

    if (e.key === 'ArrowDown' && showCommands) {
      e.preventDefault()
      setCmdIndex((i) => Math.min(filteredCmds.length - 1, i + 1))
      return
    }

    if (e.key === 'Tab' && showCommands && filteredCmds.length > 0) {
      e.preventDefault()
      setInputValue('/' + filteredCmds[cmdIndex].name + ' ')
      setShowCommands(false)
      return
    }
  }, [handleSubmit, setInputValue, showCommands, cmdIndex, filteredCmds])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setInputValue(val)
    setShowCommands(val.startsWith('/'))
    setCmdIndex(0)
  }, [setInputValue])

  // 自动聚焦
  useEffect(() => {
    inputRef.current?.focus()
  }, [mode])

  // 欢迎模式提示
  const isWelcome = mode === 'welcome'

  const hints = isWelcome
    ? 'Tab 切换启动模式 · Enter 直接开始创作 · 输入 / 搜索命令 · Esc 清空输入'
    : '输入 / 搜索命令 · Enter 发送干预 · Shift+Enter 换行 · Esc 清空 · Ctrl+C 暂停'

  return (
    <>
      <div className="input-hints">{hints}</div>
      <div className="input-area" style={{ position: 'relative' }}>
        <span className="input-prompt">❯</span>
        <textarea
          ref={inputRef}
          className="input-box"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={isWelcome
            ? (startupMode === 'quick' ? '输入小说需求开始创作...' : '输入共创对话...')
            : '输入剧情干预，例如：把感情线提前到第4章'
          }
          rows={1}
          style={{ width: '100%' }}
        />

        {/* 命令提示 */}
        {showCommands && filteredCmds.length > 0 && (
          <div className="command-palette">
            {filteredCmds.map((cmd, i) => (
              <div
                key={cmd.name}
                className={`command-item ${i === cmdIndex ? 'selected' : ''}`}
                onClick={() => {
                  setInputValue('/' + cmd.name + ' ')
                  setShowCommands(false)
                  inputRef.current?.focus()
                }}
              >
                <span className="text-accent">{cmd.usage}</span>
                <span className="command-item-desc">{cmd.desc}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
