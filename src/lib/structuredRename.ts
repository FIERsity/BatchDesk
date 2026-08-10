import type {
  InputFile,
  RenameColumn,
  RenamePreview,
  RenameSortMode,
  StructuredCleaningOptions,
  StructuredDateFormat,
  StructuredRenameConfig,
  StructuredRenamePreview,
  StructuredSequenceFormat,
} from '../types'
import { auditFileName, normalizedPathKey, sanitizeOutputPath, splitFileName } from './files'

export const defaultCleaning: StructuredCleaningOptions = {
  trim: true,
  collapseWhitespace: true,
  normalizeUnicode: true,
  unifySeparators: false,
  separator: '-',
  removeCopySuffix: false,
  case: 'keep',
}

export function createRenameColumn(kind: RenameColumn['kind']): RenameColumn {
  const labels: Record<RenameColumn['kind'], string> = {
    literal: '固定文字',
    original: '原始标题',
    cleaned: '清洗标题',
    sequence: '序号',
    date: '日期',
    manual: '手动输入',
    extension: '扩展名',
  }
  return {
    id: `column-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    label: labels[kind],
    enabled: true,
    value: kind === 'literal' ? '-' : '',
    sequenceFormat: 'arabic',
    sequenceStart: 1,
    sequenceStep: 1,
    sequencePad: 2,
    dateSource: 'modified',
    dateFormat: 'YYYY-MM-DD',
    cleaning: { ...defaultCleaning },
  }
}

function titleCase(value: string): string {
  return value.replace(/(^|[\s_-])([\p{L}\p{N}])/gu, (_, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase()}`)
}

function cleanTitle(value: string, options: StructuredCleaningOptions): string {
  let result = value
  if (options.normalizeUnicode) result = result.normalize('NFKC')
  if (options.removeCopySuffix) {
    result = result.replace(/(?:[\s_-]+(?:copy|副本)(?:[\s_-]*\d+)?|\s*\(\s*(?:copy|副本|\d+)\s*\))$/iu, '')
  }
  if (options.collapseWhitespace) result = result.replace(/[\s\u3000]+/g, ' ')
  if (options.unifySeparators) result = result.replace(/[\s_-]+/g, options.separator)
  if (options.trim) result = result.trim()
  if (options.case === 'lower') result = result.toLocaleLowerCase()
  if (options.case === 'upper') result = result.toLocaleUpperCase()
  if (options.case === 'title') result = titleCase(result)
  return result
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
    // 十、百、千 use the same characters in both lower and upper Chinese styles.
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

export function formatStructuredSequence(value: number, format: StructuredSequenceFormat, pad = 1): string {
  if (format === 'chinese-lower') return chineseNumber(value, lowerChineseDigits)
  if (format === 'chinese-upper') return chineseNumber(value, upperChineseDigits)
  if (format === 'roman') return romanNumber(value)
  if (format === 'alpha-upper') return alphaNumber(value)
  if (format === 'alpha-lower') return alphaNumber(value).toLowerCase()
  return String(Math.trunc(value)).padStart(Math.max(1, Math.min(8, Math.trunc(pad))), '0')
}

function formatDate(timestamp: number, format: StructuredDateFormat): string {
  const date = new Date(timestamp)
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  if (format === 'YYYYMMDD') return `${year}${month}${day}`
  if (format === 'YYYY年MM月DD日') return `${year}年${month}月${day}日`
  return `${year}-${month}-${day}`
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

function cellValue(file: InputFile, column: RenameColumn, index: number, overrides: Record<string, string> | undefined, extensionEditable: boolean): string {
  const override = overrides?.[column.id]
  if ((column.kind === 'literal' || column.kind === 'manual' || column.kind === 'extension' && extensionEditable) && override !== undefined) return override
  const { stem, extension } = splitFileName(file.name)
  if (column.kind === 'literal' || column.kind === 'manual') return column.value
  if (column.kind === 'original') return stem
  if (column.kind === 'cleaned') return cleanTitle(stem, column.cleaning)
  if (column.kind === 'extension') return extension.replace(/^\./, '')
  if (column.kind === 'sequence') {
    const start = Number.isFinite(column.sequenceStart) ? column.sequenceStart : 1
    const step = Number.isFinite(column.sequenceStep) ? column.sequenceStep : 1
    return formatStructuredSequence(start + index * step, column.sequenceFormat, column.sequencePad)
  }
  const timestamp = column.dateSource === 'today' ? Date.now() : file.lastModified
  return formatDate(timestamp, column.dateFormat)
}

function extensionFromCell(value: string): string {
  const trimmed = value.trim().replace(/^\.+/, '')
  return trimmed ? `.${trimmed}` : ''
}

export function buildStructuredRenamePreview(
  files: InputFile[],
  config: StructuredRenameConfig,
  overrides: Record<string, Record<string, string>> = {},
): StructuredRenamePreview[] {
  const allColumns = config.columns
  const columns = allColumns.filter((column) => column.enabled)
  const sorted = sortFiles(files, config.sortMode)
  const occupied = new Set<string>()
  return sorted.map((file, index) => {
    const originalExtension = splitFileName(file.name).extension
    const cells = Object.fromEntries(allColumns.map((column) => [column.id, cellValue(file, column, index, overrides[file.id], !config.lockExtension)]))
    const extensionColumn = columns.find((column) => column.kind === 'extension')
    const stem = columns.filter((column) => column.kind !== 'extension').map((column) => cells[column.id]).join('')
    const extension = config.lockExtension
      ? originalExtension
      : extensionColumn ? extensionFromCell(cells[extensionColumn.id]) : originalExtension
    let after = `${stem}${extension}`
    let error: string | undefined
    if (!stem.trim()) error = 'invalidRename'
    const nameIssues = auditFileName(after, file.size).filter((issue) => issue.severity === 'error')
    if (nameIssues.length) error = nameIssues[0].message
    let outputPath = sanitizeOutputPath(file.directory ? `${file.directory}/${after}` : after)
    let collision = occupied.has(normalizedPathKey(outputPath))
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
    occupied.add(normalizedPathKey(outputPath))
    const outputExtension = splitFileName(after).extension
    return {
      fileId: file.id,
      inputPath: file.relativePath,
      before: file.name,
      after,
      outputPath,
      changed: after !== file.name,
      collision,
      collisionResolved,
      extensionChanged: originalExtension !== outputExtension,
      error,
      cells,
    }
  })
}

export function structuredPreviewHasIssues(preview: RenamePreview): boolean {
  return Boolean(preview.error || preview.collision)
}
