import { Ban } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface ProgressOverlayProps {
  phase: string
  completed: number
  total: number
  currentFile?: string
  onCancel: () => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

export function ProgressOverlay({ phase, completed, total, currentFile, onCancel, t }: ProgressOverlayProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const percent = total ? Math.min(100, Math.round((completed / total) * 100)) : 0
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    cancelRef.current?.focus()
    return () => previous?.focus()
  }, [])
  const keepFocusInDialog = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    } else if (event.key === 'Tab') {
      event.preventDefault()
      cancelRef.current?.focus()
    }
  }
  return <div className="progress-overlay" role="dialog" aria-modal="true" aria-labelledby="progress-title" aria-describedby="progress-file" onKeyDown={keepFocusInDialog}><div className="progress-dialog"><div className="spinner" aria-hidden="true" /><h2 id="progress-title">{phase === 'package' ? t('packaging') : phase === 'audit' ? t('audit') : t('processing')}</h2><p id="progress-file" className="truncate">{currentFile ?? 'BatchDesk'}</p><div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t('processing')}><span style={{ width: `${percent}%` }} /></div><div className="progress-meta" role="status" aria-live="polite" aria-atomic="true"><span>{t('progressOf', { done: completed, total })}</span><span>{percent}%</span></div><button ref={cancelRef} type="button" className="btn secondary" onClick={onCancel}><Ban size={16} />{t('cancel')}</button></div></div>
}
