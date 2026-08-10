/// <reference lib="webworker" />

import { docxProcessor, inspectDocx } from '../lib/docx'
import { inspectXlsx, xlsxProcessor } from '../lib/xlsx'
import { createBatchReport, packageArtifacts } from '../lib/report'
import type { FileOperationResult, InputFile, OutputArtifact } from '../types'
import type { OperationConfig, WorkerRequest, WorkerResponse } from './protocol'

const scope = self as unknown as DedicatedWorkerGlobalScope
const controllers = new Map<string, AbortController>()

function send(message: WorkerResponse) {
  scope.postMessage(message)
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, task: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await task(items[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

async function auditFiles(jobId: string, files: InputFile[], signal: AbortSignal) {
  const invalid: string[] = []
  await mapWithConcurrency(files, 2, async (file, index) => {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const result = file.kind === 'docx' ? await inspectDocx(file.file) : file.kind === 'xlsx' ? await inspectXlsx(file.file) : 'valid'
    if (result === 'invalid') invalid.push(file.id)
    send({ type: 'JOB_PROGRESS', jobId, completed: index + 1, total: files.length, phase: 'audit', currentFile: file.name })
  })
  send({ type: 'AUDIT_RESULT', jobId, invalidFileIds: invalid })
}

async function previewOperation(request: Extract<WorkerRequest, { type: 'PREVIEW_OPERATION' }>, signal: AbortSignal) {
  const { jobId, files, operation, config } = request
  const applicable = files.filter((file) => operation === 'docx-replace' ? docxProcessor.supports(file) : xlsxProcessor.supports(file))
  const previews = await mapWithConcurrency(applicable, 2, async (file, index) => {
    const preview = operation === 'docx-replace'
      ? await docxProcessor.scan(file, config as Parameters<typeof docxProcessor.scan>[1], signal)
      : await xlsxProcessor.scan(file, config as Parameters<typeof xlsxProcessor.scan>[1], signal)
    send({ type: 'JOB_PROGRESS', jobId, completed: index + 1, total: applicable.length, phase: 'preview', currentFile: file.name })
    return preview
  })
  send({ type: 'PREVIEW_RESULT', jobId, previews })
}

function resultFor(file: InputFile, outputPath: string, status: FileOperationResult['status'], matchCount = 0, appliedCount = 0, warnings: string[] = [], error?: string): FileOperationResult {
  return { inputPath: file.relativePath, outputPath, status, matchCount, appliedCount, warnings, error }
}

async function runRename(jobId: string, files: InputFile[], payload: Extract<OperationConfig, { operation: 'rename' }>, signal: AbortSignal) {
  const previews = new Map(payload.previews.map((preview) => [preview.fileId, preview]))
  const artifacts: OutputArtifact[] = []
  const results: FileOperationResult[] = []
  files.forEach((file, index) => {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
    const preview = previews.get(file.id)
    if (!preview || preview.error || preview.collision) {
      results.push(resultFor(file, preview?.outputPath ?? file.relativePath, 'failed', 0, 0, [], preview?.error ?? 'invalidRename'))
    } else {
      artifacts.push({ fileId: file.id, fileName: preview.after, relativePath: preview.outputPath, blob: file.file, appliedCount: preview.changed ? 1 : 0, warnings: [] })
      results.push(resultFor(file, preview.outputPath, 'success', preview.changed ? 1 : 0, preview.changed ? 1 : 0))
    }
    send({ type: 'JOB_PROGRESS', jobId, completed: index + 1, total: files.length, phase: 'process', currentFile: file.name })
  })
  return { artifacts, results }
}

async function runReplacement(jobId: string, files: InputFile[], payload: Exclude<OperationConfig, { operation: 'rename' }>, signal: AbortSignal) {
  const previews = new Map((payload.previews ?? []).map((preview) => [preview.fileId, preview]))
  const applicable = files.filter((file) => payload.operation === 'docx-replace' ? docxProcessor.supports(file) : xlsxProcessor.supports(file))
  const artifacts: OutputArtifact[] = []
  const results = await mapWithConcurrency(applicable, 2, async (file, index) => {
    const preview = previews.get(file.id)
    if (!preview || preview.status !== 'ready') {
      const result = resultFor(file, file.relativePath, 'skipped', preview?.matches.length ?? 0, 0, preview?.warnings ?? ['fileNotReady'])
      send({ type: 'JOB_PROGRESS', jobId, completed: index + 1, total: applicable.length, phase: 'process', currentFile: file.name })
      return result
    }
    try {
      const artifact = payload.operation === 'docx-replace'
        ? await docxProcessor.apply(file, payload.config, preview, signal)
        : await xlsxProcessor.apply(file, payload.config, preview, signal)
      artifacts.push(artifact)
      return resultFor(file, artifact.relativePath, 'success', preview.matches.length, artifact.appliedCount, artifact.warnings)
    } catch (error) {
      return resultFor(file, file.relativePath, 'failed', preview.matches.length, 0, [], error instanceof Error ? error.message : 'processingFailed')
    } finally {
      send({ type: 'JOB_PROGRESS', jobId, completed: index + 1, total: applicable.length, phase: 'process', currentFile: file.name })
    }
  })
  return { artifacts, results }
}

async function runOperation(request: Extract<WorkerRequest, { type: 'RUN_OPERATION' }>, signal: AbortSignal) {
  const output = request.payload.operation === 'rename'
    ? await runRename(request.jobId, request.files, request.payload, signal)
    : await runReplacement(request.jobId, request.files, request.payload, signal)
  send({ type: 'JOB_PROGRESS', jobId: request.jobId, completed: output.artifacts.length, total: output.artifacts.length, phase: 'package' })
  const report = createBatchReport(request.jobId, request.payload.operation, output.results)
  const packaged = await packageArtifacts(output.artifacts, report)
  send({ type: 'RUN_RESULT', jobId: request.jobId, artifacts: output.artifacts, report, ...packaged })
}

scope.addEventListener('message', (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (request.type === 'CANCEL_JOB') {
    controllers.get(request.jobId)?.abort()
    return
  }
  const controller = new AbortController()
  controllers.set(request.jobId, controller)
  send({ type: 'JOB_PROGRESS', jobId: request.jobId, completed: 0, total: 'files' in request ? request.files.length : 0, phase: request.type === 'AUDIT_FILES' ? 'audit' : request.type === 'PREVIEW_OPERATION' ? 'preview' : 'process' })
  const work = request.type === 'AUDIT_FILES'
    ? auditFiles(request.jobId, request.files, controller.signal)
    : request.type === 'PREVIEW_OPERATION'
      ? previewOperation(request, controller.signal)
      : runOperation(request, controller.signal)
  void work.catch((error) => {
    if (error instanceof DOMException && error.name === 'AbortError') send({ type: 'JOB_CANCELLED', jobId: request.jobId })
    else send({ type: 'JOB_ERROR', jobId: request.jobId, error: error instanceof Error ? error.message : 'jobFailed' })
  }).finally(() => controllers.delete(request.jobId))
})
