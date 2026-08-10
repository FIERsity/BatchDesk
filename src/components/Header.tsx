import { Files, ShieldCheck } from 'lucide-react'
import type { Language } from '../types'

interface HeaderProps {
  language: Language
  onLanguageChange: (language: Language) => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

export function Header({ language, onLanguageChange, t }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-brand">
        <span className="brand-mark" aria-hidden="true"><Files size={20} /></span>
        <span><strong>BatchDesk</strong><small>{t('appTagline')}</small></span>
      </div>
      <div className="header-actions">
        <span className="privacy-status"><ShieldCheck size={15} />{t('privacy')}</span>
        <div className="segmented compact" role="group" aria-label="Language">
          <button type="button" className={language === 'zh' ? 'active' : ''} aria-pressed={language === 'zh'} onClick={() => onLanguageChange('zh')}>中</button>
          <button type="button" className={language === 'en' ? 'active' : ''} aria-pressed={language === 'en'} onClick={() => onLanguageChange('en')}>EN</button>
        </div>
      </div>
    </header>
  )
}
