import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const workerState = vi.hoisted(() => ({
  instances: [] as Array<{ disposed: boolean }>,
  requestedWhileDisposed: [] as boolean[],
}))

vi.mock('./worker/client', () => ({
  BatchWorkerClient: class {
    disposed = false

    constructor() {
      workerState.instances.push(this)
    }

    request(request: { jobId: string }) {
      workerState.requestedWhileDisposed.push(this.disposed)
      return Promise.resolve({ type: 'AUDIT_RESULT', jobId: request.jobId, invalidFileIds: [] })
    }

    cancel() {}

    dispose() {
      this.disposed = true
    }
  },
}))

describe('App worker lifecycle', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size },
    } satisfies Storage)
  })

  afterEach(() => {
    workerState.instances.length = 0
    workerState.requestedWhileDisposed.length = 0
    vi.unstubAllGlobals()
  })

  it('uses the live worker after the StrictMode effect replay', async () => {
    const { container } = render(<StrictMode><App /></StrictMode>)
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()

    fireEvent.change(input!, { target: { files: [new File(['office'], 'sample.docx')] } })

    await waitFor(() => expect(screen.getByText('sample.docx')).toBeInTheDocument())
    await waitFor(() => expect(workerState.requestedWhileDisposed).toEqual([false]))
    expect(workerState.instances.length).toBeGreaterThanOrEqual(2)
  })
})
