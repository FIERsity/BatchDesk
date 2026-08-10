import { afterEach, describe, expect, it } from 'vitest'
import { writeArtifactsToDirectory } from './download'

class MemoryFileHandle {
  blob?: Blob

  async createWritable() {
    return {
      write: async (blob: Blob) => { this.blob = blob },
      close: async () => {},
    }
  }
}

class MemoryDirectoryHandle {
  directories = new Map<string, MemoryDirectoryHandle>()
  files = new Map<string, MemoryFileHandle>()

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const existing = this.directories.get(name)
    if (existing) return existing
    if (!options?.create) throw new DOMException('Missing', 'NotFoundError')
    const created = new MemoryDirectoryHandle()
    this.directories.set(name, created)
    return created
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    const existing = this.files.get(name)
    if (existing) return existing
    if (!options?.create) throw new DOMException('Missing', 'NotFoundError')
    const created = new MemoryFileHandle()
    this.files.set(name, created)
    return created
  }
}

describe('directory output', () => {
  afterEach(() => { delete (window as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker })

  it('creates a unique job folder and never writes into an existing folder', async () => {
    const root = new MemoryDirectoryHandle()
    const existing = new MemoryDirectoryHandle()
    existing.files.set('report.json', new MemoryFileHandle())
    root.directories.set('BatchDesk-job', existing)
    ;(window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker = async () => root as unknown as FileSystemDirectoryHandle

    const folder = await writeArtifactsToDirectory([
      { relativePath: 'nested/output.docx', blob: new Blob(['copy']) },
      { relativePath: 'batchdesk-report.json', blob: new Blob(['report']) },
    ], 'BatchDesk-job')

    expect(folder).toBe('BatchDesk-job-2')
    expect(existing.files.get('report.json')?.blob).toBeUndefined()
    const output = root.directories.get('BatchDesk-job-2')!
    expect(output.directories.get('nested')?.files.get('output.docx')?.blob).toBeInstanceOf(Blob)
    expect(output.files.get('batchdesk-report.json')?.blob).toBeInstanceOf(Blob)
  })
})
