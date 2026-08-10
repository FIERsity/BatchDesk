import { DOMParser, XMLSerializer, type Document as XmlDocument, type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom'

export type { XmlDocument, XmlElement, XmlNode }

export interface TextSpan {
  node: XmlNode
  start: number
  end: number
}

export interface TextMatchRange {
  start: number
  end: number
  text: string
}

export function parseXml(xml: string): XmlDocument {
  const errors: string[] = []
  const parser = new DOMParser({ onError: (level, message) => { if (level !== 'warning') errors.push(message) } })
  const document = parser.parseFromString(xml, 'application/xml')
  if (errors.length || document.getElementsByTagName('parsererror').length) throw new Error('Invalid XML')
  return document
}

export function serializeXml(document: XmlDocument): string {
  return new XMLSerializer().serializeToString(document)
}

export function elementsByLocalName(root: XmlNode, localName: string): XmlElement[] {
  const result: XmlElement[] = []
  const visit = (node: XmlNode) => {
    if (node.nodeType === 1 && (node as XmlElement).localName === localName) result.push(node as XmlElement)
    for (let child = node.firstChild; child; child = child.nextSibling) visit(child)
  }
  visit(root)
  return result
}

export function visibleTextNodes(container: XmlNode, excludedAncestors = new Set(['del', 'moveFrom', 'moveTo', 'instrText', 'commentRangeStart', 'commentRangeEnd'])): XmlNode[] {
  return elementsByLocalName(container, 't').filter((element) => {
    let parent: XmlNode | null = element.parentNode
    while (parent && parent !== container) {
      if (parent.nodeType === 1 && excludedAncestors.has((parent as XmlElement).localName ?? '')) return false
      parent = parent.parentNode
    }
    return true
  })
}

export function ensurePreservedSpaces(nodes: XmlNode[]): void {
  for (const node of nodes) {
    if (/^\s|\s$/.test(node.textContent ?? '')) {
      ;(node as XmlElement).setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:space', 'preserve')
    }
  }
}

export function collectText(nodes: XmlNode[]): { text: string; spans: TextSpan[] } {
  let text = ''
  const spans = nodes.map((node) => {
    const value = node.textContent ?? ''
    const span = { node, start: text.length, end: text.length + value.length }
    text += value
    return span
  })
  return { text, spans }
}

function normalizeWhitespaceWithMap(value: string): { text: string; map: number[] } {
  let text = ''
  const map: number[] = []
  let inWhitespace = false
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (/\s/.test(char)) {
      if (!inWhitespace) {
        text += ' '
        map.push(index)
        inWhitespace = true
      }
    } else {
      text += char
      map.push(index)
      inWhitespace = false
    }
  }
  map.push(value.length)
  return { text, map }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findTextRanges(text: string, find: string, options: { flexibleWhitespace?: boolean; caseSensitive?: boolean; wholeText?: boolean }): TextMatchRange[] {
  if (!find) return []
  const source = options.flexibleWhitespace ? normalizeWhitespaceWithMap(text) : { text, map: Array.from({ length: text.length + 1 }, (_, index) => index) }
  const needle = options.flexibleWhitespace ? normalizeWhitespaceWithMap(find).text : find
  const flags = options.caseSensitive ? 'g' : 'gi'
  const regex = new RegExp(options.wholeText ? `^${escapeRegExp(needle)}$` : escapeRegExp(needle), flags)
  const ranges: TextMatchRange[] = []
  for (const match of source.text.matchAll(regex)) {
    const normalizedStart = match.index ?? 0
    const normalizedEnd = normalizedStart + match[0].length
    const start = source.map[normalizedStart] ?? normalizedStart
    const end = source.map[normalizedEnd] ?? text.length
    ranges.push({ start, end, text: text.slice(start, end) })
    if (match[0].length === 0) break
  }
  return ranges
}

export function applyTextRanges(spans: TextSpan[], ranges: TextMatchRange[], replacement: string, selected?: Set<string>, idForRange?: (range: TextMatchRange, index: number) => string): number {
  let applied = 0
  for (let rangeIndex = ranges.length - 1; rangeIndex >= 0; rangeIndex -= 1) {
    const range = ranges[rangeIndex]
    if (selected && idForRange && !selected.has(idForRange(range, rangeIndex))) continue
    const affected = spans.filter((span) => span.end > range.start && span.start < range.end)
    if (!affected.length) continue
    const first = affected[0]
    const last = affected[affected.length - 1]
    const firstValue = first.node.textContent ?? ''
    const lastValue = last.node.textContent ?? ''
    const prefix = firstValue.slice(0, Math.max(0, range.start - first.start))
    const suffix = lastValue.slice(Math.max(0, range.end - last.start))
    first.node.textContent = `${prefix}${replacement}${first === last ? suffix : ''}`
    for (let i = 1; i < affected.length; i += 1) affected[i].node.textContent = affected[i] === last ? suffix : ''
    applied += 1
  }
  return applied
}

export function contextSnippet(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 36)
  const to = Math.min(text.length, end + 36)
  return `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`
}
