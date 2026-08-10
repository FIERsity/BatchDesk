import { describe, expect, it } from 'vitest'
import { createInputFiles } from './files'
import { buildStructuredRenamePreview, createPrimaryOriginalColumn, createRenameColumn, formatStructuredSequence, PRIMARY_ORIGINAL_COLUMN_ID } from './structuredRename'
import type { InputFile, RenameColumn, StructuredRenameConfig } from '../types'

function makeFiles(names: string[]): InputFile[] {
  return createInputFiles(names.map((name) => new File(['content'], name, { lastModified: Date.UTC(2026, 7, 10) })))
}

function config(userColumns: RenameColumn[] = [], overrides: Partial<StructuredRenameConfig> = {}): StructuredRenameConfig {
  return { columns: [createPrimaryOriginalColumn(), ...userColumns], sortMode: 'path', lockExtension: true, resolveCollisions: true, ...overrides }
}

describe('structured rename engine', () => {
  it('starts with only the imported original title and preserves its extension', () => {
    const files = makeFiles(['Report.DOCX'])
    const preview = buildStructuredRenamePreview(files, config())
    expect(preview[0].cells[PRIMARY_ORIGINAL_COLUMN_ID]).toBe('Report')
    expect(preview[0].after).toBe('Report.DOCX')
    expect(preview[0].error).toBeUndefined()
    expect(preview[0].changed).toBe(false)
  })

  it('composes only user-added fields in table order', () => {
    const sequence = createRenameColumn('sequence')
    sequence.sequencePad = 2
    const separator = createRenameColumn('literal')
    separator.value = '-'
    const manual = createRenameColumn('manual')
    manual.value = '归档'
    const preview = buildStructuredRenamePreview(makeFiles(['Report.DOCX']), config([sequence, separator, manual]))
    expect(preview[0].after).toBe('Report01-归档.DOCX')
  })

  it('lets the fixed original title and added original fields be edited per row', () => {
    const addedOriginal = createRenameColumn('original')
    const files = makeFiles(['a.txt', 'b.txt'])
    const preview = buildStructuredRenamePreview(files, config([addedOriginal]), {
      [files[0].id]: { [PRIMARY_ORIGINAL_COLUMN_ID]: '第一份', [addedOriginal.id]: '草稿' },
    })
    expect(preview[0].after).toBe('第一份草稿.txt')
    expect(preview[1].after).toBe('bb.txt')
  })

  it('supports non-Arabic sequence formats and alpha rollover', () => {
    expect(formatStructuredSequence(12, 'chinese-lower')).toBe('十二')
    expect(formatStructuredSequence(12, 'chinese-upper')).toBe('壹拾贰')
    expect(formatStructuredSequence(4, 'roman')).toBe('IV')
    expect(formatStructuredSequence(27, 'alpha-upper')).toBe('AA')
    expect(formatStructuredSequence(27, 'alpha-lower')).toBe('aa')
  })

  it('can unlock and edit an explicitly added extension field', () => {
    const extension = createRenameColumn('extension')
    const title = createRenameColumn('literal')
    title.value = 'final'
    const files = makeFiles(['draft.DOCX'])
    const preview = buildStructuredRenamePreview(files, config([title, extension], { lockExtension: false }), { [files[0].id]: { [extension.id]: 'pdf' } })
    expect(preview[0].after).toBe('draftfinal.pdf')
    expect(preview[0].extensionChanged).toBe(true)
  })

  it('resolves three identical outputs as base, -2 and -3', () => {
    const title = createRenameColumn('literal')
    title.value = 'same'
    const files = makeFiles(['a.txt', 'b.txt', 'c.txt'])
    const preview = buildStructuredRenamePreview(files, config([title]), Object.fromEntries(files.map((file) => [file.id, { [PRIMARY_ORIGINAL_COLUMN_ID]: '' }])))
    expect(preview.map((item) => item.after)).toEqual(['same.txt', 'same-2.txt', 'same-3.txt'])
  })

  it('keeps sequence numbering tied to the selected sort order', () => {
    const sequence = createRenameColumn('sequence')
    sequence.sequencePad = 1
    const title = createRenameColumn('original')
    const preview = buildStructuredRenamePreview(makeFiles(['item10.txt', 'item2.txt']), config([sequence, title], { sortMode: 'name' }))
    expect(preview.map((item) => item.after)).toEqual(['item21item2.txt', 'item102item10.txt'])
  })

  it('reports an empty edited original title as invalid', () => {
    const files = makeFiles(['a.txt'])
    const preview = buildStructuredRenamePreview(files, config(), { [files[0].id]: { [PRIMARY_ORIGINAL_COLUMN_ID]: '' } })
    expect(preview[0].error).toBe('invalidRename')
  })
})
