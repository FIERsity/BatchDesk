import { ArrowLeft, ArrowRight, Copy, Info, Play, Plus, Redo2, Trash2, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildStructuredRenamePreview, createRenameColumn } from '../lib/structuredRename'
import { splitFileName } from '../lib/files'
import type { InputFile, RenameColumn, RenamePreview, RenameSortMode, StructuredColumnKind, StructuredRenameConfig, StructuredRenamePreview, StructuredSequenceFormat } from '../types'

interface StructuredRenameBuilderProps {
  files: InputFile[]
  busy: boolean
  onRun: (previews: RenamePreview[]) => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

interface EditorState {
  columns: RenameColumn[]
  overrides: Record<string, Record<string, string>>
  sortMode: RenameSortMode
}

interface HistoryState {
  past: EditorState[]
  present: EditorState
  future: EditorState[]
}

const fieldKinds: Array<{ kind: StructuredColumnKind; labelKey: string }> = [
  { kind: 'sequence', labelKey: 'sequenceField' },
  { kind: 'literal', labelKey: 'fixedTextField' },
  { kind: 'manual', labelKey: 'manualImportField' },
]

function initialEditorState(): EditorState {
  return { columns: [], overrides: {}, sortMode: 'path' }
}

function sameEditorState(left: EditorState, right: EditorState): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isEditable(column: RenameColumn): boolean {
  return column.kind === 'manual'
}

export function StructuredRenameBuilder({ files, busy, onRun, t }: StructuredRenameBuilderProps) {
  const [history, setHistory] = useState<HistoryState>(() => ({ past: [], present: initialEditorState(), future: [] }))
  const [fieldKind, setFieldKind] = useState<StructuredColumnKind>('sequence')

  const { columns, overrides, sortMode } = history.present
  const config = useMemo<StructuredRenameConfig>(() => ({ columns, sortMode }), [columns, sortMode])
  const previews = useMemo(() => buildStructuredRenamePreview(files, config, overrides), [config, files, overrides])
  const changedCount = previews.filter((preview) => preview.changed && !preview.error && !preview.collision).length
  const issueCount = previews.filter((preview) => preview.error || preview.collision).length
  const canRun = !busy && issueCount === 0 && changedCount > 0 && files.length > 0

  const commit = useCallback((update: (state: EditorState) => EditorState) => {
    setHistory((current) => {
      const next = update(current.present)
      if (sameEditorState(next, current.present)) return current
      return { past: [...current.past, current.present], present: next, future: [] }
    })
  }, [])

  const undo = useCallback(() => {
    setHistory((current) => {
      if (!current.past.length) return current
      const previous = current.past[current.past.length - 1]
      return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] }
    })
  }, [])

  const redo = useCallback(() => {
    setHistory((current) => {
      if (!current.future.length) return current
      const [next, ...future] = current.future
      return { past: [...current.past, current.present], present: next, future }
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'z') return
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [redo, undo])

  const updateColumn = (id: string, patch: Partial<RenameColumn>) => {
    commit((current) => ({ ...current, columns: current.columns.map((column) => column.id === id ? { ...column, ...patch } : column) }))
  }
  const updateCell = (fileId: string, columnId: string, value: string) => {
    commit((current) => ({ ...current, overrides: { ...current.overrides, [fileId]: { ...current.overrides[fileId], [columnId]: value } } }))
  }
  const importOriginalNames = (column: RenameColumn) => {
    commit((current) => ({
      ...current,
      overrides: Object.fromEntries(previews.map((preview) => [preview.fileId, { ...current.overrides[preview.fileId], [column.id]: splitFileName(preview.before).stem }])),
    }))
  }
  const addColumn = () => {
    commit((current) => ({ ...current, columns: [...current.columns, createRenameColumn(fieldKind)] }))
  }
  const removeColumn = (column: RenameColumn) => {
    commit((current) => ({
      ...current,
      columns: current.columns.filter((item) => item.id !== column.id),
      overrides: Object.fromEntries(Object.entries(current.overrides).map(([fileId, values]) => {
        const { [column.id]: _removed, ...rest } = values
        return [fileId, rest]
      })),
    }))
  }
  const moveColumn = (column: RenameColumn, delta: -1 | 1) => {
    const index = columns.indexOf(column)
    const target = index + delta
    if (index < 0 || target < 0 || target >= columns.length) return
    commit((current) => {
      const next = [...current.columns]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...current, columns: next }
    })
  }
  const updateSortMode = (nextSortMode: RenameSortMode) => {
    commit((current) => ({ ...current, sortMode: nextSortMode }))
  }
  const previewStatus = (preview: StructuredRenamePreview) => {
    if (preview.error) return { label: t(preview.error), className: 'danger-text' }
    if (preview.collision) return { label: t('outputCollision'), className: 'danger-text' }
    if (preview.collisionResolved) return { label: t('collisionResolved'), className: 'warning-text' }
    if (preview.changed) return { label: t('preview'), className: 'changed-text' }
    return { label: t('noChange'), className: 'muted' }
  }

  return <section className="structured-workspace">
    <div className="structured-heading">
      <div><h2>{t('structuredBuilder')}</h2><p>{t('structuredCompactIntro')}</p></div>
      <label className="compact-select"><span>{t('sortBy')}</span><select value={sortMode} onChange={(event) => updateSortMode(event.target.value as RenameSortMode)} aria-label={t('sortBy')}><option value="path">{t('sortPath')}</option><option value="name">{t('sortName')}</option><option value="added">{t('sortAdded')}</option></select></label>
    </div>
    <div className="structured-toolbar">
      <div className="structured-add-field"><span>{t('addFieldAt')}</span><select value={fieldKind} onChange={(event) => setFieldKind(event.target.value as StructuredColumnKind)} aria-label={t('fieldType')}>{fieldKinds.map((item) => <option key={item.kind} value={item.kind}>{t(item.labelKey)}</option>)}</select><button type="button" className="btn secondary" onClick={addColumn}><Plus size={15} />{t('addField')}</button></div>
      <div className="structured-global-options"><div className="structured-history-actions"><button type="button" className="icon-btn subtle" disabled={!history.past.length} onClick={undo} title={t('undo')} aria-label={t('undo')}><Undo2 size={15} /></button><button type="button" className="icon-btn subtle" disabled={!history.future.length} onClick={redo} title={t('redo')} aria-label={t('redo')}><Redo2 size={15} /></button></div><span className="structured-collision-policy">{t('structuredCollisionPolicy')}</span><button type="button" className="btn primary" disabled={!canRun} onClick={() => onRun(previews)}><Play size={15} />{t('run')}</button></div>
    </div>
    <div className="structured-summary"><span>{t('structuredSummary', { changed: changedCount, total: previews.length, fields: columns.length })}</span><span className={issueCount ? 'warning-text' : 'muted'}>{t('structuredIssues', { count: issueCount })}</span></div>
    <div className="structured-table-pane"><div className="structured-table-scroll table-scroll"><table className="structured-table"><thead><tr>
      <th className="structured-source-column"><div className="structured-anchor-header"><strong>{t('originalFileNameColumn')}</strong><small>{t('fixedLeftColumn')}</small></div></th>
      {columns.map((column, index) => <th key={column.id} className="structured-field-column"><div className="structured-field-header"><span className="structured-field-kind" title={t(column.kind === 'sequence' ? 'sequenceField' : column.kind === 'literal' ? 'fixedTextField' : 'manualImportField')}>{t(column.kind === 'sequence' ? 'sequenceField' : column.kind === 'literal' ? 'fixedTextField' : 'manualImportField')}</span><span className="structured-field-actions"><button type="button" className="icon-btn subtle" disabled={index === 0} onClick={() => moveColumn(column, -1)} title={t('moveFieldLeft')} aria-label={t('moveFieldLeft')}><ArrowLeft size={14} /></button><button type="button" className="icon-btn subtle" disabled={index === columns.length - 1} onClick={() => moveColumn(column, 1)} title={t('moveFieldRight')} aria-label={t('moveFieldRight')}><ArrowRight size={14} /></button><button type="button" className="icon-btn subtle danger" onClick={() => removeColumn(column)} title={t('deleteField')} aria-label={t('deleteField')}><Trash2 size={14} /></button></span></div>{column.kind === 'sequence' && <div className="structured-field-options"><select value={column.sequenceFormat} onChange={(event) => updateColumn(column.id, { sequenceFormat: event.target.value as StructuredSequenceFormat })} aria-label={`${t('sequenceFormat')} ${column.label}`}><option value="arabic">{t('arabicNumbers')}</option><option value="chinese-lower">{t('chineseLowerNumbers')}</option></select></div>}{column.kind === 'literal' && <div className="structured-field-default"><input value={column.value} onChange={(event) => updateColumn(column.id, { value: event.target.value })} placeholder={t('separatorPlaceholder')} aria-label={`${t('fieldValue')} ${column.label}`} /></div>}{column.kind === 'manual' && <><div className="structured-field-default"><input value={column.value} onChange={(event) => updateColumn(column.id, { value: event.target.value })} placeholder={t('manualPlaceholder')} aria-label={`${t('manualDefault')} ${column.label}`} /></div><div className="structured-field-row-actions"><button type="button" className="btn ghost" onClick={() => importOriginalNames(column)} disabled={!previews.length}><Copy size={13} />{t('importOriginalName')}</button></div></>}</th>)}
      <th className="structured-preview-column"><div className="structured-anchor-header"><strong>{t('previewFileNameColumn')}</strong><small>{t('fixedRightColumn')}</small></div></th>
    </tr></thead><tbody>
      {previews.length ? previews.map((preview) => { const status = previewStatus(preview); return <tr key={preview.fileId} className={preview.error || preview.collision ? 'row-error' : ''}><td className="structured-source-column" title={preview.inputPath}><div className="structured-source-value"><strong>{preview.before}</strong>{preview.inputPath !== preview.before && <small>{preview.inputPath}</small>}</div></td>{columns.map((column) => <td key={column.id} className="structured-cell">{isEditable(column) ? <input className="structured-cell-input" value={preview.cells[column.id] ?? ''} onChange={(event) => updateCell(preview.fileId, column.id, event.target.value)} aria-label={`${column.label} ${preview.before}`} /> : <span className="structured-generated" title={preview.cells[column.id]}>{preview.cells[column.id] || <span className="muted">{t('emptyValue')}</span>}</span>}</td>)}<td className={`structured-preview-column structured-preview-cell ${status.className}`} title={preview.outputPath}><strong>{preview.after || t('emptyValue')}</strong><small>{status.label}</small></td></tr> }) : <tr><td colSpan={columns.length + 2}><div className="filtered-empty">{t('emptyPreview')}</div></td></tr>}
    </tbody></table></div><div className="structured-table-note"><Info size={14} /><span>{t('structuredCompactTableHint')}</span></div></div>
    {!changedCount && !issueCount && <p className="structured-empty-hint">{t('structuredNoChanges')}</p>}
  </section>
}
