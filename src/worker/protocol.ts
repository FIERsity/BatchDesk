import type { BatchReport, DocxReplaceConfig, FilePreview, InputFile, OutputArtifact, ProcessorId, RenamePreview, RenameRule, XlsxReplaceConfig } from '../types'

export type OperationConfig =
  | { operation: 'rename'; rules: RenameRule[]; previews: RenamePreview[] }
  | { operation: 'docx-replace'; config: DocxReplaceConfig; previews?: FilePreview[] }
  | { operation: 'xlsx-replace'; config: XlsxReplaceConfig; previews?: FilePreview[] }

export type WorkerRequest =
  | { type: 'AUDIT_FILES'; jobId: string; files: InputFile[] }
  | { type: 'PREVIEW_OPERATION'; jobId: string; operation: Exclude<ProcessorId, 'rename'>; files: InputFile[]; config: DocxReplaceConfig | XlsxReplaceConfig }
  | { type: 'RUN_OPERATION'; jobId: string; files: InputFile[]; payload: OperationConfig }
  | { type: 'CANCEL_JOB'; jobId: string }

export type WorkerResponse =
  | { type: 'JOB_PROGRESS'; jobId: string; completed: number; total: number; phase: 'audit' | 'preview' | 'process' | 'package'; currentFile?: string }
  | { type: 'AUDIT_RESULT'; jobId: string; invalidFileIds: string[] }
  | { type: 'PREVIEW_RESULT'; jobId: string; previews: FilePreview[] }
  | { type: 'RUN_RESULT'; jobId: string; artifacts: OutputArtifact[]; bundle: Blob; report: BatchReport; reportJson: Blob; reportCsv: Blob }
  | { type: 'JOB_ERROR'; jobId: string; error: string }
  | { type: 'JOB_CANCELLED'; jobId: string }
