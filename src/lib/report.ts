import JSZip from 'jszip'
import type { BatchReport, FileOperationResult, OutputArtifact, ProcessorId } from '../types'
import { sanitizeOutputPath } from './files'

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function createBatchReport(jobId: string, operation: ProcessorId, files: FileOperationResult[]): BatchReport {
  return {
    schemaVersion: 1,
    jobId,
    operation,
    createdAt: new Date().toISOString(),
    totals: {
      input: files.length,
      success: files.filter((file) => file.status === 'success').length,
      skipped: files.filter((file) => file.status === 'skipped').length,
      failed: files.filter((file) => file.status === 'failed').length,
    },
    files,
  }
}

export function reportToCsv(report: BatchReport): string {
  const header = ['inputPath', 'outputPath', 'status', 'matchCount', 'appliedCount', 'warnings', 'error']
  const rows = report.files.map((file) => [
    file.inputPath,
    file.outputPath,
    file.status,
    file.matchCount,
    file.appliedCount,
    file.warnings.join('; '),
    file.error ?? '',
  ].map(csvCell).join(','))
  return `\uFEFF${[header.join(','), ...rows].join('\n')}`
}

export async function packageArtifacts(artifacts: OutputArtifact[], report: BatchReport): Promise<{ bundle: Blob; reportJson: Blob; reportCsv: Blob }> {
  const zip = new JSZip()
  for (const artifact of artifacts) zip.file(sanitizeOutputPath(artifact.relativePath), artifact.blob)
  const json = JSON.stringify(report, null, 2)
  const csv = reportToCsv(report)
  zip.file('batchdesk-report.json', json)
  zip.file('batchdesk-report.csv', csv)
  const bundle = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  return {
    bundle,
    reportJson: new Blob([json], { type: 'application/json' }),
    reportCsv: new Blob([csv], { type: 'text/csv;charset=utf-8' }),
  }
}
