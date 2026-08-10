import { ArrowDown, ArrowLeft, ArrowRight, CirclePlus, Copy, Info, Play, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildStructuredRenamePreview, createRenameColumn } from '../lib/structuredRename'
import type {
  InputFile,
  RenameColumn,
  RenamePreview,
  RenameSortMode,
  StructuredColumnKind,
  StructuredRenameConfig,
  StructuredRenamePreview,
  StructuredSequenceFormat,
} from '../types'

interface StructuredRenameBuilderProps {
  files: InputFile[]
  busy: boolean
  onRun: (previews: RenamePreview[]) => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

type PreviewFilter = 'all' | 'changed' | 'issues'

const initialColumns = (): RenameColumn[] => {
  const sequence = createRenameColumn('sequence')
  const separator = createRenameColumn('literal')
  separator.label = '分隔符'
  separator.value = '-'
  const cleaned = createRenameColumn('cleaned')
  const extension = createRenameColumn('extension')
  return [sequence, separator, cleaned, extension]
}

const fieldKinds: Array<{ kind: StructuredColumnKind; labelKey: string }> = [
  { kind: 'literal', labelKey: 'fixedTextField' },
  { kind: 'original', labelKey: 'originalTitleField' },
  { kind: 'cleaned', labelKey: 'cleanedTitleField' },
  { kind: 'sequence', labelKey: 'sequenceField' },
  { kind: 'date', labelKey: 'dateField' },
  { kind: 'manual', labelKey: 'manualField' },
  { kind: 'extension', labelKey: 'extensionField' },
]

function kindLabel(kind: StructuredColumnKind, t: StructuredRenameBuilderProps['t']): string {
  return t(fieldKinds.find((item) => item.kind === kind)?.labelKey ?? 'field')
}

export function StructuredRenameBuilder({ files, busy, onRun, t }: StructuredRenameBuilderProps) {
  const [columns, setColumns] = useState<RenameColumn[]>(initialColumns)
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({})
  const [sortMode, setSortMode] = useState<RenameSortMode>('path')
  const [lockExtension, setLockExtension] = useState(true)
  const [resolveCollisions, setResolveCollisions] = useState(true)
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all')
  const [fieldKind, setFieldKind] = useState<StructuredColumnKind>('literal')

  const config = useMemo<StructuredRenameConfig>(() => ({ columns, sortMode, lockExtension, resolveCollisions }), [columns, lockExtension, resolveCollisions, sortMode])
  const previews = useMemo(() => buildStructuredRenamePreview(files, config, overrides), [config, files, overrides])
  const changedCount = previews.filter((preview) => preview.changed && !preview.error && !preview.collision).length
  const issueCount = previews.filter((preview) => preview.error || preview.collision).length
  const extensionChangeCount = previews.filter((preview) => preview.extensionChanged && !preview.error && !preview.collision).length
  const visiblePreviews = previews.filter((preview) => previewFilter === 'all' || previewFilter === 'changed' && preview.changed || previewFilter === 'issues' && (preview.error || preview.collision))
  const invalid = columns.length === 0 || issueCount > 0
  const canRun = !busy && !invalid && changedCount > 0 && files.length > 0

  const updateColumn = (id: string, patch: Partial<RenameColumn>) => {
    setColumns((current) => current.map((column) => column.id === id ? { ...column, ...patch } : column))
  }
  const updateCleaning = (id: string, patch: Partial<RenameColumn['cleaning']>) => {
    setColumns((current) => current.map((column) => column.id === id ? { ...column, cleaning: { ...column.cleaning, ...patch } } : column))
  }
  const moveColumn = (index: number, delta: number) => {
    setColumns((current) => {
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }
  const duplicateColumn = (column: RenameColumn, index: number) => {
    if (column.kind === 'extension') return
    const duplicate = { ...column, id: `${column.id}-copy-${Date.now()}`, label: `${column.label} ${t('copyFieldSuffix')}` }
    setColumns((current) => [...current.slice(0, index + 1), duplicate, ...current.slice(index + 1)])
  }
  const addColumn = () => {
    if (fieldKind === 'extension' && columns.some((column) => column.kind === 'extension')) return
    setColumns((current) => [...current, createRenameColumn(fieldKind)])
  }
  const updateCell = (fileId: string, columnId: string, value: string) => {
    setOverrides((current) => ({ ...current, [fileId]: { ...current[fileId], [columnId]: value } }))
  }
  const fillDown = (column: RenameColumn) => {
    if (column.kind !== 'literal' && column.kind !== 'manual') return
    const source = previews[0]?.cells[column.id] ?? column.value
    setOverrides((current) => Object.fromEntries(previews.map((preview) => [preview.fileId, { ...current[preview.fileId], [column.id]: source }])))
  }
  const isEditable = (column: RenameColumn) => column.kind === 'literal' || column.kind === 'manual' || column.kind === 'extension' && !lockExtension
  const previewStatus = (preview: StructuredRenamePreview) => {
    if (preview.error) return { label: t(preview.error), className: 'danger-text' }
    if (preview.collision) return { label: t('outputCollision'), className: 'danger-text' }
    if (preview.collisionResolved) return { label: t('collisionResolved'), className: 'warning-text' }
    if (preview.extensionChanged) return { label: t('extensionChanged'), className: 'warning-text' }
    if (preview.changed) return { label: t('preview'), className: 'changed-text' }
    return { label: t('noChange'), className: 'muted' }
  }

  return <section className="structured-workspace">
    <div className="structured-heading">
      <div><h2>{t('structuredBuilder')}</h2><p>{t('structuredIntro')}</p></div>
      <div className="preview-tools">
        <label className="compact-select"><span>{t('sortBy')}</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as RenameSortMode)} aria-label={t('sortBy')}><option value="path">{t('sortPath')}</option><option value="name">{t('sortName')}</option><option value="added">{t('sortAdded')}</option></select></label>
        <div className="segmented compact" role="group" aria-label={t('previewFilter')}>
          <button type="button" className={previewFilter === 'all' ? 'active' : ''} aria-pressed={previewFilter === 'all'} onClick={() => setPreviewFilter('all')}>{t('allItems')}</button>
          <button type="button" className={previewFilter === 'changed' ? 'active' : ''} aria-pressed={previewFilter === 'changed'} onClick={() => setPreviewFilter('changed')}>{t('changedOnly')}</button>
          <button type="button" className={previewFilter === 'issues' ? 'active' : ''} aria-pressed={previewFilter === 'issues'} onClick={() => setPreviewFilter('issues')}>{t('issuesOnly')}</button>
        </div>
      </div>
    </div>
    <div className="structured-summary"><span>{t('structuredSummary', { changed: changedCount, total: previews.length, fields: columns.length })}</span><span className={issueCount ? 'warning-text' : 'muted'}>{t('structuredIssues', { count: issueCount })}</span></div>
    <div className="structured-layout">
      <section className="structured-table-pane">
        <div className="structured-table-scroll table-scroll"><table className="structured-table"><thead><tr>
          <th className="structured-file-column">{t('file')}</th>
          {columns.map((column) => <th key={column.id}><div className="structured-column-title"><span>{column.label || t('unnamedField')}</span></div><small className="structured-kind">{kindLabel(column.kind, t)}</small></th>)}
          <th className="structured-output-column">{t('outputName')}</th><th className="structured-status-column">{t('status')}</th>
        </tr></thead><tbody>
          {visiblePreviews.length ? visiblePreviews.map((preview) => {
            const status = previewStatus(preview)
            return <tr key={preview.fileId} className={preview.error || preview.collision ? 'row-error' : ''}>
              <td className="structured-file-column" title={preview.inputPath}><strong>{preview.before}</strong><small className="preview-path">{preview.inputPath}</small></td>
              {columns.map((column) => <td key={column.id} className="structured-cell">{isEditable(column) ? <input className="structured-cell-input" value={preview.cells[column.id] ?? ''} onChange={(event) => updateCell(preview.fileId, column.id, event.target.value)} aria-label={`${column.label} ${preview.before}`} /> : <span className="structured-generated" title={preview.cells[column.id]}>{preview.cells[column.id] || <span className="muted">{t('emptyValue')}</span>}</span>}</td>)}
              <td className={`structured-output-column ${status.className}`} title={preview.outputPath}>{preview.after}</td><td className={status.className}>{status.label}</td>
            </tr>
          }) : <tr><td colSpan={columns.length + 3}><div className="filtered-empty">{t('noFilteredItems')}</div></td></tr>}
        </tbody></table></div>
        <div className="structured-table-note"><Info size={14} /><span>{t('structuredTableHint')}</span></div>
      </section>
      <aside className="config-pane structured-config-pane">
        <div className="section-heading config-heading"><h2>{t('fields')}</h2><span>{columns.length}</span></div>
        <div className="rename-intro"><Info size={15} /><span>{t('structuredPanelHint')}</span></div>
        <div className="add-rule-row"><select value={fieldKind} onChange={(event) => setFieldKind(event.target.value as StructuredColumnKind)} aria-label={t('fieldType')}>{fieldKinds.map((item) => <option key={item.kind} value={item.kind}>{t(item.labelKey)}</option>)}</select><button type="button" className="btn secondary" onClick={addColumn} disabled={fieldKind === 'extension' && columns.some((column) => column.kind === 'extension')}><CirclePlus size={15} />{t('addField')}</button></div>
        <div className="structured-field-list">{columns.map((column, index) => <div key={column.id} className={`structured-field-card ${column.enabled ? '' : 'disabled'}`}>
          <div className="structured-field-head"><label><input type="checkbox" checked={column.enabled} onChange={(event) => updateColumn(column.id, { enabled: event.target.checked })} />{kindLabel(column.kind, t)}</label><span><button type="button" className="icon-btn subtle" disabled={index === 0} onClick={() => moveColumn(index, -1)} title={t('moveFieldLeft')} aria-label={t('moveFieldLeft')}><ArrowLeft size={14} /></button><button type="button" className="icon-btn subtle" disabled={index === columns.length - 1} onClick={() => moveColumn(index, 1)} title={t('moveFieldRight')} aria-label={t('moveFieldRight')}><ArrowRight size={14} /></button><button type="button" className="icon-btn subtle" disabled={column.kind === 'extension'} onClick={() => duplicateColumn(column, index)} title={t('duplicateField')} aria-label={t('duplicateField')}><Copy size={14} /></button><button type="button" className="icon-btn subtle danger" onClick={() => setColumns((current) => current.filter((item) => item.id !== column.id))} title={t('deleteField')} aria-label={t('deleteField')}><Trash2 size={14} /></button></span></div>
          <label className="field"><span>{t('fieldLabel')}</span><input value={column.label} onChange={(event) => updateColumn(column.id, { label: event.target.value })} /></label>
          {(column.kind === 'literal' || column.kind === 'manual') && <><label className="field"><span>{column.kind === 'manual' ? t('manualDefault') : t('fieldValue')}</span><input value={column.value} placeholder={column.kind === 'manual' ? t('manualPlaceholder') : t('separatorPlaceholder')} onChange={(event) => updateColumn(column.id, { value: event.target.value })} /></label><button type="button" className="btn ghost fill-down" onClick={() => fillDown(column)} disabled={!previews.length}><ArrowDown size={14} />{t('fillDown')}</button></>}
          {column.kind === 'sequence' && <div className="field-grid sequence-fields"><label className="field"><span>{t('sequenceFormat')}</span><select value={column.sequenceFormat} onChange={(event) => updateColumn(column.id, { sequenceFormat: event.target.value as StructuredSequenceFormat })}><option value="arabic">{t('arabicNumbers')}</option><option value="chinese-lower">{t('chineseLowerNumbers')}</option><option value="chinese-upper">{t('chineseUpperNumbers')}</option><option value="roman">{t('romanNumbers')}</option><option value="alpha-upper">{t('alphaUpper')}</option><option value="alpha-lower">{t('alphaLower')}</option></select></label><label className="field"><span>{t('sequenceStart')}</span><input type="number" value={column.sequenceStart} onChange={(event) => updateColumn(column.id, { sequenceStart: Number(event.target.value) })} /></label><label className="field"><span>{t('step')}</span><input type="number" value={column.sequenceStep} onChange={(event) => updateColumn(column.id, { sequenceStep: Number(event.target.value) })} /></label>{column.sequenceFormat === 'arabic' && <label className="field"><span>{t('digits')}</span><input type="number" min="1" max="8" value={column.sequencePad} onChange={(event) => updateColumn(column.id, { sequencePad: Number(event.target.value) })} /></label>}</div>}
          {column.kind === 'date' && <div className="field-grid"><label className="field"><span>{t('dateSource')}</span><select value={column.dateSource} onChange={(event) => updateColumn(column.id, { dateSource: event.target.value as RenameColumn['dateSource'] })}><option value="modified">{t('modifiedDate')}</option><option value="today">{t('todayDate')}</option></select></label><label className="field"><span>{t('dateFormat')}</span><select value={column.dateFormat} onChange={(event) => updateColumn(column.id, { dateFormat: event.target.value as RenameColumn['dateFormat'] })}><option>YYYY-MM-DD</option><option>YYYYMMDD</option><option>YYYY年MM月DD日</option></select></label></div>}
          {column.kind === 'cleaned' && <div className="structured-cleaning"><div className="inline-checks"><label><input type="checkbox" checked={column.cleaning.trim} onChange={(event) => updateCleaning(column.id, { trim: event.target.checked })} />{t('cleanTrim')}</label><label><input type="checkbox" checked={column.cleaning.collapseWhitespace} onChange={(event) => updateCleaning(column.id, { collapseWhitespace: event.target.checked })} />{t('cleanWhitespace')}</label><label><input type="checkbox" checked={column.cleaning.normalizeUnicode} onChange={(event) => updateCleaning(column.id, { normalizeUnicode: event.target.checked })} />{t('cleanUnicode')}</label><label><input type="checkbox" checked={column.cleaning.removeCopySuffix} onChange={(event) => updateCleaning(column.id, { removeCopySuffix: event.target.checked })} />{t('removeCopySuffix')}</label><label><input type="checkbox" checked={column.cleaning.unifySeparators} onChange={(event) => updateCleaning(column.id, { unifySeparators: event.target.checked })} />{t('unifySeparators')}</label></div><div className="field-grid"><label className="field"><span>{t('cleanSeparator')}</span><select value={column.cleaning.separator} onChange={(event) => updateCleaning(column.id, { separator: event.target.value as RenameColumn['cleaning']['separator'] })}><option value="-">-</option><option value="_">_</option><option value=" ">{t('spaceSeparator')}</option></select></label><label className="field"><span>{t('cleanCase')}</span><select value={column.cleaning.case} onChange={(event) => updateCleaning(column.id, { case: event.target.value as RenameColumn['cleaning']['case'] })}><option value="keep">{t('keepCase')}</option><option value="lower">{t('lower')}</option><option value="upper">{t('upper')}</option><option value="title">{t('titleCase')}</option></select></label></div></div>}
          {column.kind === 'extension' && <p className="field-hint">{lockExtension ? t('extensionColumnLocked') : t('extensionColumnEditable')}</p>}
        </div>)}</div>
        <div className="config-options"><label title={t('extensionLockedHint')}><input type="checkbox" checked={lockExtension} onChange={(event) => setLockExtension(event.target.checked)} />{t('lockExtension')}</label><label className="field"><span>{t('collisionHandling')}</span><select value={resolveCollisions ? 'auto' : 'block'} onChange={(event) => setResolveCollisions(event.target.value === 'auto')}><option value="auto">{t('collisionAuto')}</option><option value="block">{t('collisionBlock')}</option></select></label></div>
        {extensionChangeCount > 0 && <p className="field-warning">{t('extensionChangeWarning', { count: extensionChangeCount })}</p>}
        {!changedCount && !invalid && <p className="field-hint">{t('noChanges')}</p>}
        {columns.length === 0 && <p className="field-error">{t('emptyStructure')}</p>}
        <button type="button" className="btn primary wide" disabled={!canRun} onClick={() => onRun(previews)}><Play size={16} />{t('run')}</button>
      </aside>
    </div>
  </section>
}
