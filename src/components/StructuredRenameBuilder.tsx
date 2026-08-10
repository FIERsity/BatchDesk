import { ArrowDown, ArrowLeft, ArrowRight, Info, Play, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildStructuredRenamePreview, createPrimaryOriginalColumn, createRenameColumn, PRIMARY_ORIGINAL_COLUMN_ID } from '../lib/structuredRename'
import type { InputFile, RenameColumn, RenamePreview, RenameSortMode, StructuredColumnKind, StructuredRenameConfig, StructuredRenamePreview, StructuredSequenceFormat } from '../types'

interface StructuredRenameBuilderProps {
  files: InputFile[]
  busy: boolean
  onRun: (previews: RenamePreview[]) => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

type PreviewFilter = 'all' | 'changed' | 'issues'

const fieldKinds: Array<{ kind: StructuredColumnKind; labelKey: string }> = [
  { kind: 'sequence', labelKey: 'sequenceField' },
  { kind: 'literal', labelKey: 'fixedTextField' },
  { kind: 'original', labelKey: 'originalTitleField' },
  { kind: 'extension', labelKey: 'extensionField' },
  { kind: 'manual', labelKey: 'manualField' },
]

function initialColumns(): RenameColumn[] {
  return [createPrimaryOriginalColumn()]
}

function isPrimaryOriginal(column: RenameColumn): boolean {
  return column.id === PRIMARY_ORIGINAL_COLUMN_ID
}

export function StructuredRenameBuilder({ files, busy, onRun, t }: StructuredRenameBuilderProps) {
  const [columns, setColumns] = useState<RenameColumn[]>(initialColumns)
  const [overrides, setOverrides] = useState<Record<string, Record<string, string>>>({})
  const [sortMode, setSortMode] = useState<RenameSortMode>('path')
  const [lockExtension, setLockExtension] = useState(true)
  const [resolveCollisions, setResolveCollisions] = useState(true)
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>('all')
  const [fieldKind, setFieldKind] = useState<StructuredColumnKind>('sequence')

  const config = useMemo<StructuredRenameConfig>(() => ({ columns, sortMode, lockExtension, resolveCollisions }), [columns, lockExtension, resolveCollisions, sortMode])
  const previews = useMemo(() => buildStructuredRenamePreview(files, config, overrides), [config, files, overrides])
  const userColumns = columns.filter((column) => !isPrimaryOriginal(column))
  const changedCount = previews.filter((preview) => preview.changed && !preview.error && !preview.collision).length
  const issueCount = previews.filter((preview) => preview.error || preview.collision).length
  const extensionChangeCount = previews.filter((preview) => preview.extensionChanged && !preview.error && !preview.collision).length
  const visiblePreviews = previews.filter((preview) => previewFilter === 'all' || previewFilter === 'changed' && preview.changed || previewFilter === 'issues' && (preview.error || preview.collision))
  const invalid = issueCount > 0
  const canRun = !busy && !invalid && changedCount > 0 && files.length > 0

  const updateColumn = (id: string, patch: Partial<RenameColumn>) => {
    setColumns((current) => current.map((column) => column.id === id ? { ...column, ...patch } : column))
  }
  const updateCell = (fileId: string, columnId: string, value: string) => {
    setOverrides((current) => ({ ...current, [fileId]: { ...current[fileId], [columnId]: value } }))
  }
  const fillDown = (column: RenameColumn) => {
    const source = previews[0]?.cells[column.id] ?? column.value
    setOverrides((current) => Object.fromEntries(previews.map((preview) => [preview.fileId, { ...current[preview.fileId], [column.id]: source }])))
  }
  const addColumn = () => {
    if (fieldKind === 'extension' && columns.some((column) => column.kind === 'extension')) return
    setColumns((current) => [...current, createRenameColumn(fieldKind)])
  }
  const changeColumnKind = (column: RenameColumn, kind: StructuredColumnKind) => {
    if (isPrimaryOriginal(column) || column.kind === kind) return
    const replacement = createRenameColumn(kind)
    setColumns((current) => current.map((item) => item.id === column.id ? { ...replacement, id: item.id, label: item.label || replacement.label } : item))
    setOverrides((current) => Object.fromEntries(Object.entries(current).map(([fileId, values]) => {
      const { [column.id]: _removed, ...rest } = values
      return [fileId, rest]
    })))
  }
  const removeColumn = (column: RenameColumn) => {
    if (isPrimaryOriginal(column)) return
    setColumns((current) => current.filter((item) => item.id !== column.id))
    setOverrides((current) => Object.fromEntries(Object.entries(current).map(([fileId, values]) => {
      const { [column.id]: _removed, ...rest } = values
      return [fileId, rest]
    })))
  }
  const moveColumn = (column: RenameColumn, delta: -1 | 1) => {
    const index = columns.indexOf(column)
    const target = index + delta
    if (index <= 0 || target <= 0 || target >= columns.length) return
    // Keep an extension column as the last middle field so its output semantics stay obvious.
    if (column.kind === 'extension' || columns[target]?.kind === 'extension') return
    setColumns((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }
  const isEditable = (column: RenameColumn) => column.kind === 'literal' || column.kind === 'manual' || column.kind === 'original' || column.kind === 'extension' && !lockExtension
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
      <div className="structured-heading-actions"><label className="compact-select"><span>{t('sortBy')}</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as RenameSortMode)} aria-label={t('sortBy')}><option value="path">{t('sortPath')}</option><option value="name">{t('sortName')}</option><option value="added">{t('sortAdded')}</option></select></label><div className="segmented compact" role="group" aria-label={t('previewFilter')}><button type="button" className={previewFilter === 'all' ? 'active' : ''} aria-pressed={previewFilter === 'all'} onClick={() => setPreviewFilter('all')}>{t('allItems')}</button><button type="button" className={previewFilter === 'changed' ? 'active' : ''} aria-pressed={previewFilter === 'changed'} onClick={() => setPreviewFilter('changed')}>{t('changedOnly')}</button><button type="button" className={previewFilter === 'issues' ? 'active' : ''} aria-pressed={previewFilter === 'issues'} onClick={() => setPreviewFilter('issues')}>{t('issuesOnly')}</button></div></div>
    </div>
    <div className="structured-toolbar">
      <div className="structured-add-field"><span>{t('addFieldAt')}</span><select value={fieldKind} onChange={(event) => setFieldKind(event.target.value as StructuredColumnKind)} aria-label={t('fieldType')}>{fieldKinds.map((item) => <option key={item.kind} value={item.kind}>{t(item.labelKey)}</option>)}</select><button type="button" className="btn secondary" onClick={addColumn} disabled={fieldKind === 'extension' && columns.some((column) => column.kind === 'extension')}><Plus size={15} />{t('addField')}</button></div>
      <div className="structured-global-options"><label className="structured-toolbar-check" title={t('extensionLockedHint')}><input type="checkbox" checked={lockExtension} onChange={(event) => setLockExtension(event.target.checked)} />{t('lockExtension')}</label><label className="structured-toolbar-select"><span>{t('collisionHandling')}</span><select value={resolveCollisions ? 'auto' : 'block'} onChange={(event) => setResolveCollisions(event.target.value === 'auto')}><option value="auto">{t('collisionAuto')}</option><option value="block">{t('collisionBlock')}</option></select></label><button type="button" className="btn primary" disabled={!canRun} onClick={() => onRun(previews)}><Play size={15} />{t('run')}</button></div>
    </div>
    <div className="structured-summary"><span>{t('structuredSummary', { changed: changedCount, total: previews.length, fields: userColumns.length })}</span><span className={issueCount ? 'warning-text' : 'muted'}>{t('structuredIssues', { count: issueCount })}</span></div>
    <div className="structured-table-pane"><div className="structured-table-scroll table-scroll"><table className="structured-table"><thead><tr>
      <th className="structured-source-column"><div className="structured-anchor-header"><strong>{t('originalTitleColumn')}</strong><small>{t('fixedLeftColumn')}</small></div></th>
      {userColumns.map((column) => { const index = columns.indexOf(column); return <th key={column.id} className="structured-field-column"><div className="structured-field-header"><select value={column.kind} onChange={(event) => changeColumnKind(column, event.target.value as StructuredColumnKind)} aria-label={`${t('fieldType')} ${column.label}`}><option value="sequence">{t('sequenceField')}</option><option value="literal">{t('fixedTextField')}</option><option value="original">{t('originalTitleField')}</option><option value="extension">{t('extensionField')}</option><option value="manual">{t('manualField')}</option></select><input className="structured-field-label" value={column.label} onChange={(event) => updateColumn(column.id, { label: event.target.value })} aria-label={`${t('fieldLabel')} ${column.label}`} /><span className="structured-field-actions"><button type="button" className="icon-btn subtle" disabled={index <= 1 || column.kind === 'extension' || columns[index - 1]?.kind === 'extension'} onClick={() => moveColumn(column, -1)} title={t('moveFieldLeft')} aria-label={t('moveFieldLeft')}><ArrowLeft size={14} /></button><button type="button" className="icon-btn subtle" disabled={index >= columns.length - 1 || column.kind === 'extension' || columns[index + 1]?.kind === 'extension'} onClick={() => moveColumn(column, 1)} title={t('moveFieldRight')} aria-label={t('moveFieldRight')}><ArrowRight size={14} /></button><button type="button" className="icon-btn subtle danger" onClick={() => removeColumn(column)} title={t('deleteField')} aria-label={t('deleteField')}><Trash2 size={14} /></button></span></div>{column.kind === 'sequence' && <div className="structured-field-options"><select value={column.sequenceFormat} onChange={(event) => updateColumn(column.id, { sequenceFormat: event.target.value as StructuredSequenceFormat })} aria-label={`${t('sequenceFormat')} ${column.label}`}><option value="arabic">{t('arabicNumbers')}</option><option value="chinese-lower">{t('chineseLowerNumbers')}</option><option value="chinese-upper">{t('chineseUpperNumbers')}</option><option value="roman">{t('romanNumbers')}</option><option value="alpha-upper">{t('alphaUpper')}</option><option value="alpha-lower">{t('alphaLower')}</option></select><input type="number" min="0" value={column.sequenceStart} onChange={(event) => updateColumn(column.id, { sequenceStart: Number(event.target.value) })} aria-label={`${t('sequenceStart')} ${column.label}`} /><input type="number" value={column.sequenceStep} onChange={(event) => updateColumn(column.id, { sequenceStep: Number(event.target.value) })} aria-label={`${t('step')} ${column.label}`} />{column.sequenceFormat === 'arabic' && <input type="number" min="1" max="8" value={column.sequencePad} onChange={(event) => updateColumn(column.id, { sequencePad: Number(event.target.value) })} aria-label={`${t('digits')} ${column.label}`} />}</div>}{column.kind === 'literal' && <div className="structured-field-default"><input value={column.value} onChange={(event) => updateColumn(column.id, { value: event.target.value })} placeholder={t('separatorPlaceholder')} aria-label={`${t('fieldValue')} ${column.label}`} /><button type="button" className="icon-btn subtle" onClick={() => fillDown(column)} disabled={!previews.length} title={t('fillDown')} aria-label={t('fillDown')}><ArrowDown size={14} /></button></div>}{column.kind === 'manual' && <div className="structured-field-default"><input value={column.value} onChange={(event) => updateColumn(column.id, { value: event.target.value })} placeholder={t('manualPlaceholder')} aria-label={`${t('manualDefault')} ${column.label}`} /><button type="button" className="icon-btn subtle" onClick={() => fillDown(column)} disabled={!previews.length} title={t('fillDown')} aria-label={t('fillDown')}><ArrowDown size={14} /></button></div>}{column.kind === 'extension' && <small className="structured-field-hint">{lockExtension ? t('extensionColumnLocked') : t('extensionColumnEditable')}</small>}</th> })}
      <th className="structured-preview-column"><div className="structured-anchor-header"><strong>{t('previewTitleColumn')}</strong><small>{t('fixedRightColumn')}</small></div></th>
    </tr></thead><tbody>
      {visiblePreviews.length ? visiblePreviews.map((preview) => { const status = previewStatus(preview); return <tr key={preview.fileId} className={preview.error || preview.collision ? 'row-error' : ''}><td className="structured-source-column" title={preview.inputPath}><input className="structured-cell-input" value={preview.cells[PRIMARY_ORIGINAL_COLUMN_ID] ?? ''} onChange={(event) => updateCell(preview.fileId, PRIMARY_ORIGINAL_COLUMN_ID, event.target.value)} aria-label={`${t('originalTitleColumn')} ${preview.before}`} /><small className="preview-path">{preview.inputPath}</small></td>{userColumns.map((column) => <td key={column.id} className="structured-cell">{isEditable(column) ? <input className="structured-cell-input" value={preview.cells[column.id] ?? ''} onChange={(event) => updateCell(preview.fileId, column.id, event.target.value)} aria-label={`${column.label} ${preview.before}`} /> : <span className="structured-generated" title={preview.cells[column.id]}>{preview.cells[column.id] || <span className="muted">{t('emptyValue')}</span>}</span>}</td>)}<td className={`structured-preview-column structured-preview-cell ${status.className}`} title={preview.outputPath}><strong>{preview.after || t('emptyValue')}</strong><small>{status.label}</small></td></tr> }) : <tr><td colSpan={columns.length + 1}><div className="filtered-empty">{t('noFilteredItems')}</div></td></tr>}
    </tbody></table></div><div className="structured-table-note"><Info size={14} /><span>{t('structuredTableHint')}</span>{extensionChangeCount > 0 && <span className="warning-text">{t('extensionChangeWarning', { count: extensionChangeCount })}</span>}</div></div>
    {!changedCount && !invalid && <p className="structured-empty-hint">{t('structuredNoChanges')}</p>}
  </section>
}
