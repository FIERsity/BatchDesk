import { describe, expect, it } from 'vitest'
import { createInputFiles } from './files'
import { buildRenamePreview, validateRenameRule } from './rename'
import type { RenameRule } from '../types'

describe('rename engine', () => {
  it('applies ordered rules with natural sequence and locked extensions', () => {
    const files = createInputFiles([new File(['a'], 'Report 10.DOCX'), new File(['b'], 'Report 2.docx')])
    const rules: RenameRule[] = [
      { id: '1', type: 'replace', enabled: true, find: 'Report ', replacement: '', regex: false, caseSensitive: false },
      { id: '2', type: 'sequence', enabled: true, start: 1, pad: 2, separator: '-' },
    ]
    const preview = buildRenamePreview(files, rules)
    expect(preview.map((item) => item.after)).toEqual(['01-2.docx', '02-10.docx'])
  })

  it('resolves output collisions without overwriting', () => {
    const files = createInputFiles([new File(['a'], 'A.txt'), new File(['b'], 'B.txt')])
    const rules: RenameRule[] = [{ id: '1', type: 'replace', enabled: true, find: 'A|B', replacement: 'Same', regex: true, caseSensitive: false }]
    expect(buildRenamePreview(files, rules).map((item) => item.after)).toEqual(['Same.txt', 'Same-2.txt'])
  })

  it('rejects invalid regular expressions', () => {
    const rule: RenameRule = { id: '1', type: 'replace', enabled: true, find: '[', replacement: '', regex: true, caseSensitive: false }
    expect(validateRenameRule(rule)).toBe('invalidRegex')
  })
})
