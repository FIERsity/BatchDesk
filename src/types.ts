export type Language = 'zh' | 'en'
export type FileKind = 'docx' | 'xlsx' | 'legacy' | 'other'
export type Severity = 'info' | 'warning' | 'error'
export type ProcessorId = 'rename' | 'docx-replace' | 'xlsx-replace'
export type RenameSortMode = 'path' | 'name' | 'added'
export type StructuredColumnKind = 'literal' | 'sequence' | 'manual'
export type StructuredSequenceFormat = 'arabic' | 'chinese-lower'

export interface RenameColumn {
  id: string
  kind: StructuredColumnKind
  label: string
  enabled: boolean
  value: string
  sequenceFormat: StructuredSequenceFormat
}

export interface StructuredRenameConfig {
  columns: RenameColumn[]
  sortMode: RenameSortMode
}

export interface AuditIssue {
  code: string
  severity: Severity
  message: string
}

export interface InputFile {
  id: string
  file: File
  name: string
  relativePath: string
  directory: string
  extension: string
  kind: FileKind
  size: number
  lastModified: number
  issues: AuditIssue[]
}

export type RenameRule =
  | { id: string; type: 'replace'; enabled: boolean; find: string; replacement: string; regex: boolean; caseSensitive: boolean }
  | { id: string; type: 'prefix' | 'suffix'; enabled: boolean; value: string }
  | { id: string; type: 'sequence'; enabled: boolean; start: number; step: number; pad: number; separator: string; position: 'prefix' | 'suffix' }
  | { id: string; type: 'case'; enabled: boolean; mode: 'lower' | 'upper' | 'title' }
  | { id: string; type: 'normalize'; enabled: boolean; unicode: boolean; whitespace: boolean }
  | { id: string; type: 'date'; enabled: boolean; format: 'YYYY-MM-DD' | 'YYYYMMDD'; position: 'prefix' | 'suffix' }

export interface RenamePreview {
  fileId: string
  inputPath: string
  before: string
  after: string
  outputPath: string
  changed: boolean
  collision: boolean
  collisionResolved: boolean
  extensionChanged: boolean
  error?: string
}

export interface StructuredRenamePreview extends RenamePreview {
  cells: Record<string, string>
}

export type MatchMode = 'exact' | 'flexible-whitespace'

export interface DocxReplaceConfig {
  find: string
  replacement: string
  mode: MatchMode
  caseSensitive: boolean
  scopes: { body: boolean; headers: boolean; footnotes: boolean }
}

export interface XlsxReplaceConfig {
  find: string
  replacement: string
  wholeCell: boolean
  caseSensitive: boolean
  sheetNames: string[]
}

export interface ReplacementMatch {
  id: string
  fileId: string
  part: string
  location: string
  context: string
  before: string
  after: string
  selected: boolean
}

export interface FilePreview {
  fileId: string
  fileName: string
  status: 'ready' | 'skipped' | 'error'
  matches: ReplacementMatch[]
  warnings: string[]
  metadata?: Record<string, string | number | string[]>
}

export interface OutputArtifact {
  fileId: string
  fileName: string
  relativePath: string
  blob: Blob
  appliedCount: number
  warnings: string[]
}

export interface FileOperationResult {
  inputPath: string
  outputPath: string
  status: 'success' | 'skipped' | 'failed'
  matchCount: number
  appliedCount: number
  warnings: string[]
  error?: string
}

export interface BatchReport {
  schemaVersion: 1
  jobId: string
  operation: ProcessorId
  createdAt: string
  totals: { input: number; success: number; skipped: number; failed: number }
  files: FileOperationResult[]
}

export interface BatchProcessor<TConfig> {
  id: ProcessorId
  supports(file: InputFile): boolean
  scan(file: InputFile, config: TConfig, signal?: AbortSignal): Promise<FilePreview>
  apply(file: InputFile, config: TConfig, preview: FilePreview, signal?: AbortSignal): Promise<OutputArtifact>
}
