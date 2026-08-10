import type { AuditIssue, FileKind, InputFile } from '../types'

const ILLEGAL_NAME = /[<>:"/\\|?*]/
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

export function splitFileName(name: string): { stem: string; extension: string } {
  const index = name.lastIndexOf('.')
  if (index <= 0) return { stem: name, extension: '' }
  return { stem: name.slice(0, index), extension: name.slice(index).toLowerCase() }
}

export function classifyFile(name: string): FileKind {
  const { extension } = splitFileName(name)
  if (extension === '.docx') return 'docx'
  if (extension === '.xlsx') return 'xlsx'
  if (['.doc', '.xls', '.xlsm'].includes(extension)) return 'legacy'
  return 'other'
}

export function normalizedPathKey(path: string): string {
  return path.normalize('NFC').toLocaleLowerCase('en-US')
}

export function auditFileName(name: string, size: number): AuditIssue[] {
  const issues: AuditIssue[] = []
  const { stem } = splitFileName(name)
  if (size === 0) issues.push({ code: 'empty', severity: 'error', message: 'emptyFile' })
  if (!name || ILLEGAL_NAME.test(name) || [...name].some((character) => character.charCodeAt(0) < 32) || /[. ]$/.test(name)) {
    issues.push({ code: 'illegal-name', severity: 'error', message: 'illegalName' })
  }
  if (WINDOWS_RESERVED.test(stem)) {
    issues.push({ code: 'reserved-name', severity: 'error', message: 'reservedName' })
  }
  if (new TextEncoder().encode(name).length > 240) {
    issues.push({ code: 'long-name', severity: 'warning', message: 'longName' })
  }
  return issues
}

export function createInputFiles(files: File[]): InputFile[] {
  const entries = files.map((file, index) => {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    const normalized = relative.replace(/^\/+/, '').replace(/\\/g, '/')
    const separator = normalized.lastIndexOf('/')
    const directory = separator >= 0 ? normalized.slice(0, separator) : ''
    const name = separator >= 0 ? normalized.slice(separator + 1) : normalized
    const { extension } = splitFileName(name)
    return {
      id: `${Date.now().toString(36)}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      name,
      relativePath: normalized,
      directory,
      extension,
      kind: classifyFile(name),
      size: file.size,
      lastModified: file.lastModified,
      issues: auditFileName(name, file.size),
    } satisfies InputFile
  })

  return markDuplicatePaths(entries)
}

export function markDuplicatePaths(entries: InputFile[]): InputFile[] {
  const withoutDuplicateIssue = entries.map((item) => ({ ...item, issues: item.issues.filter((issue) => issue.code !== 'duplicate-path') }))
  const counts = new Map<string, number>()
  for (const item of withoutDuplicateIssue) {
    const key = normalizedPathKey(item.relativePath)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return withoutDuplicateIssue.map((item) => counts.get(normalizedPathKey(item.relativePath))! > 1
    ? { ...item, issues: [...item.issues, { code: 'duplicate-path', severity: 'error', message: 'duplicatePath' }] }
    : item)
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(size < 10240 ? 1 : 0)} KB`
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`
  return `${(size / 1024 ** 3).toFixed(1)} GB`
}

export function sanitizeOutputPath(path: string): string {
  return path.split('/').filter((part) => part && part !== '.' && part !== '..').join('/')
}
