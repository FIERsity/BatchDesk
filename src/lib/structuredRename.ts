import type { InputFile, RenameColumn, RenamePreview, RenameSortMode, StructuredRenameConfig, StructuredRenamePreview, StructuredSequenceFormat } from '../types'
import { auditFileName, normalizedPathKey, sanitizeOutputPath, splitFileName } from './files'

export function createRenameColumn(kind: RenameColumn['kind']): RenameColumn {
  const labels: Record<RenameColumn['kind'], string> = {
    literal: '分隔符 / 固定文字',
    sequence: '序号',
    manual: '手动输入',
  }
  return {
    id: `column-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    label: labels[kind],
    enabled: true,
    value: '',
    sequenceFormat: 'arabic',
  }
}

export function formatStructuredSequence(value: number, format: StructuredSequenceFormat): string {
  if (format === 'chinese-lower') return chineseNumber(value, lowerChineseDigits)
  if (format === 'chinese-upper') return chineseNumber(value, upperChineseDigits)
  if (format === 'roman') return romanNumber(value)
  if (format === 'alpha-upper') return alphaNumber(value)
  if (format === 'alpha-lower') return alphaNumber(value).toLowerCase()
  return String(Math.max(0, Math.trunc(value)))
}

const lowerChineseDigits = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九']
const upperChineseDigits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖']

function chineseNumber(value: number, digits: string[]): string {
  if (!Number.isFinite(value)) return ''
  const integer = Math.trunc(value)
  if (integer === 0) return digits[0]
  if (integer < 0) return `负${chineseNumber(-integer, digits)}`
  if (integer > 99999999) return String(integer)
  const units = digits === upperChineseDigits ? ['', '拾', '佰', '仟', '万', '拾', '佰', '仟'] : ['', '十', '百', '千', '万', '十', '百', '千']
  const chars = String(integer).split('').map(Number)
  let result = ''
  let zeroPending = false
  chars.forEach((digit, index) => {
    const position = chars.length - index - 1
    if (digit === 0) {
      if (result) zeroPending = true
      return
    }
    if (zeroPending) result += digits[0]
    zeroPending = false
    if (digit === 1 && position === 1 && chars.length <= 2 && digits === lowerChineseDigits) result += units[position]
    else result += `${digits[digit]}${units[position]}`
  })
  return result
}

function romanNumber(value: number): string {
  const integer = Math.trunc(value)
  if (integer <= 0 || integer > 3999) return String(integer)
  const table: Array<[number, string]> = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let remaining = integer
  let result = ''
  for (const [number, symbol] of table) {
    while (remaining >= number) {
      result += symbol
      remaining -= number
    }
  }
  return result
}

function alphaNumber(value: number): string {
  let remaining = Math.trunc(value)
  if (remaining <= 0) return String(remaining)
  let result = ''
  while (remaining > 0) {
    remaining -= 1
    result = String.fromCharCode(65 + (remaining % 26)) + result
    remaining = Math.floor(remaining / 26)
  }
  return result
}

function sortFiles(files: InputFile[], sortMode: RenameSortMode): InputFile[] {
  return [...files].sort((a, b) => {
    if (sortMode === 'added') return files.indexOf(a) - files.indexOf(b)
    const aValue = sortMode === 'name' ? a.name : a.relativePath
    const bValue = sortMode === 'name' ? b.name : b.relativePath
    return aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' })
      || a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true, sensitivity: 'base' })
  })
}

function addCollisionSuffix(name: string, number: number): string {
  const { stem, extension } = splitFileName(name)
  return `${stem}-${number}${extension}`
}

function cellValue(column: RenameColumn, index: number, overrides: Record<string, string> | undefined): string {
  const override = overrides?.[column.id]
  if ((column.kind === 'literal' || column.kind === 'manual') && override !== undefined) return override
  if (column.kind === 'literal' || column.kind === 'manual') return column.value
  return formatStructuredSequence(index + 1, column.sequenceFormat)
}

export function buildStructuredRenamePreview(
  files: InputFile[],
  config: StructuredRenameConfig,
  overrides: Record<string, Record<string, string>> = {},
): StructuredRenamePreview[] {
  const enabledColumns = config.columns.filter((column) => column.enabled)
  const sorted = sortFiles(files, config.sortMode)
  const occupied = new Set<string>()
  return sorted.map((file, index) => {
    const cells = Object.fromEntries(config.columns.map((column) => [column.id, cellValue(column, index, overrides[file.id])]))
    const stem = enabledColumns.map((column) => cells[column.id]).join('')
    const originalExtension = splitFileName(file.name).extension
    let after = stem.trim() ? `${stem}${originalExtension}` : ''
    let error: string | undefined
    if (!stem.trim()) error = 'invalidRename'
    const nameIssues = after ? auditFileName(after, file.size).filter((issue) => issue.severity === 'error') : []
    if (nameIssues.length) error = nameIssues[0].message
    let outputPath = after ? sanitizeOutputPath(file.directory ? `${file.directory}/${after}` : after) : ''
    let collision = Boolean(outputPath) && occupied.has(normalizedPathKey(outputPath))
    let collisionResolved = false
    if (collision && config.resolveCollisions && !error) {
      const baseAfter = after
      let suffix = 2
      do {
        after = addCollisionSuffix(baseAfter, suffix++)
        outputPath = sanitizeOutputPath(file.directory ? `${file.directory}/${after}` : after)
      } while (occupied.has(normalizedPathKey(outputPath)))
      collision = false
      collisionResolved = true
    }
    if (outputPath) occupied.add(normalizedPathKey(outputPath))
    return {
      fileId: file.id,
      inputPath: file.relativePath,
      before: file.name,
      after,
      outputPath,
      changed: after !== file.name,
      collision,
      collisionResolved,
      extensionChanged: false,
      error,
      cells,
    }
  })
}

export function structuredPreviewHasIssues(preview: RenamePreview): boolean {
  return Boolean(preview.error || preview.collision)
}
