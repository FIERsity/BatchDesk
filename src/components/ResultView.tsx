import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, Download, FileJson, FolderDown, TableProperties } from 'lucide-react'
import type { BatchReport, OutputArtifact } from '../types'

export interface CompletedResult {
  bundle: Blob
  report: BatchReport
  reportJson: Blob
  reportCsv: Blob
  artifacts: OutputArtifact[]
}

interface ResultViewProps {
  result: CompletedResult
  onBack: () => void
  onDownload: (blob: Blob, name: string) => void
  onSaveFolder: () => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

export function ResultView({ result, onBack, onDownload, onSaveFolder, t }: ResultViewProps) {
  const { report } = result
  const stamp = report.createdAt.slice(0, 10)
  const tone = report.totals.failed > 0
    ? report.totals.success > 0 || report.totals.skipped > 0 ? 'warning' : 'error'
    : report.totals.skipped > 0 ? 'warning' : 'success'
  const title = tone === 'error' ? t('operationFailed') : tone === 'warning' ? t('completeWithIssues') : t('complete')
  return <main className="workspace result-workspace">
    <div className={`result-hero ${tone}`}>{tone === 'error' ? <AlertCircle size={34} /> : tone === 'warning' ? <AlertTriangle size={34} /> : <CheckCircle2 size={34} />}<div><h1>{title}</h1><p>{t('resultSummary', { success: report.totals.success, skipped: report.totals.skipped, failed: report.totals.failed })}</p></div></div>
    <div className="result-actions"><button type="button" className="btn primary" onClick={() => onDownload(result.bundle, `batchdesk-${stamp}.zip`)}><Download size={16} />{t('downloadZip')}</button><button type="button" className="btn secondary" onClick={onSaveFolder}><FolderDown size={16} />{t('saveFolder')}</button><button type="button" className="btn secondary" onClick={() => onDownload(result.reportCsv, `batchdesk-report-${stamp}.csv`)}><TableProperties size={16} />{t('downloadCsv')}</button><button type="button" className="btn secondary" onClick={() => onDownload(result.reportJson, `batchdesk-report-${stamp}.json`)}><FileJson size={16} />{t('downloadJson')}</button></div>
    <section className="file-surface result-surface"><div className="section-heading"><h2>{t('report')}</h2><span>{report.files.length}</span></div><div className="table-scroll"><table className="preview-table"><thead><tr><th>{t('file')}</th><th>{t('after')}</th><th>{t('status')}</th><th>{t('matches')}</th><th>{t('applied')}</th><th>{t('issues')}</th></tr></thead><tbody>{report.files.map((file) => <tr key={`${file.inputPath}-${file.outputPath}`}><td>{file.inputPath}</td><td>{file.outputPath}</td><td><span className={`status-pill ${file.status === 'success' ? 'ready' : file.status === 'skipped' ? 'warning' : 'error'}`}>{t(file.status)}</span></td><td className="numeric">{file.matchCount}</td><td className="numeric">{file.appliedCount}</td><td className="muted">{[...file.warnings.map((warning) => t(warning)), file.error ? t(file.error) : ''].filter(Boolean).join('; ') || '—'}</td></tr>)}</tbody></table></div></section>
    <button type="button" className="btn ghost result-back" onClick={onBack}><ArrowLeft size={16} />{t('startAnother')}</button>
  </main>
}
