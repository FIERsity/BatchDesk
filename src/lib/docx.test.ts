import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { createInputFiles } from './files'
import { docxProcessor } from './docx'
import { makeDocx, wordDocument } from '../test/fixtures'
import type { DocxReplaceConfig } from '../types'

const config: DocxReplaceConfig = { find: 'Hello World', replacement: 'BatchDesk', mode: 'exact', caseSensitive: true, scopes: { body: true, headers: true, footnotes: true } }

describe('DOCX processor', () => {
  it('scans and replaces text split across runs and story parts', async () => {
    const file = await makeDocx(wordDocument('<w:p><w:r><w:t xml:space="preserve">Hello </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>World</w:t></w:r></w:p>'), {
      'word/header1.xml': '<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:r><w:t>Hello World</w:t></w:r></w:p></w:hdr>',
    })
    const input = createInputFiles([file])[0]
    const preview = await docxProcessor.scan(input, config)
    expect(preview.matches).toHaveLength(2)
    const artifact = await docxProcessor.apply(input, config, preview)
    expect(artifact.appliedCount).toBe(2)
    const zip = await JSZip.loadAsync(artifact.blob)
    expect(await zip.file('word/document.xml')!.async('string')).toContain('BatchDesk')
    expect(await zip.file('word/header1.xml')!.async('string')).toContain('BatchDesk')
  })

  it('blocks documents with unresolved tracked changes', async () => {
    const file = await makeDocx(wordDocument('<w:p><w:ins><w:r><w:t>Hello World</w:t></w:r></w:ins></w:p>'))
    const preview = await docxProcessor.scan(createInputFiles([file])[0], config)
    expect(preview.status).toBe('skipped')
    expect(preview.warnings).toContain('trackedChanges')
  })

  it('scans 60 regular documents without losing matches', async () => {
    const file = await makeDocx(wordDocument('<w:p><w:r><w:t>Hello World</w:t></w:r></w:p>'))
    const inputs = createInputFiles(Array.from({ length: 60 }, (_, index) => new File([file], `sample-${index}.docx`, { type: file.type })))
    const previews = await Promise.all(inputs.map((input) => docxProcessor.scan(input, config)))
    expect(previews.reduce((sum, preview) => sum + preview.matches.length, 0)).toBe(60)
  })
})
