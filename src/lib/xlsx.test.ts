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

  it('preserves replacement whitespace and ignores phonetic annotation text', async () => {
    const file = await makeXlsx({
      'xl/sharedStrings.xml': '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1" uniqueCount="1"><si><t>Visible</t><rPh sb="0" eb="1"><t>Hidden phonetic</t></rPh></si></sst>',
      'xl/worksheets/sheet1.xml': '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>Visible</t><rPh sb="0" eb="1"><t>Hidden inline</t></rPh></is></c></row></sheetData></worksheet>',
    })
    const input = createInputFiles([file])[0]
    const padded = { ...config, find: 'Visible', replacement: ' BatchDesk ' }
    const preview = await xlsxProcessor.scan(input, padded)
    expect(preview.matches).toHaveLength(2)
    expect(preview.matches.every((match) => !match.context.includes('phonetic'))).toBe(true)
    const artifact = await xlsxProcessor.apply(input, padded, preview)
    const zip = await JSZip.loadAsync(artifact.blob)
    const shared = await zip.file('xl/sharedStrings.xml')!.async('string')
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    expect(shared).toContain('xml:space="preserve"> BatchDesk </')
    expect(shared).toContain('Hidden phonetic')
    expect(sheet).toContain('xml:space="preserve"> BatchDesk </')
    expect(sheet).toContain('Hidden inline')
  })

  it('does not modify digitally signed workbooks', async () => {
    const file = await makeXlsx({ '_xmlsignatures/sig1.xml': '<Signature/>' })
    const preview = await xlsxProcessor.scan(createInputFiles([file])[0], config)
    expect(preview.status).toBe('skipped')
    expect(preview.warnings).toContain('digitalSignature')
  })
})
