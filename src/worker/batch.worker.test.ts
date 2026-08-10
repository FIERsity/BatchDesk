import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocxReplaceConfig, FilePreview, InputFile } from '../types'
import type { WorkerRequest, WorkerResponse } from './protocol'

const mocks = vi.hoisted(() => ({
  applyDocx: vi.fn(),
  inspectDocx: vi.fn(),
  packageArtifacts: vi.fn(),
}))

vi.mock('../lib/docx', () => ({
  inspectDocx: mocks.inspectDocx,
  docxProcessor: {
    supports: () => true,
    scan: vi.fn(),
    apply: mocks.applyDocx,
  },
}))

vi.mock('../lib/xlsx', () => ({
  inspectXlsx: vi.fn(async () => 'valid'),
  xlsxProcessor: { supports: () => false, scan: vi.fn(), apply: vi.fn() },
}))

vi.mock('../lib/report', () => ({
  createBatchReport: vi.fn(() => ({ schemaVersion: 1, jobId: 'job', operation: 'docx-replace', createdAt: '', totals: { input: 1, success: 1, skipped: 0, failed: 0 }, files: [] })),
  packageArtifacts: mocks.packageArtifacts,
}))

class WorkerScope extends EventTarget {
  messages: WorkerResponse[] = []

  postMessage(message: WorkerResponse) {
    this.messages.push(message)
  }

  send(request: WorkerRequest) {
    this.dispatchEvent(new MessageEvent('message', { data: request }))
  }
}

const scope = new WorkerScope()

describe('batch worker cancellation', () => {
  beforeAll(async () => {
    vi.stubGlobal('self', scope)
    await import('./batch.worker')
  })

  afterAll(() => vi.unstubAllGlobals())

  beforeEach(() => {
    scope.messages = []
    mocks.applyDocx.mockReset()
    mocks.inspectDocx.mockReset()
    mocks.inspectDocx.mockResolvedValue('valid')
    mocks.packageArtifacts.mockReset()
  })

  it('emits JOB_CANCELLED without packaging a partial replacement result', async () => {
    mocks.applyDocx.mockImplementation((_file, _config, _preview, signal: AbortSignal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    const file = new File(['docx'], 'sample.docx')
    const input: InputFile = {
      id: 'file-1', file, name: file.name, relativePath: file.name, directory: '', extension: '.docx', kind: 'docx', size: file.size, lastModified: 0, issues: [],
    }
    const preview: FilePreview = {
      fileId: input.id,
      fileName: input.name,
      status: 'ready',
      warnings: [],
      matches: [{ id: 'match-1', fileId: input.id, part: 'word/document.xml', location: 'body', context: 'text', before: 'text', after: 'copy', selected: true }],
    }
    const config: DocxReplaceConfig = { find: 'text', replacement: 'copy', mode: 'exact', caseSensitive: true, scopes: { body: true, headers: true, footnotes: true } }
    scope.send({ type: 'RUN_OPERATION', jobId: 'cancel-me', files: [input], payload: { operation: 'docx-replace', config, previews: [preview] } })
    await vi.waitFor(() => expect(mocks.applyDocx).toHaveBeenCalledOnce())

    scope.send({ type: 'CANCEL_JOB', jobId: 'cancel-me' })

    await vi.waitFor(() => expect(scope.messages.some((message) => message.type === 'JOB_CANCELLED')).toBe(true))
    expect(scope.messages.some((message) => message.type === 'RUN_RESULT')).toBe(false)
    expect(mocks.packageArtifacts).not.toHaveBeenCalled()
  })

  it('reports monotonic completion when concurrent files finish out of order', async () => {
    mocks.inspectDocx.mockImplementation((file: File) => new Promise((resolve) => {
      window.setTimeout(() => resolve('valid'), file.name === 'slow.docx' ? 20 : 0)
    }))
    const makeInput = (name: string): InputFile => {
      const file = new File(['docx'], name)
      return { id: name, file, name, relativePath: name, directory: '', extension: '.docx', kind: 'docx', size: file.size, lastModified: 0, issues: [] }
    }

    scope.send({ type: 'AUDIT_FILES', jobId: 'audit-order', files: [makeInput('slow.docx'), makeInput('fast.docx')] })

    await vi.waitFor(() => expect(scope.messages.some((message) => message.type === 'AUDIT_RESULT')).toBe(true))
    const completed = scope.messages
      .filter((message): message is Extract<WorkerResponse, { type: 'JOB_PROGRESS' }> => message.type === 'JOB_PROGRESS' && message.jobId === 'audit-order')
      .map((message) => message.completed)
    expect(completed).toEqual([0, 1, 2])
  })
})
