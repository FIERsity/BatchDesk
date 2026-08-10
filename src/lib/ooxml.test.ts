import { describe, expect, it } from 'vitest'
import { applyTextRanges, collectText, elementsByLocalName, findTextRanges, parseXml, visibleTextNodes } from './ooxml'

describe('OOXML text mapping', () => {
  it('replaces a phrase split across formatted runs', () => {
    const document = parseXml('<w:p xmlns:w="urn:w"><w:r><w:t>Hello </w:t></w:r><w:r><w:rPr/><w:t>World</w:t></w:r></w:p>')
    const paragraph = elementsByLocalName(document, 'p')[0]
    const nodes = visibleTextNodes(paragraph)
    const collected = collectText(nodes)
    const ranges = findTextRanges(collected.text, 'Hello World', {})
    expect(applyTextRanges(collected.spans, ranges, 'BatchDesk')).toBe(1)
    expect(collectText(nodes).text).toBe('BatchDesk')
  })

  it('maps flexible whitespace back to original offsets', () => {
    const ranges = findTextRanges('Before Hello   \n World After', 'Hello World', { flexibleWhitespace: true })
    expect(ranges).toHaveLength(1)
    expect(ranges[0].text).toBe('Hello   \n World')
  })
})
