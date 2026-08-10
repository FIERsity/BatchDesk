import { describe, expect, it } from 'vitest'
import { auditFileName, createInputFiles, normalizedPathKey, splitFileName } from './files'

describe('file audit', () => {
  it('classifies names and detects unsafe names', () => {
    expect(splitFileName('.env')).toEqual({ stem: '.env', extension: '' })
    expect(auditFileName('CON.docx', 20).map((issue) => issue.code)).toContain('reserved-name')
    expect(auditFileName('bad?.docx', 20).map((issue) => issue.code)).toContain('illegal-name')
    expect(auditFileName('empty.docx', 0).map((issue) => issue.code)).toContain('empty')
  })

  it('detects case and Unicode-normalized path collisions', () => {
    const files = createInputFiles([new File(['a'], 'Résumé.docx'), new File(['b'], 'RE\u0301SUME\u0301.DOCX')])
    expect(files.every((file) => file.issues.some((issue) => issue.code === 'duplicate-path'))).toBe(true)
    expect(normalizedPathKey(files[0].name)).toBe(normalizedPathKey(files[1].name))
  })
})
