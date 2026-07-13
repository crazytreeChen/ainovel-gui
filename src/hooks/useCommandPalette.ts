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

  const filteredCmds = useMemo(() => {
    if (!inputValue.startsWith('/')) return []
    return COMMANDS.filter((c) => c.name.startsWith(inputValue.slice(1).toLowerCase()))
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

  const handlePaletteKeyDown = useCallback((e: React.KeyboardEvent): boolean => {
    if (e.key === 'Escape') {
      setInputValue('')
      setShowCommands(false)
      return true
    }

    if (e.key === 'ArrowUp' && showCommands) {
      e.preventDefault()
      setCmdIndex((i) => Math.max(0, i - 1))
      return true
    }

    if (e.key === 'ArrowDown' && showCommands) {
      e.preventDefault()
      setCmdIndex((i) => Math.min(filteredCmds.length - 1, i + 1))
      return true
    }

    if (e.key === 'Tab' && showCommands && filteredCmds.length > 0) {
      e.preventDefault()
      setInputValue('/' + filteredCmds[cmdIndex].name + ' ')
      setShowCommands(false)
      return true
    }

    return false
  }, [setInputValue, showCommands, cmdIndex, filteredCmds])

  const executeCommand = useCallback(async (text: string): Promise<boolean> => {
    if (!text.startsWith('/')) return false

    const parts = text.slice(1).split(' ')
    const cmdName = parts[0].toLowerCase()

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
        pushModal('coCreate')
        return true
      case 'clear':
        clearStreamOutput()
        return true
      default:
        await sendInput(text)
        return true
    }
  }, [setInputValue, pushModal, runDiag, clearStreamOutput, sendInput])

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
