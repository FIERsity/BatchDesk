import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createInputFiles } from './files'
import { xlsxProcessor } from './xlsx'
import { makeXlsx } from '../test/fixtures'
import type { XlsxReplaceConfig } from '../types'

const config: XlsxReplaceConfig = { find: 'Hello World', replacement: 'BatchDesk', wholeCell: false, caseSensitive: true, sheetNames: [] }

describe('XLSX processor', () => {
  it('replaces shared and inline strings while skipping formulas and preserving chart parts', async () => {
    const file = await makeXlsx()
    const input = createInputFiles([file])[0]
    const preview = await xlsxProcessor.scan(input, config)
    expect(preview.matches).toHaveLength(2)
    expect(preview.warnings).toContain('formulasSkipped')
    const artifact = await xlsxProcessor.apply(input, config, preview)
    expect(artifact.appliedCount).toBe(2)
    const zip = await JSZip.loadAsync(artifact.blob)
    const shared = await zip.file('xl/sharedStrings.xml')!.async('string')
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    expect(shared).toContain('BatchDesk')
    expect(sheet).toContain('BatchDesk')
    expect(sheet).toContain('CONCAT')
    expect(await zip.file('xl/charts/chart1.xml')!.async('string')).toBe('<chart>untouched</chart>')
  })
})
