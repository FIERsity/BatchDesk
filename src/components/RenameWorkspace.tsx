import { ArrowDown, ArrowLeft, ArrowUp, CirclePlus, Info, Play, Save, Trash2, Upload } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildRenamePreview, validateRenameRule } from '../lib/rename'
import type { InputFile, RenamePreview, RenameRule, RenameSortMode } from '../types'
import { StructuredRenameBuilder } from './StructuredRenameBuilder'

interface RenameWorkspaceProps {
  files: InputFile[]
  busy: boolean
  onBack: () => void
  onRun: (previews: RenamePreview[], rules: RenameRule[]) => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

type PreviewFilter = 'all' | 'changed' | 'issues'

const ruleId = () => `rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

function newRule(type: RenameRule['type']): RenameRule {
  if (type === 'replace') return { id: ruleId(), type, enabled: true, find: '', replacement: '', regex: false, caseSensitive: false }
  if (type === 'prefix' || type === 'suffix') return { id: ruleId(), type, enabled: true, value: '' }
  if (type === 'sequence') return { id: ruleId(), type, enabled: true, start: 1, step: 1, pad: 2, separator: '-', position: 'prefix' }
  if (type === 'case') return { id: ruleId(), type, enabled: true, mode: 'lower' }
  if (type === 'normalize') return { id: ruleId(), type, enabled: true, unicode: true, whitespace: true }
  return { id: ruleId(), type: 'date', enabled: true, format: 'YYYY-MM-DD', position: 'prefix' }
}

export function RenameWorkspace({ files, busy, onBack, onRun, t }: RenameWorkspaceProps) {
  const [mode, setMode] = useState<'structured' | 'rules'>('structured')
  const [rules, setRules] = useState<RenameRule[]>([newRule('replace')])
  const [ruleType, setRuleType] = useState<RenameRule['type']>('replace')
  const [lockExtension, setLockExtension] = useState(true)
  const [resolveCollisions, setResolveCollisions] = useState(true)
  const [sortMode, setSortMode] = useState<RenameSortMode>('path')
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all')
  const [presetMessage, setPresetMessage] = useState('')
  const errors = rules.map(validateRenameRule).filter(Boolean)
  const previews = useMemo(() => buildRenamePreview(files, rules, lockExtension, resolveCollisions, sortMode), [files, lockExtension, resolveCollisions, rules, sortMode])
  const changedCount = previews.filter((preview) => preview.changed && !preview.error && !preview.collision).length
  const issueCount = previews.filter((preview) => preview.error || preview.collision).length
  const extensionChangeCount = previews.filter((preview) => preview.extensionChanged && !preview.error && !preview.collision).length
  const visiblePreviews = previews.filter((preview) => previewFilter === 'all' || previewFilter === 'changed' && preview.changed || previewFilter === 'issues' && (preview.error || preview.collision))
  const invalid = errors.length > 0 || issueCount > 0
  const canRun = !busy && !invalid && changedCount > 0 && files.length > 0 && rules.some((rule) => rule.enabled)

  const update = (id: string, patch: Partial<RenameRule>) => setRules((current) => current.map((rule) => rule.id === id ? { ...rule, ...patch } as RenameRule : rule))
  const move = (index: number, delta: number) => setRules((current) => {
    const target = index + delta
    if (target < 0 || target >= current.length) return current
    const next = [...current]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })
  const savePreset = () => {
    localStorage.setItem('batchdesk.renamePreset', JSON.stringify(rules))
    setPresetMessage(t('presetSaved'))
  }
  const loadPreset = () => {
    try {
      const saved = JSON.parse(localStorage.getItem('batchdesk.renamePreset') ?? '[]') as RenameRule[]
      if (Array.isArray(saved) && saved.length) {
        setRules(saved.map((rule) => ({ ...rule, id: ruleId(), ...(rule.type === 'sequence' ? { step: rule.step ?? 1, position: rule.position ?? 'prefix' } : {}) })))
        setPresetMessage(t('presetLoaded'))
      } else setPresetMessage(t('presetEmpty'))
    } catch {
      setPresetMessage(t('presetEmpty'))
    }
  }

  const previewStatus = (preview: RenamePreview) => {
    if (preview.error) return { label: t(preview.error), className: 'danger-text' }
    if (preview.collision) return { label: t('outputCollision'), className: 'danger-text' }
    if (preview.collisionResolved) return { label: t('collisionResolved'), className: 'warning-text' }
    if (preview.extensionChanged) return { label: t('extensionChanged'), className: 'warning-text' }
    if (preview.changed) return { label: t('preview'), className: 'changed-text' }
    return { label: t('noChange'), className: 'muted' }
  }

  return (
    <main className="workspace task-workspace">
      <div className="task-heading"><button type="button" className="icon-btn" onClick={onBack} title={t('backInbox')} aria-label={t('backInbox')}><ArrowLeft size={18} /></button><div><span>{t('inbox')} /</span><h1>{t('rename')}</h1></div><div className="heading-meta">{t('selectedCount', { count: files.length })}</div></div>
      <div className="rename-mode-tabs segmented" role="tablist" aria-label={t('renameMode')}><button type="button" role="tab" aria-selected={mode === 'structured'} className={mode === 'structured' ? 'active' : ''} onClick={() => setMode('structured')}>{t('structuredMode')}</button><button type="button" role="tab" aria-selected={mode === 'rules'} className={mode === 'rules' ? 'active' : ''} onClick={() => setMode('rules')}>{t('rulesMode')}</button></div>
      {mode === 'structured' ? <StructuredRenameBuilder files={files} busy={busy} onRun={(previews) => onRun(previews, [])} t={t} /> : <div className="task-layout">
        <section className="preview-pane">
          <div className="section-heading preview-heading">
            <div><h2>{t('preview')}</h2><p>{t('renameSummary', { changed: changedCount, total: previews.length, issues: issueCount })}</p></div>
            <div className="preview-tools">
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as RenameSortMode)} aria-label={t('sortBy')}>
                <option value="path">{t('sortPath')}</option><option value="name">{t('sortName')}</option><option value="added">{t('sortAdded')}</option>
              </select>
              <div className="segmented compact" role="group" aria-label={t('previewFilter')}>
                <button type="button" className={previewFilter === 'all' ? 'active' : ''} aria-pressed={previewFilter === 'all'} onClick={() => setPreviewFilter('all')}>{t('allItems')}</button>
                <button type="button" className={previewFilter === 'changed' ? 'active' : ''} aria-pressed={previewFilter === 'changed'} onClick={() => setPreviewFilter('changed')}>{t('changedOnly')}</button>
                <button type="button" className={previewFilter === 'issues' ? 'active' : ''} aria-pressed={previewFilter === 'issues'} onClick={() => setPreviewFilter('issues')}>{t('issuesOnly')}</button>
              </div>
            </div>
          </div>
          <div className="table-scroll task-table-scroll"><table className="preview-table rename-preview-table"><thead><tr><th>{t('before')}</th><th>{t('after')}</th><th>{t('status')}</th></tr></thead><tbody>
            {visiblePreviews.length ? visiblePreviews.map((preview) => {
              const status = previewStatus(preview)
              return <tr key={preview.fileId} className={preview.error || preview.collision ? 'row-error' : ''}><td title={preview.inputPath}><span>{preview.before}</span>{preview.inputPath !== preview.before && <small className="preview-path">{preview.inputPath}</small>}</td><td className={status.className} title={preview.outputPath}>{preview.after}</td><td className={status.className}>{status.label}</td></tr>
            }) : <tr><td colSpan={3}><div className="filtered-empty">{t('noFilteredItems')}</div></td></tr>}
          </tbody></table></div>
        </section>

        <aside className="config-pane">
          <div className="section-heading config-heading"><h2>{t('rules')}</h2><span>{rules.length}</span></div>
          <div className="rename-intro"><Info size={15} /><span>{t('renameIntro')}</span></div>
          <div className="add-rule-row"><select value={ruleType} onChange={(event) => setRuleType(event.target.value as RenameRule['type'])} aria-label={t('ruleType')}><option value="replace">{t('replace')}</option><option value="prefix">{t('prefix')}</option><option value="suffix">{t('suffix')}</option><option value="sequence">{t('sequence')}</option><option value="case">{t('letterCase')}</option><option value="normalize">{t('normalize')}</option><option value="date">{t('date')}</option></select><button type="button" className="btn secondary" onClick={() => setRules((current) => [...current, newRule(ruleType)])}><CirclePlus size={15} />{t('addRule')}</button></div>
          <div className="rule-list">{rules.map((rule, index) => <div key={rule.id} className={`rule-block ${rule.enabled ? '' : 'disabled'}`}>
            <div className="rule-head"><label><input type="checkbox" checked={rule.enabled} onChange={(event) => update(rule.id, { enabled: event.target.checked })} />{t(rule.type === 'case' ? 'letterCase' : rule.type)}</label><span><button type="button" className="icon-btn subtle" onClick={() => move(index, -1)} disabled={index === 0} title={t('moveUp')} aria-label={t('moveUp')}><ArrowUp size={14} /></button><button type="button" className="icon-btn subtle" onClick={() => move(index, 1)} disabled={index === rules.length - 1} title={t('moveDown')} aria-label={t('moveDown')}><ArrowDown size={14} /></button><button type="button" className="icon-btn subtle danger" onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))} title={t('deleteRule')} aria-label={t('deleteRule')}><Trash2 size={14} /></button></span></div>
            {rule.type === 'replace' && <><label className="field"><span>{t('find')}</span><input value={rule.find} placeholder={t('findPlaceholder')} onChange={(event) => update(rule.id, { find: event.target.value })} /></label><label className="field"><span>{t('replacement')}</span><input value={rule.replacement} placeholder={t('replacementPlaceholder')} onChange={(event) => update(rule.id, { replacement: event.target.value })} /></label><div className="inline-checks"><label><input type="checkbox" checked={rule.regex} onChange={(event) => update(rule.id, { regex: event.target.checked })} />{t('regex')}</label><label><input type="checkbox" checked={rule.caseSensitive} onChange={(event) => update(rule.id, { caseSensitive: event.target.checked })} />{t('caseSensitive')}</label></div>{rule.regex && <p className="field-hint">{t('regexHint')}</p>}{validateRenameRule(rule) && <p className="field-error">{t(validateRenameRule(rule)!)}</p>}</>}
            {(rule.type === 'prefix' || rule.type === 'suffix') && <label className="field"><span>{t('value')}</span><input value={rule.value} placeholder={t('valuePlaceholder')} onChange={(event) => update(rule.id, { value: event.target.value })} /></label>}
            {rule.type === 'sequence' && <><div className="field-grid sequence-fields"><label className="field"><span>{t('start')}</span><input type="number" value={rule.start} onChange={(event) => update(rule.id, { start: Number(event.target.value) })} /></label><label className="field"><span>{t('step')}</span><input type="number" value={rule.step} onChange={(event) => update(rule.id, { step: Number(event.target.value) })} /></label><label className="field"><span>{t('digits')}</span><input type="number" min="1" max="8" value={rule.pad} onChange={(event) => update(rule.id, { pad: Number(event.target.value) })} /></label><label className="field"><span>{t('separator')}</span><input value={rule.separator} onChange={(event) => update(rule.id, { separator: event.target.value })} /></label></div><label className="field"><span>{t('sequencePosition')}</span><select value={rule.position} onChange={(event) => update(rule.id, { position: event.target.value as 'prefix' | 'suffix' })}><option value="prefix">{t('positionPrefix')}</option><option value="suffix">{t('positionSuffix')}</option></select></label><p className="field-hint">{t('sequenceExample', { example: rule.position === 'prefix' ? `${String(rule.start).padStart(rule.pad, '0')}${rule.separator}文件名` : `文件名${rule.separator}${String(rule.start).padStart(rule.pad, '0')}` })}</p></>}
            {rule.type === 'case' && <select value={rule.mode} onChange={(event) => update(rule.id, { mode: event.target.value as 'lower' | 'upper' | 'title' })}><option value="lower">{t('lower')}</option><option value="upper">{t('upper')}</option><option value="title">{t('titleCase')}</option></select>}
            {rule.type === 'normalize' && <div className="inline-checks"><label><input type="checkbox" checked={rule.unicode} onChange={(event) => update(rule.id, { unicode: event.target.checked })} />{t('unicodeNfc')}</label><label><input type="checkbox" checked={rule.whitespace} onChange={(event) => update(rule.id, { whitespace: event.target.checked })} />{t('cleanWhitespace')}</label></div>}
            {rule.type === 'date' && <div className="field-grid"><label className="field"><span>{t('dateFormat')}</span><select value={rule.format} onChange={(event) => update(rule.id, { format: event.target.value as 'YYYY-MM-DD' | 'YYYYMMDD' })}><option>YYYY-MM-DD</option><option>YYYYMMDD</option></select></label><label className="field"><span>{t('value')}</span><select value={rule.position} onChange={(event) => update(rule.id, { position: event.target.value as 'prefix' | 'suffix' })}><option value="prefix">{t('beforeName')}</option><option value="suffix">{t('afterName')}</option></select></label></div>}
          </div>)}</div>
          <div className="config-options"><label title={t('extensionLockedHint')}><input type="checkbox" checked={lockExtension} onChange={(event) => setLockExtension(event.target.checked)} />{t('lockExtension')}</label><label className="field"><span>{t('collisionHandling')}</span><select value={resolveCollisions ? 'auto' : 'block'} onChange={(event) => setResolveCollisions(event.target.value === 'auto')}><option value="auto">{t('collisionAuto')}</option><option value="block">{t('collisionBlock')}</option></select></label></div>
          {extensionChangeCount > 0 && <p className="field-warning">{t('extensionChangeWarning', { count: extensionChangeCount })}</p>}
          <div className="preset-row"><button type="button" className="btn ghost" onClick={savePreset}><Save size={15} />{t('savePreset')}</button><button type="button" className="btn ghost" onClick={loadPreset}><Upload size={15} />{t('loadPreset')}</button></div>
          {presetMessage && <p className="field-hint preset-message" role="status">{presetMessage}</p>}
          {!changedCount && !invalid && <p className="field-hint">{t('noChanges')}</p>}
          <button type="button" className="btn primary wide" disabled={!canRun} onClick={() => onRun(previews, rules)}><Play size={16} />{t('run')}</button>
        </aside>
      </div>}
    </main>
  )
}
