import { Ban } from 'lucide-react'

interface ProgressOverlayProps {
  phase: string
  completed: number
  total: number
  currentFile?: string
  onCancel: () => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

export function ProgressOverlay({ phase, completed, total, currentFile, onCancel, t }: ProgressOverlayProps) {
  const percent = total ? Math.min(100, Math.round((completed / total) * 100)) : 0
  return <div className="progress-overlay" role="dialog" aria-modal="true" aria-labelledby="progress-title"><div className="progress-dialog"><div className="spinner" aria-hidden="true" /><h2 id="progress-title">{phase === 'package' ? t('packaging') : phase === 'audit' ? t('audit') : t('processing')}</h2><p className="truncate">{currentFile ?? 'BatchDesk'}</p><div className="progress-track"><span style={{ width: `${percent}%` }} /></div><div className="progress-meta"><span>{t('progressOf', { done: completed, total })}</span><span>{percent}%</span></div><button type="button" className="btn secondary" onClick={onCancel}><Ban size={16} />{t('cancel')}</button></div></div>
}
