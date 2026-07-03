import { useNavigate } from 'react-router-dom'

interface Props {
  to?: string
  label?: string
}

export default function BackButton({ to, label = '← 返回' }: Props) {
  const navigate = useNavigate()
  return (
    <button className="welcome-mode-btn" onClick={() => to ? navigate(to) : navigate(-1)}>
      {label}
    </button>
  )
}
