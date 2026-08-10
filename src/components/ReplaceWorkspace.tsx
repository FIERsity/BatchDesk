import { ArrowLeft, Play, Search, SquareCheckBig } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { DocxReplaceConfig, FilePreview, InputFile, XlsxReplaceConfig } from '../types'

type ReplaceOperation = 'docx-replace' | 'xlsx-replace'

interface ReplaceWorkspaceProps {
  operation: ReplaceOperation
  files: InputFile[]
  busy: boolean
  onBack: () => void
  onScan: (operation: ReplaceOperation, config: DocxReplaceConfig | XlsxReplaceConfig) => Promise<FilePreview[]>
  onRun: (operation: ReplaceOperation, config: DocxReplaceConfig | XlsxReplaceConfig, previews: FilePreview[]) => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

const initialDocx: DocxReplaceConfig = { find: '', replacement: '', mode: 'exact', caseSensitive: false, scopes: { body: true, headers: true, footnotes: true } }
const initialXlsx: XlsxReplaceConfig = { find: '', replacement: '', wholeCell: false, caseSensitive: false, sheetNames: [] }

export function ReplaceWorkspace({ operation, files, busy, onBack, onScan, onRun, t }: ReplaceWorkspaceProps) {
  const [docxConfig, setDocxConfig] = useState(initialDocx)
  const [xlsxConfig, setXlsxConfig] = useState(initialXlsx)
  const [previews, setPreviews] = useState<FilePreview[]>([])
  const [scannedSignature, setScannedSignature] = useState('')
  const config = operation === 'docx-replace' ? docxConfig : xlsxConfig
  const signature = JSON.stringify(config)
  const stale = Boolean(previews.length) && scannedSignature !== signature
  const matches = previews.flatMap((preview) => preview.matches)
  const selectedMatches = matches.filter((match) => match.selected).length
  const sheetNames = useMemo(() => [...new Set(previews.flatMap((preview) => (preview.metadata?.sheetNames as string[] | undefined) ?? []))], [previews])

  const scan = async () => {
    const result = await onScan(operation, config)
    setPreviews(result)
    setScannedSignature(signature)
  }
  const toggleMatch = (id: string) => setPreviews((current) => current.map((preview) => ({ ...preview, matches: preview.matches.map((match) => match.id === id ? { ...match, selected: !match.selected } : match) })))
  const toggleAll = () => {
    const next = selectedMatches !== matches.length
    setPreviews((current) => current.map((preview) => ({ ...preview, matches: preview.matches.map((match) => ({ ...match, selected: next })) })))
  }

  return (
    <main className="workspace task-workspace">
      <div className="task-heading"><button type="button" className="icon-btn" onClick={onBack} title={t('backInbox')}><ArrowLeft size={18} /></button><div><span>{t('inbox')} /</span><h1>{operation === 'docx-replace' ? t('wordReplace') : t('excelReplace')}</h1></div><div className="heading-meta">{t('selectedCount', { count: files.length })}</div></div>
      <div className="task-layout">
        <section className="preview-pane">
          <div className="section-heading"><div><h2>{t('matches')}</h2><p>{t('selectedMatches', { count: selectedMatches })}</p></div>{matches.length > 0 && <button type="button" className="btn ghost" onClick={toggleAll}><SquareCheckBig size={15} />{t('selectAll')}</button>}</div>
          {previews.length === 0 ? <div className="empty-preview"><Search size={28} /><span>{t('scan')}</span></div> : matches.length === 0 ? <div className="empty-preview"><Search size={28} /><span>{t('noMatches')}</span></div> : (
            <div className="table-scroll task-table-scroll"><table className="preview-table matches-table"><thead><tr><th className="check-cell" /><th>{t('file')}</th><th>{t('location')}</th><th>{t('context')}</th><th>{t('after')}</th></tr></thead><tbody>
              {previews.flatMap((preview) => preview.matches.map((match) => <tr key={match.id}><td className="check-cell"><input type="checkbox" checked={match.selected} onChange={() => toggleMatch(match.id)} aria-label={match.location} /></td><td>{preview.fileName}</td><td className="location-cell">{match.location}</td><td className="context-cell" title={match.context}>{match.context}</td><td className="changed-text">{match.after || '∅'}</td></tr>))}
            </tbody></table></div>
          )}
          {previews.some((preview) => preview.warnings.length) && <div className="warning-list">{previews.filter((preview) => preview.warnings.length).map((preview) => <p key={preview.fileId}><strong>{preview.fileName}</strong>: {preview.warnings.map((warning) => t(warning)).join('; ')}</p>)}</div>}
        </section>

        <aside className="config-pane">
          <div className="section-heading"><h2>{operation === 'docx-replace' ? 'DOCX' : 'XLSX'}</h2><span>{files.length}</span></div>
          <label className="field"><span>{t('find')}</span><textarea rows={4} value={config.find} onChange={(event) => operation === 'docx-replace' ? setDocxConfig((current) => ({ ...current, find: event.target.value })) : setXlsxConfig((current) => ({ ...current, find: event.target.value }))} /></label>
          <label className="field"><span>{t('replacement')}</span><textarea rows={4} value={config.replacement} onChange={(event) => operation === 'docx-replace' ? setDocxConfig((current) => ({ ...current, replacement: event.target.value })) : setXlsxConfig((current) => ({ ...current, replacement: event.target.value }))} /></label>
          {operation === 'docx-replace' ? <>
            <fieldset><legend>{t('matchMode')}</legend><div className="segmented wide"><button type="button" className={docxConfig.mode === 'exact' ? 'active' : ''} onClick={() => setDocxConfig((current) => ({ ...current, mode: 'exact' }))}>{t('exact')}</button><button type="button" className={docxConfig.mode === 'flexible-whitespace' ? 'active' : ''} onClick={() => setDocxConfig((current) => ({ ...current, mode: 'flexible-whitespace' }))}>{t('flexibleWhitespace')}</button></div></fieldset>
            <fieldset><legend>{t('scope')}</legend><div className="stacked-checks"><label><input type="checkbox" checked={docxConfig.scopes.body} onChange={(event) => setDocxConfig((current) => ({ ...current, scopes: { ...current.scopes, body: event.target.checked } }))} />{t('bodyTables')}</label><label><input type="checkbox" checked={docxConfig.scopes.headers} onChange={(event) => setDocxConfig((current) => ({ ...current, scopes: { ...current.scopes, headers: event.target.checked } }))} />{t('headersFooters')}</label><label><input type="checkbox" checked={docxConfig.scopes.footnotes} onChange={(event) => setDocxConfig((current) => ({ ...current, scopes: { ...current.scopes, footnotes: event.target.checked } }))} />{t('notes')}</label></div></fieldset>
          </> : <>
            <fieldset><legend>{t('matchMode')}</legend><div className="segmented wide"><button type="button" className={!xlsxConfig.wholeCell ? 'active' : ''} onClick={() => setXlsxConfig((current) => ({ ...current, wholeCell: false }))}>{t('substring')}</button><button type="button" className={xlsxConfig.wholeCell ? 'active' : ''} onClick={() => setXlsxConfig((current) => ({ ...current, wholeCell: true }))}>{t('wholeCell')}</button></div></fieldset>
            {sheetNames.length > 0 && <fieldset><legend>{t('sheets')}</legend><div className="sheet-list"><label><input type="checkbox" checked={xlsxConfig.sheetNames.length === 0} onChange={() => setXlsxConfig((current) => ({ ...current, sheetNames: [] }))} />{t('allSheets')}</label>{sheetNames.map((sheet) => <label key={sheet}><input type="checkbox" checked={xlsxConfig.sheetNames.includes(sheet)} onChange={(event) => setXlsxConfig((current) => ({ ...current, sheetNames: event.target.checked ? [...current.sheetNames, sheet] : current.sheetNames.filter((item) => item !== sheet) }))} />{sheet}</label>)}</div></fieldset>}
            <p className="safety-note">{t('formulasSafe')}</p>
          </>}
          <label className="single-check"><input type="checkbox" checked={config.caseSensitive} onChange={(event) => operation === 'docx-replace' ? setDocxConfig((current) => ({ ...current, caseSensitive: event.target.checked })) : setXlsxConfig((current) => ({ ...current, caseSensitive: event.target.checked }))} />{t('caseSensitive')}</label>
          {stale && <p className="field-error">{operation === 'xlsx-replace' ? t('rescanAfterSheets') : t('previewRequired')}</p>}
          <button type="button" className="btn secondary wide" disabled={busy || !config.find || (operation === 'docx-replace' && !Object.values(docxConfig.scopes).some(Boolean))} onClick={() => void scan()}><Search size={16} />{t('scan')}</button>
          <button type="button" className="btn primary wide" disabled={busy || stale || !selectedMatches} onClick={() => onRun(operation, config, previews)}><Play size={16} />{t('run')}</button>
        </aside>
      </div>
    </main>
  )
}
