import { describe, expect, it } from 'vitest'
import { createInputFiles } from './files'
import { buildRenamePreview, validateRenameRule } from './rename'
import type { RenameRule } from '../types'

describe('rename engine', () => {
  it('applies ordered rules with natural sequence and locked extensions', () => {
    const files = createInputFiles([new File(['a'], 'Report 10.DOCX'), new File(['b'], 'Report 2.docx')])
    const rules: RenameRule[] = [
      { id: '1', type: 'replace', enabled: true, find: 'Report ', replacement: '', regex: false, caseSensitive: false },
      { id: '2', type: 'sequence', enabled: true, start: 1, step: 1, pad: 2, separator: '-', position: 'prefix' },
    ]
    const preview = buildRenamePreview(files, rules)
    expect(preview.map((item) => item.after)).toEqual(['01-2.docx', '02-10.DOCX'])
  })

  it('supports explicit sequence direction and increment', () => {
    const files = createInputFiles([new File(['a'], 'one.txt'), new File(['b'], 'two.txt')])
    const rules: RenameRule[] = [{ id: '1', type: 'sequence', enabled: true, start: 10, step: 5, pad: 3, separator: '_', position: 'suffix' }]
    expect(buildRenamePreview(files, rules, true, true, 'added').map((item) => item.after)).toEqual(['one_010.txt', 'two_015.txt'])
  })

  it('only changes extensions when the extension lock is disabled', () => {
    const files = createInputFiles([new File(['a'], 'report.TXT')])
    const rules: RenameRule[] = [{ id: '1', type: 'replace', enabled: true, find: 'txt', replacement: 'md', regex: false, caseSensitive: false }]
    expect(buildRenamePreview(files, rules, true)[0].after).toBe('report.TXT')
    expect(buildRenamePreview(files, rules, false)[0].after).toBe('report.md')
  })

  it('resolves output collisions without overwriting', () => {
    const files = createInputFiles([new File(['a'], 'A.txt'), new File(['b'], 'B.txt'), new File(['c'], 'C.txt')])
    const preview = buildRenamePreview(files, [{ id: '1', type: 'replace', enabled: true, find: 'A|B|C', replacement: 'Same', regex: true, caseSensitive: false }])
    expect(preview.map((item) => item.after)).toEqual(['Same.txt', 'Same(2).txt', 'Same(3).txt'])
    expect(preview[1].collisionResolved).toBe(true)
  })

  it('rejects invalid regular expressions', () => {
    const rule: RenameRule = { id: '1', type: 'replace', enabled: true, find: '[', replacement: '', regex: true, caseSensitive: false }
    expect(validateRenameRule(rule)).toBe('invalidRegex')
  })

  it('rejects invalid sequence settings', () => {
    const rule: RenameRule = { id: '1', type: 'sequence', enabled: true, start: 1, step: 1, pad: 0, separator: '-', position: 'prefix' }
    expect(validateRenameRule(rule)).toBe('invalidSequence')
  })
})
