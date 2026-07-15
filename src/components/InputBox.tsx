import { useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/useAppStore'
import { useWritingStore } from '@/stores/useWritingStore'
import { useUIStore } from '@/stores/useUIStore'
import { useCommandPalette } from '@/hooks/useCommandPalette'

/** 默认系统提示词：要求 AI 用中文思考和输出 */
const SYSTEM_PROMPT = '请始终使用中文思考和回复。请用中文进行所有思考和创作输出。'

export default function InputBox() {
  const mode = useAppStore((s) => s.mode)
  const startupMode = useAppStore((s) => s.startupMode)
  const inputValue = useAppStore((s) => s.inputValue)
  const setInputValue = useAppStore((s) => s.setInputValue)
  const activeBookId = useAppStore((s) => s.activeBookId)
  const snapshot = useAppStore((s) => s.snapshot)
  const sendInput = useWritingStore((s) => s.sendInput)
  const startWriting = useWritingStore((s) => s.startWriting)
  const resumeWriting = useWritingStore((s) => s.resumeWriting)
  const starting = useWritingStore((s) => s.starting)

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
    if (starting) {
      useUIStore.getState().addToast({
        id: Date.now(),
        message: '正在启动中，请稍候',
        type: 'error',
      })
      return
    }

    // 斜杠命令：委托给 useCommandPalette
    if (text.startsWith('/')) {
      await executeCommand(text)
      return
    }

    setInputValue('')

    const processAlive = snapshot.runtimeState === 'running' || mode === 'running'

    // 欢迎模式 / 进程未运行
    if (!processAlive) {
      if (activeBookId) {
        // 主流程：pending_steer → resume。失败直接报错，不再 start 掩盖。
        const saved = await sendInput(text, activeBookId)
        if (!saved) return
        await resumeWriting(activeBookId)
        return
      }

      await startWriting(SYSTEM_PROMPT + '\n\n' + text)
      return
    }

    // 运行模式: 发送干预/继续指令
    await sendInput(text, activeBookId || undefined)
  }, [inputValue, mode, snapshot.runtimeState, activeBookId, setInputValue, startWriting, resumeWriting, sendInput, executeCommand, starting])

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

  // 欢迎/空闲模式提示
  const processAlive = snapshot.runtimeState === 'running' || mode === 'running'
  const isWelcomeLike = !processAlive

  const hints = isWelcomeLike
    ? 'Enter 发送共创/启动指令 · 输入 / 搜索命令 · Esc 清空输入 · 进程未运行时会自动开始/恢复创作'
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
          disabled={starting}
          placeholder={isWelcomeLike
            ? (startupMode === 'quick' ? '输入共创/创作指令后回车，将自动开始或恢复创作...' : '输入共创对话，回车后自动开始/恢复...')
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
