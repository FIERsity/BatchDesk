import { ArrowDown, ArrowLeft, ArrowUp, CirclePlus, Play, Save, Trash2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildRenamePreview, validateRenameRule } from '../lib/rename'
import type { InputFile, RenamePreview, RenameRule } from '../types'

interface RenameWorkspaceProps {
  files: InputFile[]
  busy: boolean
  onBack: () => void
  onRun: (previews: RenamePreview[], rules: RenameRule[]) => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

const ruleId = () => `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

function newRule(type: RenameRule['type']): RenameRule {
  if (type === 'replace') return { id: ruleId(), type, enabled: true, find: '', replacement: '', regex: false, caseSensitive: false }
  if (type === 'prefix' || type === 'suffix') return { id: ruleId(), type, enabled: true, value: '' }
  if (type === 'sequence') return { id: ruleId(), type, enabled: true, start: 1, pad: 2, separator: '-' }
  if (type === 'case') return { id: ruleId(), type, enabled: true, mode: 'lower' }
  if (type === 'normalize') return { id: ruleId(), type, enabled: true, unicode: true, whitespace: true }
  return { id: ruleId(), type: 'date', enabled: true, format: 'YYYY-MM-DD', position: 'prefix' }
}

export function RenameWorkspace({ files, busy, onBack, onRun, t }: RenameWorkspaceProps) {
  const [rules, setRules] = useState<RenameRule[]>([newRule('replace')])
  const [ruleType, setRuleType] = useState<RenameRule['type']>('replace')
  const [lockExtension, setLockExtension] = useState(true)
  const [resolveCollisions, setResolveCollisions] = useState(true)
  const errors = rules.map(validateRenameRule).filter(Boolean)
  const previews = useMemo(() => buildRenamePreview(files, rules, lockExtension, resolveCollisions), [files, lockExtension, resolveCollisions, rules])
  const invalid = errors.length > 0 || previews.some((preview) => preview.error || preview.collision)

  const update = (id: string, patch: Partial<RenameRule>) => setRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...patch } as RenameRule : rule))
  const move = (index: number, delta: number) => setRules((current) => {
    const target = index + delta
    if (target < 0 || target >= current.length) return current
    const next = [...current]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  const savePreset = () => localStorage.setItem('batchdesk.renamePreset', JSON.stringify(rules))
  const loadPreset = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('batchdesk.renamePreset') ?? '[]') as RenameRule[]
      if (Array.isArray(saved) && saved.length) setRules(saved.map((rule) => ({ ...rule, id: ruleId() })))
    } catch { /* Ignore damaged local preferences. */ }
  }

  return (
    <main className="workspace task-workspace">
      <div className="task-heading"><button type="button" className="icon-btn" onClick={onBack} title={t('backInbox')} aria-label={t('backInbox')}><ArrowLeft size={18} /></button><div><span>{t('inbox')} /</span><h1>{t('rename')}</h1></div><div className="heading-meta">{t('selectedCount', { count: files.length })}</div></div>
      <div className="task-layout">
        <section className="preview-pane">
          <div className="section-heading"><div><h2>{t('preview')}</h2><p>{previews.filter((item) => item.changed).length} / {previews.length}</p></div></div>
          <div className="table-scroll task-table-scroll"><table className="preview-table"><thead><tr><th>{t('before')}</th><th>{t('after')}</th><th>{t('status')}</th></tr></thead><tbody>
            {previews.map((preview) => <tr key={preview.fileId}><td title={preview.before}>{preview.before}</td><td className={preview.error || preview.collision ? 'danger-text' : preview.changed ? 'changed-text' : 'muted'} title={preview.outputPath}>{preview.after}</td><td>{preview.error ? t(preview.error) : preview.collision ? t('outputCollision') : preview.changed ? t('preview') : t('noChange')}</td></tr>)}
          </tbody></table></div>
        </section>

        <aside className="config-pane">
          <div className="section-heading"><h2>{t('rules')}</h2><span>{rules.length}</span></div>
          <div className="add-rule-row"><select value={ruleType} onChange={(event) => setRuleType(event.target.value as RenameRule['type'])}><option value="replace">{t('replace')}</option><option value="prefix">{t('prefix')}</option><option value="suffix">{t('suffix')}</option><option value="sequence">{t('sequence')}</option><option value="case">{t('letterCase')}</option><option value="normalize">{t('normalize')}</option><option value="date">{t('date')}</option></select><button type="button" className="btn secondary" onClick={() => setRules((current) => [...current, newRule(ruleType)])}><CirclePlus size={15} />{t('addRule')}</button></div>
          <div className="rule-list">{rules.map((rule, index) => <div key={rule.id} className={`rule-block ${rule.enabled ? '' : 'disabled'}`}>
            <div className="rule-head"><label><input type="checkbox" checked={rule.enabled} onChange={(event) => update(rule.id, { enabled: event.target.checked })} />{t(rule.type === 'case' ? 'letterCase' : rule.type)}</label><span><button type="button" className="icon-btn subtle" onClick={() => move(index, -1)} disabled={index === 0} title={t('moveUp')} aria-label={t('moveUp')}><ArrowUp size={14} /></button><button type="button" className="icon-btn subtle" onClick={() => move(index, 1)} disabled={index === rules.length - 1} title={t('moveDown')} aria-label={t('moveDown')}><ArrowDown size={14} /></button><button type="button" className="icon-btn subtle danger" onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))} title={t('deleteRule')} aria-label={t('deleteRule')}><Trash2 size={14} /></button></span></div>
            {rule.type === 'replace' && <><label className="field"><span>{t('find')}</span><input value={rule.find} onChange={(event) => update(rule.id, { find: event.target.value })} /></label><label className="field"><span>{t('replacement')}</span><input value={rule.replacement} onChange={(event) => update(rule.id, { replacement: event.target.value })} /></label><div className="inline-checks"><label><input type="checkbox" checked={rule.regex} onChange={(event) => update(rule.id, { regex: event.target.checked })} />{t('regex')}</label><label><input type="checkbox" checked={rule.caseSensitive} onChange={(event) => update(rule.id, { caseSensitive: event.target.checked })} />{t('caseSensitive')}</label></div>{validateRenameRule(rule) && <p className="field-error">{t(validateRenameRule(rule)!)}</p>}</>}
            {(rule.type === 'prefix' || rule.type === 'suffix') && <label className="field"><span>{t('value')}</span><input value={rule.value} onChange={(event) => update(rule.id, { value: event.target.value })} /></label>}
            {rule.type === 'sequence' && <div className="field-grid three"><label className="field"><span>{t('start')}</span><input type="number" value={rule.start} onChange={(event) => update(rule.id, { start: Number(event.target.value) })} /></label><label className="field"><span>{t('digits')}</span><input type="number" min="1" max="8" value={rule.pad} onChange={(event) => update(rule.id, { pad: Number(event.target.value) })} /></label><label className="field"><span>{t('separator')}</span><input value={rule.separator} onChange={(event) => update(rule.id, { separator: event.target.value })} /></label></div>}
            {rule.type === 'case' && <select value={rule.mode} onChange={(event) => update(rule.id, { mode: event.target.value as 'lower' | 'upper' | 'title' })}><option value="lower">{t('lower')}</option><option value="upper">{t('upper')}</option><option value="title">{t('titleCase')}</option></select>}
            {rule.type === 'normalize' && <div className="inline-checks"><label><input type="checkbox" checked={rule.unicode} onChange={(event) => update(rule.id, { unicode: event.target.checked })} />{t('unicodeNfc')}</label><label><input type="checkbox" checked={rule.whitespace} onChange={(event) => update(rule.id, { whitespace: event.target.checked })} />{t('cleanWhitespace')}</label></div>}
            {rule.type === 'date' && <div className="field-grid"><label className="field"><span>{t('dateFormat')}</span><select value={rule.format} onChange={(event) => update(rule.id, { format: event.target.value as 'YYYY-MM-DD' | 'YYYYMMDD' })}><option>YYYY-MM-DD</option><option>YYYYMMDD</option></select></label><label className="field"><span>{t('value')}</span><select value={rule.position} onChange={(event) => update(rule.id, { position: event.target.value as 'prefix' | 'suffix' })}><option value="prefix">{t('beforeName')}</option><option value="suffix">{t('afterName')}</option></select></label></div>}
          </div>)}</div>
          <div className="config-options"><label><input type="checkbox" checked={lockExtension} onChange={(event) => setLockExtension(event.target.checked)} />{t('lockExtension')}</label><label><input type="checkbox" checked={resolveCollisions} onChange={(event) => setResolveCollisions(event.target.checked)} />{t('resolveCollisions')}</label></div>
          <div className="preset-row"><button type="button" className="btn ghost" onClick={savePreset}><Save size={15} />{t('savePreset')}</button><button type="button" className="btn ghost" onClick={loadPreset}><Upload size={15} />{t('loadPreset')}</button></div>
          <button type="button" className="btn primary wide" disabled={busy || invalid || !files.length || !rules.some((rule) => rule.enabled)} onClick={() => onRun(previews, rules)}><Play size={16} />{t('run')}</button>
        </aside>
      </div>
    </main>
  )
}
