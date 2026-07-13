import { useEffect } from 'react'
import { useUIStore } from '@/stores/useUIStore'
import HelpModal from './HelpModal'
import DiagnosticsModal from './DiagnosticsModal'
import ModelSwitchModal from './ModelSwitchModal'
import CoCreateModal from './CoCreateModal'
import ExportModal from './ExportModal'

const MODAL_COMPONENTS: Record<string, React.ComponentType<Record<string, unknown>>> = {
  help: HelpModal,
  diagnostics: DiagnosticsModal,
  modelSwitch: ModelSwitchModal,
  coCreate: CoCreateModal,
  export: ExportModal,
}

export default function ModalHost() {
  const modalStack = useUIStore((s) => s.modalStack)
  const popModal = useUIStore((s) => s.popModal)

  // Escape 键关闭最顶层模态框
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack.length > 0) {
        e.preventDefault()
        popModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalStack.length, popModal])

  return (
    <>
      {modalStack.map((modal, index) => {
        const Component = MODAL_COMPONENTS[modal.type]
        if (!Component) return null
        return <Component key={index} {...modal.props} onClose={popModal} />
      })}
    </>
  )
}
