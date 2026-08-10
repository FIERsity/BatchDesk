import JSZip from 'jszip'
import type { BatchProcessor, DocxReplaceConfig, FilePreview, OutputArtifact, ReplacementMatch } from '../types'
import { applyTextRanges, collectText, contextSnippet, elementsByLocalName, findTextRanges, parseXml, serializeXml, visibleTextNodes, type XmlDocument } from './ooxml'

const MAIN_PART = 'word/document.xml'

function docxParts(zip: JSZip, config: DocxReplaceConfig): string[] {
  return Object.keys(zip.files).filter((path) => {
    if (path === MAIN_PART) return config.scopes.body
    if (/^word\/(header|footer)\d*\.xml$/.test(path)) return config.scopes.headers
    if (/^word\/(footnotes|endnotes)\.xml$/.test(path)) return config.scopes.footnotes
    return false
  })
}

function partLabel(part: string): string {
  if (part === MAIN_PART) return 'body'
  if (part.includes('header')) return 'header'
  if (part.includes('footer')) return 'footer'
  if (part.includes('footnotes')) return 'footnotes'
  if (part.includes('endnotes')) return 'endnotes'
  return part
}

function matchId(fileId: string, part: string, paragraph: number, start: number, end: number): string {
  return `${fileId}:${part}:${paragraph}:${start}:${end}`
}

function scanPart(fileId: string, part: string, document: XmlDocument, config: DocxReplaceConfig): ReplacementMatch[] {
  const matches: ReplacementMatch[] = []
  const paragraphs = elementsByLocalName(document, 'p')
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const nodes = visibleTextNodes(paragraph)
    const { text } = collectText(nodes)
    const ranges = findTextRanges(text, config.find, {
      flexibleWhitespace: config.mode === 'flexible-whitespace',
      caseSensitive: config.caseSensitive,
    })
    ranges.forEach((range) => {
      matches.push({
        id: matchId(fileId, part, paragraphIndex, range.start, range.end),
        fileId,
        part,
        location: `${partLabel(part)} · ${paragraphIndex + 1}`,
        context: contextSnippet(text, range.start, range.end),
        before: range.text,
        after: config.replacement,
        selected: true,
      })
    })
  })
  return matches
}

function containsTrackedChanges(documents: XmlDocument[]): boolean {
  return documents.some((document) => elementsByLocalName(document, 'ins').length > 0 || elementsByLocalName(document, 'del').length > 0)
}

async function loadDocx(file: File): Promise<JSZip> {
  try {
    const zip = await JSZip.loadAsync(file)
    if (!zip.file('[Content_Types].xml') || !zip.file(MAIN_PART)) throw new Error('notDocx')
    return zip
  } catch (error) {
    if (error instanceof Error && error.message === 'notDocx') throw error
    throw new Error('invalidOrEncryptedDocx')
  }
}

function ensurePreservedSpaces(document: XmlDocument) {
  for (const node of elementsByLocalName(document, 't')) {
    const value = node.textContent ?? ''
    if (/^\s|\s$/.test(value)) node.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
  }
}

export const docxProcessor: BatchProcessor<DocxReplaceConfig> = {
  id: 'docx-replace',
  supports: (file) => file.kind === 'docx',
  async scan(file, config, signal): Promise<FilePreview> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const zip = await loadDocx(file.file)
      const parts = docxParts(zip, config)
      const parsed: Array<{ part: string; document: XmlDocument }> = []
      for (const part of parts) {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
        const xml = await zip.file(part)!.async('string')
        parsed.push({ part, document: parseXml(xml) })
      }
      if (containsTrackedChanges(parsed.map((item) => item.document))) {
        return { fileId: file.id, fileName: file.name, status: 'skipped', matches: [], warnings: ['trackedChanges'] }
      }
      const matches = parsed.flatMap(({ part, document }) => scanPart(file.id, part, document, config))
      return { fileId: file.id, fileName: file.name, status: 'ready', matches, warnings: [], metadata: { parts: parts.length } }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      return { fileId: file.id, fileName: file.name, status: 'error', matches: [], warnings: [error instanceof Error ? error.message : 'invalidOrEncryptedDocx'] }
    }
  },
  async apply(file, config, preview, signal): Promise<OutputArtifact> {
    if (preview.status !== 'ready') throw new Error(preview.warnings[0] ?? 'fileNotReady')
    const selected = new Set(preview.matches.filter((match) => match.selected).map((match) => match.id))
    const zip = await loadDocx(file.file)
    let appliedCount = 0
    for (const part of docxParts(zip, config)) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const document = parseXml(await zip.file(part)!.async('string'))
      const paragraphs = elementsByLocalName(document, 'p')
      paragraphs.forEach((paragraph, paragraphIndex) => {
        const nodes = visibleTextNodes(paragraph)
        const { text, spans } = collectText(nodes)
        const ranges = findTextRanges(text, config.find, {
          flexibleWhitespace: config.mode === 'flexible-whitespace',
          caseSensitive: config.caseSensitive,
        })
        appliedCount += applyTextRanges(
          spans,
          ranges,
          config.replacement,
          selected,
          (range) => matchId(file.id, part, paragraphIndex, range.start, range.end),
        )
      })
      ensurePreservedSpaces(document)
      zip.file(part, serializeXml(document))
    }
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    return { fileId: file.id, fileName: file.name, relativePath: file.relativePath, blob, appliedCount, warnings: [] }
  },
}

export async function inspectDocx(file: File): Promise<'valid' | 'invalid'> {
  try {
    await loadDocx(file)
    return 'valid'
  } catch {
    return 'invalid'
  }
}
