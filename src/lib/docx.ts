import JSZip from 'jszip'
import type { BatchProcessor, DocxReplaceConfig, FilePreview, OutputArtifact, ReplacementMatch } from '../types'
import { throwIfAborted } from './abort'
import { applyTextRanges, collectText, contextSnippet, elementsByLocalName, ensurePreservedSpaces, findTextRanges, parseXml, serializeXml, visibleTextNodes, type XmlDocument, type XmlElement, type XmlNode } from './ooxml'

const MAIN_PART = 'word/document.xml'

function docxParts(zip: JSZip, config: DocxReplaceConfig): string[] {
  return Object.keys(zip.files).filter((path) => {
    if (path === MAIN_PART) return config.scopes.body
    if (/^word\/(header|footer)\d*\.xml$/.test(path)) return config.scopes.headers
    if (/^word\/(footnotes|endnotes)\.xml$/.test(path)) return config.scopes.footnotes
    return false
  })
}

function allDocxStoryParts(zip: JSZip): string[] {
  return Object.keys(zip.files).filter((path) => path === MAIN_PART || /^word\/(header|footer)\d*\.xml$/.test(path) || /^word\/(footnotes|endnotes)\.xml$/.test(path))
}

function hasDigitalSignature(zip: JSZip): boolean {
  return Object.keys(zip.files).some((path) => path.toLocaleLowerCase().startsWith('_xmlsignatures/'))
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
  const revisionNames = new Set([
    'ins', 'del', 'moveFrom', 'moveTo', 'moveFromRangeStart', 'moveFromRangeEnd', 'moveToRangeStart', 'moveToRangeEnd',
    'cellIns', 'cellDel', 'cellMerge', 'customXmlInsRangeStart', 'customXmlInsRangeEnd', 'customXmlDelRangeStart',
    'customXmlDelRangeEnd', 'customXmlMoveFromRangeStart', 'customXmlMoveFromRangeEnd', 'customXmlMoveToRangeStart', 'customXmlMoveToRangeEnd',
  ])
  return documents.some((document) => {
    const stack: XmlNode[] = [document]
    while (stack.length) {
      const node = stack.pop()!
      if (node.nodeType === 1) {
        const name = (node as XmlElement).localName ?? ''
        if (revisionNames.has(name) || name.endsWith('PrChange')) return true
      }
      for (let child = node.firstChild; child; child = child.nextSibling) stack.push(child)
    }
    return false
  })
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

export const docxProcessor: BatchProcessor<DocxReplaceConfig> = {
  id: 'docx-replace',
  supports: (file) => file.kind === 'docx',
  async scan(file, config, signal): Promise<FilePreview> {
    throwIfAborted(signal)
    try {
      const zip = await loadDocx(file.file)
      throwIfAborted(signal)
      if (hasDigitalSignature(zip)) return { fileId: file.id, fileName: file.name, status: 'skipped', matches: [], warnings: ['digitalSignature'] }
      const parts = allDocxStoryParts(zip)
      const parsed: Array<{ part: string; document: XmlDocument }> = []
      for (const part of parts) {
        throwIfAborted(signal)
        const xml = await zip.file(part)!.async('string')
        parsed.push({ part, document: parseXml(xml) })
      }
      if (containsTrackedChanges(parsed.map((item) => item.document))) {
        return { fileId: file.id, fileName: file.name, status: 'skipped', matches: [], warnings: ['trackedChanges'] }
      }
      const selectedParts = new Set(docxParts(zip, config))
      const matches = parsed.filter(({ part }) => selectedParts.has(part)).flatMap(({ part, document }) => scanPart(file.id, part, document, config))
      return { fileId: file.id, fileName: file.name, status: 'ready', matches, warnings: [], metadata: { parts: selectedParts.size } }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      return { fileId: file.id, fileName: file.name, status: 'error', matches: [], warnings: [error instanceof Error ? error.message : 'invalidOrEncryptedDocx'] }
    }
  },
  async apply(file, config, preview, signal): Promise<OutputArtifact> {
    if (preview.status !== 'ready') throw new Error(preview.warnings[0] ?? 'fileNotReady')
    const selected = new Set(preview.matches.filter((match) => match.selected).map((match) => match.id))
    const zip = await loadDocx(file.file)
    throwIfAborted(signal)
    if (hasDigitalSignature(zip)) throw new Error('digitalSignature')
    let appliedCount = 0
    for (const part of docxParts(zip, config)) {
      throwIfAborted(signal)
      const document = parseXml(await zip.file(part)!.async('string'))
      const paragraphs = elementsByLocalName(document, 'p')
      paragraphs.forEach((paragraph, paragraphIndex) => {
        const nodes = visibleTextNodes(paragraph)
        const { text, spans } = collectText(nodes)
        const ranges = findTextRanges(text, config.find, {
          flexibleWhitespace: config.mode === 'flexible-whitespace',
          caseSensitive: config.caseSensitive,
        })
        const count = applyTextRanges(
          spans,
          ranges,
          config.replacement,
          selected,
          (range) => matchId(file.id, part, paragraphIndex, range.start, range.end),
        )
        if (count) ensurePreservedSpaces(nodes)
        appliedCount += count
      })
      zip.file(part, serializeXml(document))
    }
    throwIfAborted(signal)
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, () => throwIfAborted(signal))
    throwIfAborted(signal)
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
