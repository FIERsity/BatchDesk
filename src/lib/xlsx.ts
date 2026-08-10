import JSZip from 'jszip'
import type { BatchProcessor, FilePreview, OutputArtifact, ReplacementMatch, XlsxReplaceConfig } from '../types'
import { throwIfAborted } from './abort'
import { applyTextRanges, collectText, contextSnippet, elementsByLocalName, ensurePreservedSpaces, findTextRanges, parseXml, serializeXml, visibleTextNodes, type XmlDocument, type XmlElement, type XmlNode } from './ooxml'

interface SheetInfo { name: string; path: string }

function hasDigitalSignature(zip: JSZip): boolean {
  return Object.keys(zip.files).some((path) => path.toLocaleLowerCase().startsWith('_xmlsignatures/'))
}

async function loadXlsx(file: File): Promise<JSZip> {
  try {
    const zip = await JSZip.loadAsync(file)
    if (!zip.file('[Content_Types].xml') || !zip.file('xl/workbook.xml')) throw new Error('notXlsx')
    return zip
  } catch (error) {
    if (error instanceof Error && error.message === 'notXlsx') throw error
    throw new Error('invalidXlsx')
  }
}

function normalizeWorkbookTarget(target: string): string {
  const cleaned = target.replace(/^\//, '')
  if (cleaned.startsWith('xl/')) return cleaned
  return `xl/${cleaned.replace(/^\.\//, '')}`
}

async function workbookSheets(zip: JSZip): Promise<SheetInfo[]> {
  const workbook = parseXml(await zip.file('xl/workbook.xml')!.async('string'))
  const relsFile = zip.file('xl/_rels/workbook.xml.rels')
  if (!relsFile) throw new Error('invalidXlsxRelationships')
  const rels = parseXml(await relsFile.async('string'))
  const targets = new Map(elementsByLocalName(rels, 'Relationship').map((rel) => [rel.getAttribute('Id') ?? '', normalizeWorkbookTarget(rel.getAttribute('Target') ?? '')]))
  return elementsByLocalName(workbook, 'sheet').map((sheet) => ({
    name: sheet.getAttribute('name') ?? 'Sheet',
    path: targets.get(sheet.getAttribute('r:id') ?? sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') ?? '') ?? '',
  })).filter((sheet) => Boolean(sheet.path) && Boolean(zip.file(sheet.path)))
}

function cellText(cell: XmlElement, sharedStrings: XmlElement[]): { nodes: XmlNode[]; text: string; sharedIndex?: number } | undefined {
  if (elementsByLocalName(cell, 'f').length) return undefined
  const type = cell.getAttribute('t')
  if (type === 's') {
    const value = elementsByLocalName(cell, 'v')[0]?.textContent ?? ''
    const index = Number(value)
    if (!Number.isInteger(index) || !sharedStrings[index]) return undefined
    const nodes = visibleTextNodes(sharedStrings[index], new Set(['rPh']))
    return { nodes, text: collectText(nodes).text, sharedIndex: index }
  }
  if (type === 'inlineStr') {
    const inline = elementsByLocalName(cell, 'is')[0]
    if (!inline) return undefined
    const nodes = visibleTextNodes(inline, new Set(['rPh']))
    return { nodes, text: collectText(nodes).text }
  }
  return undefined
}

function xlsxMatchId(fileId: string, sheet: string, cell: string, start: number, end: number): string {
  return `${fileId}:${sheet}:${cell}:${start}:${end}`
}

function scanSheet(fileId: string, sheet: SheetInfo, document: XmlDocument, sharedStrings: XmlElement[], config: XlsxReplaceConfig): { matches: ReplacementMatch[]; skippedFormulas: number } {
  const matches: ReplacementMatch[] = []
  let skippedFormulas = 0
  for (const cell of elementsByLocalName(document, 'c')) {
    if (elementsByLocalName(cell, 'f').length) {
      skippedFormulas += 1
      continue
    }
    const content = cellText(cell, sharedStrings)
    if (!content) continue
    const reference = cell.getAttribute('r') ?? '?'
    const ranges = findTextRanges(content.text, config.find, { caseSensitive: config.caseSensitive, wholeText: config.wholeCell })
    ranges.forEach((range) => matches.push({
      id: xlsxMatchId(fileId, sheet.name, reference, range.start, range.end),
      fileId,
      part: sheet.path,
      location: `${sheet.name}!${reference}`,
      context: contextSnippet(content.text, range.start, range.end),
      before: range.text,
      after: config.replacement,
      selected: true,
    }))
  }
  return { matches, skippedFormulas }
}

function selectedSheets(all: SheetInfo[], config: XlsxReplaceConfig): SheetInfo[] {
  if (!config.sheetNames.length) return all
  const selected = new Set(config.sheetNames)
  return all.filter((sheet) => selected.has(sheet.name))
}

export const xlsxProcessor: BatchProcessor<XlsxReplaceConfig> = {
  id: 'xlsx-replace',
  supports: (file) => file.kind === 'xlsx',
  async scan(file, config, signal): Promise<FilePreview> {
    throwIfAborted(signal)
    try {
      const zip = await loadXlsx(file.file)
      throwIfAborted(signal)
      if (hasDigitalSignature(zip)) return { fileId: file.id, fileName: file.name, status: 'skipped', matches: [], warnings: ['digitalSignature'] }
      const sheets = await workbookSheets(zip)
      const sharedFile = zip.file('xl/sharedStrings.xml')
      const sharedDocument = sharedFile ? parseXml(await sharedFile.async('string')) : undefined
      const sharedStrings = sharedDocument ? elementsByLocalName(sharedDocument, 'si') : []
      const matches: ReplacementMatch[] = []
      let skippedFormulas = 0
      for (const sheet of selectedSheets(sheets, config)) {
        throwIfAborted(signal)
        const document = parseXml(await zip.file(sheet.path)!.async('string'))
        const result = scanSheet(file.id, sheet, document, sharedStrings, config)
        matches.push(...result.matches)
        skippedFormulas += result.skippedFormulas
      }
      return {
        fileId: file.id,
        fileName: file.name,
        status: 'ready',
        matches,
        warnings: skippedFormulas ? ['formulasSkipped'] : [],
        metadata: { sheetNames: sheets.map((sheet) => sheet.name), skippedFormulas },
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      return { fileId: file.id, fileName: file.name, status: 'error', matches: [], warnings: [error instanceof Error ? error.message : 'invalidXlsx'] }
    }
  },
  async apply(file, config, preview, signal): Promise<OutputArtifact> {
    if (preview.status !== 'ready') throw new Error(preview.warnings[0] ?? 'fileNotReady')
    const selected = new Set(preview.matches.filter((match) => match.selected).map((match) => match.id))
    const zip = await loadXlsx(file.file)
    throwIfAborted(signal)
    if (hasDigitalSignature(zip)) throw new Error('digitalSignature')
    const sheets = await workbookSheets(zip)
    const sharedFile = zip.file('xl/sharedStrings.xml')
    const sharedDocument = sharedFile ? parseXml(await sharedFile.async('string')) : undefined
    const sharedRoot = sharedDocument ? elementsByLocalName(sharedDocument, 'sst')[0] : undefined
    const sharedStrings = sharedDocument ? elementsByLocalName(sharedDocument, 'si') : []
    let appendedSharedStrings = 0
    let appliedCount = 0

    for (const sheet of selectedSheets(sheets, config)) {
      throwIfAborted(signal)
      const document = parseXml(await zip.file(sheet.path)!.async('string'))
      for (const cell of elementsByLocalName(document, 'c')) {
        const reference = cell.getAttribute('r') ?? '?'
        const content = cellText(cell, sharedStrings)
        if (!content) continue
        const ranges = findTextRanges(content.text, config.find, { caseSensitive: config.caseSensitive, wholeText: config.wholeCell })
        if (!ranges.length) continue
        const rangeIds = ranges.map((range) => xlsxMatchId(file.id, sheet.name, reference, range.start, range.end))
        if (!rangeIds.some((id) => selected.has(id))) continue

        if (content.sharedIndex !== undefined && sharedRoot && sharedDocument) {
          const clone = sharedStrings[content.sharedIndex].cloneNode(true) as XmlElement
          const nodes = visibleTextNodes(clone, new Set(['rPh']))
          const spans = collectText(nodes).spans
          const count = applyTextRanges(spans, ranges, config.replacement, selected, (range) => xlsxMatchId(file.id, sheet.name, reference, range.start, range.end))
          if (count) {
            ensurePreservedSpaces(nodes)
            sharedRoot.appendChild(clone)
            const newIndex = sharedStrings.length + appendedSharedStrings
            appendedSharedStrings += 1
            elementsByLocalName(cell, 'v')[0].textContent = String(newIndex)
            appliedCount += count
          }
        } else {
          const spans = collectText(content.nodes).spans
          const count = applyTextRanges(spans, ranges, config.replacement, selected, (range) => xlsxMatchId(file.id, sheet.name, reference, range.start, range.end))
          if (count) ensurePreservedSpaces(content.nodes)
          appliedCount += count
        }
      }
      zip.file(sheet.path, serializeXml(document))
    }

    if (sharedDocument && sharedRoot && appendedSharedStrings) {
      const originalUnique = Number(sharedRoot.getAttribute('uniqueCount') ?? sharedStrings.length)
      sharedRoot.setAttribute('uniqueCount', String(originalUnique + appendedSharedStrings))
      zip.file('xl/sharedStrings.xml', serializeXml(sharedDocument))
    }
    throwIfAborted(signal)
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, () => throwIfAborted(signal))
    throwIfAborted(signal)
    return { fileId: file.id, fileName: file.name, relativePath: file.relativePath, blob, appliedCount, warnings: preview.warnings }
  },
}

export async function inspectXlsx(file: File): Promise<'valid' | 'invalid'> {
  try {
    await loadXlsx(file)
    return 'valid'
  } catch {
    return 'invalid'
  }
}
