import JSZip from 'jszip'

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`

export async function makeDocx(documentXml: string, extra: Record<string, string> = {}): Promise<File> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypes)
  zip.file('word/document.xml', documentXml)
  Object.entries(extra).forEach(([path, value]) => zip.file(path, value))
  const bytes = await zip.generateAsync({ type: 'uint8array' })
  const buffer = new Uint8Array(bytes.byteLength)
  buffer.set(bytes)
  return new File([buffer.buffer], 'sample.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
}

export function wordDocument(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
}

export async function makeXlsx(): Promise<File> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', contentTypes)
  zip.file('xl/workbook.xml', `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="People" sheetId="1" r:id="rId1"/></sheets></workbook>`)
  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`)
  zip.file('xl/sharedStrings.xml', `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2"><si><r><t>Hello </t></r><r><rPr><b/></rPr><t>World</t></r></si><si><t>Other</t></si></sst>`)
  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><f>CONCAT("Hello"," World")</f><v>Hello World</v></c><c r="C1" t="inlineStr"><is><t>Hello World</t></is></c></row></sheetData></worksheet>`)
  zip.file('xl/charts/chart1.xml', '<chart>untouched</chart>')
  const bytes = await zip.generateAsync({ type: 'uint8array' })
  const buffer = new Uint8Array(bytes.byteLength)
  buffer.set(bytes)
  return new File([buffer.buffer], 'sample.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
