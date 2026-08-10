import { describe, expect, it } from 'vitest'
import { createInputFiles } from './files'
import { buildStructuredRenamePreview, createRenameColumn, formatStructuredSequence } from './structuredRename'
import type { InputFile, RenameColumn, StructuredRenameConfig } from '../types'

function makeFiles(names: string[]): InputFile[] {
  return createInputFiles(names.map((name) => new File(['content'], name, { lastModified: Date.UTC(2026, 7, 10) })))
}

function config(columns: RenameColumn[] = [], overrides: Partial<StructuredRenameConfig> = {}): StructuredRenameConfig {
  return { columns, sortMode: 'path', ...overrides }
}

describe('structured rename engine', () => {
  it('does not show an extension-only preview before a field is added', () => {
    const preview = buildStructuredRenamePreview(makeFiles(['Source.DOCX']), config())
    expect(preview[0].after).toBe('')
    expect(preview[0].error).toBe('invalidRename')
  })

  it('keeps the original extension without using the original filename in the stem', () => {
    const title = createRenameColumn('manual')
    title.value = 'Report'
    const preview = buildStructuredRenamePreview(makeFiles(['Source.DOCX']), config([title]))
    expect(preview[0].before).toBe('Source.DOCX')
    expect(preview[0].after).toBe('Report.DOCX')
    expect(preview[0].cells[title.id]).toBe('Report')
  })

  it('composes only user-added fields in table order', () => {
    const sequence = createRenameColumn('sequence')
    const separator = createRenameColumn('literal')
    separator.value = '-'
    const manual = createRenameColumn('manual')
    manual.value = '归档'
    const preview = buildStructuredRenamePreview(makeFiles(['Report.DOCX']), config([sequence, separator, manual]))
    expect(preview[0].after).toBe('1-归档.DOCX')
  })

  it('supports importing or editing an original filename in a manual field', () => {
    const manual = createRenameColumn('manual')
    expect(manual.label).toBe('手动输入（可导入原始文件名）')
    const files = makeFiles(['第一份.txt', '第二份.txt'])
    const preview = buildStructuredRenamePreview(files, config([manual]), {
      [files[0].id]: { [manual.id]: '第一份-修订' },
      [files[1].id]: { [manual.id]: '第二份-修订' },
    })
    expect(preview.map((item) => item.after)).toEqual(['第一份-修订.txt', '第二份-修订.txt'])
  })

  it('supports Arabic and lower Chinese sequence formats', () => {
    expect(formatStructuredSequence(12, 'chinese-lower')).toBe('十二')
    expect(formatStructuredSequence(12, 'arabic')).toBe('12')
    expect(formatStructuredSequence(0, 'chinese-lower')).toBe('〇')
  })

  it('resolves three identical outputs as base, (2) and (3)', () => {
    const title = createRenameColumn('manual')
    const files = makeFiles(['a.txt', 'b.txt', 'c.txt'])
    const overrides = Object.fromEntries(files.map((file) => [file.id, { [title.id]: 'same' }]))
    const preview = buildStructuredRenamePreview(files, config([title]), overrides)
    expect(preview.map((item) => item.after)).toEqual(['same.txt', 'same(2).txt', 'same(3).txt'])
  })

  it('uses fixed text as a whole column and ignores row overrides', () => {
    const separator = createRenameColumn('literal')
    separator.value = '-'
    const files = makeFiles(['a.txt', 'b.txt'])
    const preview = buildStructuredRenamePreview(files, config([separator]), {
      [files[0].id]: { [separator.id]: '/' },
    })
    expect(preview.map((item) => item.cells[separator.id])).toEqual(['-', '-'])
    expect(preview.map((item) => item.after)).toEqual(['-.txt', '-(2).txt'])
  })

  it('keeps sequence numbering tied to the selected sort order', () => {
    const sequence = createRenameColumn('sequence')
    const preview = buildStructuredRenamePreview(makeFiles(['item10.txt', 'item2.txt']), config([sequence], { sortMode: 'name' }))
    expect(preview.map((item) => item.after)).toEqual(['1.txt', '2.txt'])
    expect(preview.map((item) => item.inputPath)).toEqual(['item2.txt', 'item10.txt'])
  })

  it('reports an empty manual field as invalid', () => {
    const manual = createRenameColumn('manual')
    const files = makeFiles(['a.txt'])
    const preview = buildStructuredRenamePreview(files, config([manual]))
    expect(preview[0].error).toBe('invalidRename')
  })
})
