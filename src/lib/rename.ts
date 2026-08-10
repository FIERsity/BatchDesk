import type { InputFile, RenamePreview, RenameRule, RenameSortMode } from '../types'
import { auditFileName, normalizedPathKey, sanitizeOutputPath, splitFileName } from './files'

function formatDate(timestamp: number, format: 'YYYY-MM-DD' | 'YYYYMMDD'): string {
  const date = new Date(timestamp)
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return format === 'YYYY-MM-DD' ? `${year}-${month}-${day}` : `${year}${month}${day}`
}

function titleCase(value: string): string {
  return value.replace(/(^|[\s_-])([\p{L}\p{N}])/gu, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase()}`)
}

export function validateRenameRule(rule: RenameRule): string | undefined {
  if (!rule.enabled) return undefined
  if (rule.type === 'sequence') {
    if (!Number.isFinite(rule.start) || !Number.isFinite(rule.step) || !Number.isFinite(rule.pad) || rule.pad < 1 || rule.pad > 8) return 'invalidSequence'
    return undefined
  }
  if (rule.type !== 'replace' || !rule.regex) return undefined
  if (!rule.find) return 'emptyPattern'
  try {
    new RegExp(rule.find, rule.caseSensitive ? 'g' : 'gi')
    return undefined
  } catch {
    return 'invalidRegex'
  }
}

function replaceValue(value: string, rule: Extract<RenameRule, { type: 'replace' }>): string {
  if (!rule.find) return value
  if (rule.regex) {
    const regex = new RegExp(rule.find, rule.caseSensitive ? 'g' : 'gi')
    return value.replace(regex, rule.replacement)
  }
  if (rule.caseSensitive) return value.split(rule.find).join(rule.replacement)
  return value.replace(new RegExp(escapeRegExp(rule.find), 'gi'), rule.replacement)
}

export function applyRenameRules(file: InputFile, rules: RenameRule[], index: number, lockExtension = true): string {
  const original = splitFileName(file.name)
  let stem = original.stem
  let extension = original.extension.startsWith('.') ? original.extension.slice(1) : original.extension
  for (const rule of rules) {
    if (!rule.enabled) continue
    if (rule.type === 'replace') {
      stem = replaceValue(stem, rule)
      if (!lockExtension) extension = replaceValue(extension, rule)
    } else if (rule.type === 'prefix') {
      stem = `${rule.value}${stem}`
    } else if (rule.type === 'suffix') {
      stem = `${stem}${rule.value}`
    } else if (rule.type === 'sequence') {
      const sequence = String(rule.start + index * (Number.isFinite(rule.step) ? rule.step : 1)).padStart(rule.pad, '0')
      stem = rule.position === 'suffix' ? `${stem}${rule.separator}${sequence}` : `${sequence}${rule.separator}${stem}`
    } else if (rule.type === 'case') {
      stem = rule.mode === 'lower' ? stem.toLocaleLowerCase() : rule.mode === 'upper' ? stem.toLocaleUpperCase() : titleCase(stem)
      if (!lockExtension) extension = rule.mode === 'lower' ? extension.toLocaleLowerCase() : rule.mode === 'upper' ? extension.toLocaleUpperCase() : titleCase(extension)
    } else if (rule.type === 'normalize') {
      if (rule.unicode) stem = stem.normalize('NFC')
      if (rule.whitespace) stem = stem.trim().replace(/[\s\u3000]+/g, ' ')
      if (!lockExtension) {
        if (rule.unicode) extension = extension.normalize('NFC')
        if (rule.whitespace) extension = extension.trim().replace(/[\s\u3000]+/g, ' ')
      }
    } else if (rule.type === 'date') {
      const date = formatDate(file.lastModified, rule.format)
      stem = rule.position === 'prefix' ? `${date}-${stem}` : `${stem}-${date}`
    }
  }
  return `${stem}${extension ? `.${extension}` : ''}`
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function addCollisionSuffix(name: string, number: number): string {
  const { stem, extension } = splitFileName(name)
  return `${stem}-${number}${extension}`
}

export function buildRenamePreview(files: InputFile[], rules: RenameRule[], lockExtension = true, resolveCollisions = true, sortMode: RenameSortMode = 'path'): RenamePreview[] {
  const sorted = [...files].sort((a, b) => {
    if (sortMode === 'added') return files.indexOf(a) - files.indexOf(b)
    const aValue = sortMode === 'name' ? a.name : a.relativePath
    const bValue = sortMode === 'name' ? b.name : b.relativePath
    return aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' }) || a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true, sensitivity: 'base' })
  })
  const occupied = new Set<string>()
  return sorted.map((file, index) => {
    let after: string
    let error: string | undefined
    try {
      after = applyRenameRules(file, rules, index, lockExtension)
    } catch {
      after = file.name
      error = 'invalidRegex'
    }
    const nameIssues = auditFileName(after, file.size).filter((issue) => issue.severity === 'error')
    if (nameIssues.length) error = nameIssues[0].message
    let outputPath = sanitizeOutputPath(file.directory ? `${file.directory}/${after}` : after)
    let collision = occupied.has(normalizedPathKey(outputPath))
    let collisionResolved = false
    if (collision && resolveCollisions) {
      let suffix = 2
      do {
        after = addCollisionSuffix(after, suffix++)
        outputPath = sanitizeOutputPath(file.directory ? `${file.directory}/${after}` : after)
      } while (occupied.has(normalizedPathKey(outputPath)))
      collision = false
      collisionResolved = true
    }
    occupied.add(normalizedPathKey(outputPath))
    const originalExtension = splitFileName(file.name).extension
    const outputExtension = splitFileName(after).extension
    return { fileId: file.id, inputPath: file.relativePath, before: file.name, after, outputPath, changed: after !== file.name, collision, collisionResolved, extensionChanged: originalExtension !== outputExtension, error }
  })
}
