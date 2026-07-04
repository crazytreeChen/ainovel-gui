import { useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useCommandPalette } from '@/hooks/useCommandPalette'

/** 默认系统提示词：要求 AI 用中文思考和输出 */
const SYSTEM_PROMPT = '请始终使用中文思考和回复。请用中文进行所有思考和创作输出。'

export default function InputBox() {
  const mode = useAppStore((s) => s.mode)
  const startupMode = useAppStore((s) => s.startupMode)
  const inputValue = useAppStore((s) => s.inputValue)
  const setInputValue = useAppStore((s) => s.setInputValue)
  const sendInput = useAppStore((s) => s.sendInput)
  const startWriting = useAppStore((s) => s.startWriting)

  const {
    showCommands,
    cmdIndex,
    filteredCmds,
    setShowCommands,
    handleInputChange,
    handlePaletteKeyDown,
    executeCommand,
    resetPalette,
  } = useCommandPalette(inputValue, setInputValue)

  const inputRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(async () => {
    const text = inputValue.trim()
    if (!text) return

    // 斜杠命令：委托给 useCommandPalette
    if (text.startsWith('/')) {
      await executeCommand(text)
      return
    }

    setInputValue('')

    if (mode === 'welcome') {
      // 欢迎模式: 添加默认系统提示词后开始创作
      await startWriting(SYSTEM_PROMPT + '\n\n' + text)
      return
    }

    // 运行模式: 发送干预/继续指令
    await sendInput(text)
  }, [inputValue, mode, setInputValue, startWriting, sendInput, executeCommand])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 先尝试命令面板键盘导航
    if (handlePaletteKeyDown(e)) return

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
      return
    }

    if (e.key === 'Escape') {
      setInputValue('')
      resetPalette()
      return
    }
  }, [handleSubmit, setInputValue, resetPalette, handlePaletteKeyDown])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleInputChange(e.target.value)
  }, [handleInputChange])

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
