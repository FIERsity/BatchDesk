import type { WorkerRequest, WorkerResponse } from './protocol'
import BatchWorker from './batch.worker?worker'

type FinalResponse = Exclude<WorkerResponse, { type: 'JOB_PROGRESS' }>

export class BatchWorkerClient {
  private readonly worker = new BatchWorker()
  private readonly pending = new Map<string, { resolve: (value: FinalResponse) => void; reject: (reason: Error) => void; onProgress?: (message: Extract<WorkerResponse, { type: 'JOB_PROGRESS' }>) => void }>()

  constructor() {
    this.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      const pending = this.pending.get(message.jobId)
      if (!pending) return
      if (message.type === 'JOB_PROGRESS') {
        pending.onProgress?.(message)
        return
      }
      this.pending.delete(message.jobId)
      if (message.type === 'JOB_ERROR') pending.reject(new Error(message.error))
      else if (message.type === 'JOB_CANCELLED') pending.reject(new DOMException('Aborted', 'AbortError'))
      else pending.resolve(message)
    })
    this.worker.addEventListener('error', (event) => {
      console.error('[BatchDesk worker]', event.message, event.filename, event.lineno)
      this.rejectAll(new Error(event.message || 'workerLoadFailed'))
    })
    this.worker.addEventListener('messageerror', () => this.rejectAll(new Error('workerMessageFailed')))
  }

  private rejectAll(error: Error) {
    for (const pending of this.pending.values()) pending.reject(error)
    this.pending.clear()
  }

  request<T extends FinalResponse>(request: Exclude<WorkerRequest, { type: 'CANCEL_JOB' }>, onProgress?: (message: Extract<WorkerResponse, { type: 'JOB_PROGRESS' }>) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.set(request.jobId, { resolve: (value) => resolve(value as T), reject, onProgress })
      this.worker.postMessage(request)
    })
  }

  cancel(jobId: string) {
    this.worker.postMessage({ type: 'CANCEL_JOB', jobId } satisfies WorkerRequest)
  }

  dispose() {
    this.worker.terminate()
    this.rejectAll(new Error('workerDisposed'))
  }
}
