import { useState, useCallback, useMemo } from 'react'
import { useUIStore } from '@/stores/useUIStore'
import { useWritingStore } from '@/stores/useWritingStore'

export interface CommandItem {
  name: string
  usage: string
  desc: string
}

export const COMMANDS: CommandItem[] = [
  { name: 'help', usage: '/help', desc: '查看命令列表' },
  { name: 'model', usage: '/model [role]', desc: '切换默认或角色模型' },
  { name: 'diag', usage: '/diag', desc: '诊断小说创作健康度' },
  { name: 'import', usage: '/import <path> [from=N]', desc: '反推外部小说续写' },
  { name: 'export', usage: '/export [path] [from=N] [to=M]', desc: '导出已完成章节' },
  { name: 'cocreate', usage: '/cocreate', desc: '共创规划后续阶段走向' },
  { name: 'simulate', usage: '/simulate', desc: '生成仿写画像' },
  { name: 'importsim', usage: '/importsim <file>', desc: '导入仿写画像' },
  { name: 'clear', usage: '/clear', desc: '清空实时输出面板' },
]

export interface UseCommandPaletteReturn {
  showCommands: boolean
  cmdIndex: number
  filteredCmds: CommandItem[]
  setShowCommands: (show: boolean) => void
  setCmdIndex: (index: number | ((prev: number) => number)) => void
  handleInputChange: (value: string) => void
  handlePaletteKeyDown: (e: React.KeyboardEvent) => boolean
  executeCommand: (text: string) => Promise<boolean>
  resetPalette: () => void
}

/**
 * 命令面板：斜杠命令过滤、键盘导航、命令执行
 */
export function useCommandPalette(
  inputValue: string,
  setInputValue: (value: string) => void
): UseCommandPaletteReturn {
  const [showCommands, setShowCommands] = useState(false)
  const [cmdIndex, setCmdIndex] = useState(0)

  const pushModal = useUIStore((s) => s.pushModal)
  const runDiag = useWritingStore((s) => s.runDiag)
  const clearStreamOutput = useWritingStore((s) => s.clearStreamOutput)
  const sendInput = useWritingStore((s) => s.sendInput)
  const addToast = useUIStore((s) => s.addToast)

  const filteredCmds = useMemo(() => {
    if (!inputValue.startsWith('/')) return []
    const q = inputValue.slice(1).trim().toLowerCase()
    if (!q) return COMMANDS
    return COMMANDS.filter((c) => c.name.startsWith(q) || c.usage.toLowerCase().includes(q))
  }, [inputValue])

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value)
    setShowCommands(value.startsWith('/'))
    setCmdIndex(0)
  }, [setInputValue])

  const resetPalette = useCallback(() => {
    setShowCommands(false)
    setCmdIndex(0)
  }, [])

  const executeCommand = useCallback(async (text: string): Promise<boolean> => {
    if (!text.startsWith('/')) return false

    const raw = text.slice(1).trim()
    // 只有一个斜杠或空命令：不发送到引擎
    if (!raw) {
      setInputValue('')
      setShowCommands(false)
      addToast({ id: Date.now(), message: '请选择命令，例如 /cocreate', type: 'info' })
      return true
    }

    const parts = raw.split(/\s+/)
    const cmdName = (parts[0] || '').toLowerCase()

    setInputValue('')
    setShowCommands(false)

    switch (cmdName) {
      case 'help':
        pushModal('help')
        return true
      case 'model':
        pushModal('modelSwitch')
        return true
      case 'diag':
        await runDiag()
        return true
      case 'export':
        pushModal('export')
        return true
      case 'cocreate':
        // 打开共创规划弹窗（不走干预通道）
        pushModal('coCreate')
        return true
      case 'clear':
        clearStreamOutput()
        return true
      case 'import':
      case 'simulate':
      case 'importsim':
        // 这些命令需要参数/引擎支持：进程运行中才转发
        await sendInput(text)
        return true
      default:
        // 未知 /命令 才尝试作为引擎指令发送
        await sendInput(text)
        return true
    }
  }, [setInputValue, pushModal, runDiag, clearStreamOutput, sendInput, addToast])

  const handlePaletteKeyDown = useCallback((e: React.KeyboardEvent): boolean => {
    if (!inputValue.startsWith('/') && !showCommands) return false

    if (e.key === 'Escape') {
      setInputValue('')
      setShowCommands(false)
      return true
    }

    if (e.key === 'ArrowUp' && showCommands && filteredCmds.length > 0) {
      e.preventDefault()
      setCmdIndex((i) => Math.max(0, i - 1))
      return true
    }

    if (e.key === 'ArrowDown' && showCommands && filteredCmds.length > 0) {
      e.preventDefault()
      setCmdIndex((i) => Math.min(filteredCmds.length - 1, i + 1))
      return true
    }

    // Tab：补全当前高亮命令
    if (e.key === 'Tab' && showCommands && filteredCmds.length > 0) {
      e.preventDefault()
      setInputValue('/' + filteredCmds[cmdIndex].name + ' ')
      setShowCommands(false)
      return true
    }

    // Enter：直接执行当前高亮命令（关键修复）
    // 以前只提交输入框里的 "/"，导致 /cocreate 被当成干预发出并失败
    if (e.key === 'Enter' && !e.shiftKey && showCommands && filteredCmds.length > 0) {
      e.preventDefault()
      const chosen = filteredCmds[Math.min(cmdIndex, filteredCmds.length - 1)]
      void executeCommand('/' + chosen.name)
      return true
    }

    return false
  }, [inputValue, showCommands, cmdIndex, filteredCmds, setInputValue, executeCommand])

  return {
    showCommands,
    cmdIndex,
    filteredCmds,
    setShowCommands,
    setCmdIndex,
    handleInputChange,
    handlePaletteKeyDown,
    executeCommand,
    resetPalette,
  }
}