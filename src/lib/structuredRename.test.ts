import { describe, expect, it } from 'vitest'
import { createInputFiles } from './files'
import { buildStructuredRenamePreview, createRenameColumn, formatStructuredSequence } from './structuredRename'
import type { InputFile, RenameColumn, StructuredRenameConfig } from '../types'

function makeFiles(names: string[], lastModified = Date.UTC(2026, 7, 10)): InputFile[] {
  return createInputFiles(names.map((name) => new File(['content'], name, { lastModified })))
}

function config(columns: RenameColumn[], overrides: Partial<StructuredRenameConfig> = {}): StructuredRenameConfig {
  return { columns, sortMode: 'path', lockExtension: true, resolveCollisions: true, ...overrides }
}

describe('structured rename engine', () => {
  it('composes sequence, separator, cleaned title and locked extension', () => {
    const sequence = createRenameColumn('sequence')
    const separator = createRenameColumn('literal')
    separator.value = '-'
    const cleaned = createRenameColumn('cleaned')
    cleaned.cleaning.removeCopySuffix = true
    const extension = createRenameColumn('extension')
    const preview = buildStructuredRenamePreview(makeFiles(['Report (copy).DOCX', 'Report  2.docx']), config([sequence, separator, cleaned, extension], { sortMode: 'added' }))
    expect(preview.map((item) => item.after)).toEqual(['01-Report.DOCX', '02-Report 2.docx'])
    expect(preview[0].cells[sequence.id]).toBe('01')
  })

  it('supports non-Arabic sequence formats and alpha rollover', () => {
    expect(formatStructuredSequence(12, 'chinese-lower')).toBe('十二')
    expect(formatStructuredSequence(12, 'chinese-upper')).toBe('壹拾贰')
    expect(formatStructuredSequence(4, 'roman')).toBe('IV')
    expect(formatStructuredSequence(27, 'alpha-upper')).toBe('AA')
    expect(formatStructuredSequence(27, 'alpha-lower')).toBe('aa')
  })

  it('uses modified dates and lets manual cells override only one row', () => {
    const files = makeFiles(['a.txt', 'b.txt'], Date.UTC(2024, 0, 2))
    const manual = createRenameColumn('manual')
    manual.label = '部门'
    const date = createRenameColumn('date')
    date.dateSource = 'modified'
    date.dateFormat = 'YYYYMMDD'
    const preview = buildStructuredRenamePreview(files, config([manual, date]), { [files[1].id]: { [manual.id]: '研发' } })
    expect(preview[0].after).toBe('20240102.txt')
    expect(preview[1].after).toBe('研发20240102.txt')
    expect(preview[0].cells[manual.id]).toBe('')
  })

  it('can unlock and edit the extension without duplicating the suffix', () => {
    const extension = createRenameColumn('extension')
    const title = createRenameColumn('literal')
    title.value = 'final'
    const files = makeFiles(['draft.DOCX'])
    const preview = buildStructuredRenamePreview(files, config([title, extension], { lockExtension: false }), { [files[0].id]: { [extension.id]: 'pdf' } })
    expect(preview[0].after).toBe('final.pdf')
    expect(preview[0].extensionChanged).toBe(true)
  })

  it('resolves three identical outputs as base, -2 and -3', () => {
    const title = createRenameColumn('literal')
    title.value = 'same'
    const preview = buildStructuredRenamePreview(makeFiles(['a.txt', 'b.txt', 'c.txt']), config([title]))
    expect(preview.map((item) => item.after)).toEqual(['same.txt', 'same-2.txt', 'same-3.txt'])
  })

  it('blocks collisions when automatic resolution is disabled', () => {
    const title = createRenameColumn('literal')
    title.value = 'same'
    const preview = buildStructuredRenamePreview(makeFiles(['a.txt', 'b.txt']), config([title], { resolveCollisions: false }))
    expect(preview[1].collision).toBe(true)
    expect(preview[1].after).toBe('same.txt')
  })

  it('keeps sequence numbering tied to the selected sort order', () => {
    const sequence = createRenameColumn('sequence')
    sequence.sequencePad = 1
    const title = createRenameColumn('original')
    const preview = buildStructuredRenamePreview(makeFiles(['item10.txt', 'item2.txt']), config([sequence, title], { sortMode: 'name' }))
    expect(preview.map((item) => item.after)).toEqual(['1item2.txt', '2item10.txt'])
  })

  it('reports an empty assembled stem as invalid', () => {
    const manual = createRenameColumn('manual')
    const preview = buildStructuredRenamePreview(makeFiles(['a.txt']), config([manual]))
    expect(preview[0].error).toBe('invalidRename')
  })
})
