import { AlertTriangle, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Header } from './components/Header'
import { Inbox } from './components/Inbox'
import { ProgressOverlay } from './components/ProgressOverlay'
import { RenameWorkspace } from './components/RenameWorkspace'
import { ReplaceWorkspace } from './components/ReplaceWorkspace'
import { ResultView, type CompletedResult } from './components/ResultView'
import { downloadBlob, writeArtifactsToDirectory } from './lib/download'
import { createInputFiles, markDuplicatePaths } from './lib/files'
import { translate } from './lib/i18n'
import type { DocxReplaceConfig, FilePreview, InputFile, Language, RenamePreview, RenameRule, XlsxReplaceConfig } from './types'
import { BatchWorkerClient } from './worker/client'
import type { WorkerResponse } from './worker/protocol'

type Workspace = 'inbox' | 'rename' | 'docx-replace' | 'xlsx-replace'
type ProgressMessage = Extract<WorkerResponse, { type: 'JOB_PROGRESS' }>

function newJobId() {
  return crypto.randomUUID?.() ?? `job-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function App() {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('batchdesk.language') === 'en' ? 'en' : 'zh')
  const [files, setFiles] = useState<InputFile[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [workspace, setWorkspace] = useState<Workspace>('inbox')
  const [progress, setProgress] = useState<ProgressMessage | null>(null)
  const [activeJob, setActiveJob] = useState<string | null>(null)
  const [result, setResult] = useState<CompletedResult | null>(null)
  const [notice, setNotice] = useState<string>('')
  const clientRef = useRef<BatchWorkerClient | null>(null)
  const t = useCallback((key: string, variables: Record<string, string | number> = {}) => translate(language, key, variables), [language])

  useEffect(() => {
    localStorage.setItem('batchdesk.language', language)
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
  }, [language])
  useEffect(() => {
    const client = new BatchWorkerClient()
    clientRef.current = client
    return () => {
      if (clientRef.current === client) clientRef.current = null
      client.dispose()
    }
  }, [])

  const selectedFiles = useMemo(() => files.filter((file) => selected.has(file.id)), [files, selected])
  const operationFiles = useMemo(() => workspace === 'docx-replace' ? selectedFiles.filter((file) => file.kind === 'docx') : workspace === 'xlsx-replace' ? selectedFiles.filter((file) => file.kind === 'xlsx') : selectedFiles, [selectedFiles, workspace])

  const beginJob = (jobId: string) => {
    setActiveJob(jobId)
    setProgress({ type: 'JOB_PROGRESS', jobId, completed: 0, total: 0, phase: 'preview' })
  }
  const endJob = () => { setActiveJob(null); setProgress(null) }
  const onProgress = (message: ProgressMessage) => setProgress(message)

  const addFiles = async (incoming: File[]) => {
    const additions = createInputFiles(incoming)
    if (!additions.length) return
    setFiles((current) => markDuplicatePaths([...current, ...additions]))
    setSelected((current) => new Set([...current, ...additions.map((file) => file.id)]))
    const totalSize = additions.reduce((sum, item) => sum + item.size, 0)
    if (totalSize > 300 * 1024 ** 2 || additions.some((item) => item.size > 100 * 1024 ** 2)) setNotice(t('largeBatch'))
    const officeFiles = additions.filter((file) => file.kind === 'docx' || file.kind === 'xlsx')
    if (!officeFiles.length) return
    const jobId = newJobId()
    beginJob(jobId)
    try {
      const response = await clientRef.current!.request<Extract<WorkerResponse, { type: 'AUDIT_RESULT' }>>({ type: 'AUDIT_FILES', jobId, files: officeFiles }, onProgress)
      if (response.invalidFileIds.length) {
        const invalid = new Set(response.invalidFileIds)
        setFiles((current) => current.map((file) => invalid.has(file.id) && !file.issues.some((issue) => issue.code === 'invalid-ooxml')
          ? { ...file, issues: [...file.issues, { code: 'invalid-ooxml', severity: 'error', message: 'invalidOoxml' }] }
          : file))
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice(error instanceof Error ? t(error.message) : t('processingFailed'))
    } finally { endJob() }
  }

  const removeFile = (id: string) => {
    setFiles((current) => markDuplicatePaths(current.filter((file) => file.id !== id)))
    setSelected((current) => { const next = new Set(current); next.delete(id); return next })
  }
  const clearFiles = () => { setFiles([]); setSelected(new Set()); setResult(null) }
  const openWorkspace = (next: Exclude<Workspace, 'inbox'>) => {
    if (!selectedFiles.length) { setNotice(t('noSelectedFiles')); return }
    setWorkspace(next)
  }

  const scanReplacement = async (operation: 'docx-replace' | 'xlsx-replace', config: DocxReplaceConfig | XlsxReplaceConfig): Promise<FilePreview[]> => {
    const targets = operation === 'docx-replace' ? selectedFiles.filter((file) => file.kind === 'docx') : selectedFiles.filter((file) => file.kind === 'xlsx')
    if (!targets.length) { setNotice(t('unsupportedSelection')); return [] }
    const jobId = newJobId()
    beginJob(jobId)
    try {
      const response = await clientRef.current!.request<Extract<WorkerResponse, { type: 'PREVIEW_RESULT' }>>({ type: 'PREVIEW_OPERATION', jobId, operation, files: targets, config }, onProgress)
      return response.previews
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice(error instanceof Error ? t(error.message) : t('processingFailed'))
      return []
    } finally { endJob() }
  }

  const acceptRunResult = (response: Extract<WorkerResponse, { type: 'RUN_RESULT' }>) => {
    setResult({ artifacts: response.artifacts, bundle: response.bundle, report: response.report, reportJson: response.reportJson, reportCsv: response.reportCsv })
  }
  const runRename = async (previews: RenamePreview[], rules: RenameRule[]) => {
    const jobId = newJobId(); beginJob(jobId)
    try {
      const response = await clientRef.current!.request<Extract<WorkerResponse, { type: 'RUN_RESULT' }>>({ type: 'RUN_OPERATION', jobId, files: operationFiles, payload: { operation: 'rename', previews, rules } }, onProgress)
      acceptRunResult(response)
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice(error instanceof Error ? t(error.message) : t('processingFailed')) }
    finally { endJob() }
  }
  const runReplacement = async (operation: 'docx-replace' | 'xlsx-replace', config: DocxReplaceConfig | XlsxReplaceConfig, previews: FilePreview[]) => {
    const jobId = newJobId(); beginJob(jobId)
    try {
      const payload = operation === 'docx-replace'
        ? { operation, config: config as DocxReplaceConfig, previews } as const
        : { operation, config: config as XlsxReplaceConfig, previews } as const
      const response = await clientRef.current!.request<Extract<WorkerResponse, { type: 'RUN_RESULT' }>>({ type: 'RUN_OPERATION', jobId, files: operationFiles, payload }, onProgress)
      acceptRunResult(response)
    } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice(error instanceof Error ? t(error.message) : t('processingFailed')) }
    finally { endJob() }
  }
  const saveFolder = async () => {
    if (!result) return
    try {
      const supported = await writeArtifactsToDirectory(result.artifacts)
      if (!supported) downloadBlob(result.bundle, `batchdesk-${result.report.createdAt.slice(0, 10)}.zip`)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setNotice(error instanceof Error ? error.message : t('processingFailed'))
    }
  }

  const cancelJob = () => { if (activeJob) clientRef.current?.cancel(activeJob) }
  const backToInbox = () => { setWorkspace('inbox'); setResult(null) }

  return <div className="app-shell">
    <Header language={language} onLanguageChange={setLanguage} t={t} />
    <div className="mobile-notice"><AlertTriangle size={15} />{t('mobileNotice')}</div>
    {notice && <div className="notice-bar" role="alert"><AlertTriangle size={16} /><span>{notice}</span><button type="button" className="icon-btn subtle" onClick={() => setNotice('')} aria-label={t('close')}><X size={15} /></button></div>}
    {result ? <ResultView result={result} onBack={backToInbox} onDownload={downloadBlob} onSaveFolder={() => void saveFolder()} t={t} />
      : workspace === 'inbox' ? <Inbox files={files} selected={selected} busy={Boolean(activeJob)} onAdd={(next) => void addFiles(next)} onSelectionChange={setSelected} onRemove={removeFile} onClear={clearFiles} onOpen={openWorkspace} t={t} />
        : workspace === 'rename' ? <RenameWorkspace files={operationFiles} busy={Boolean(activeJob)} onBack={() => setWorkspace('inbox')} onRun={(previews, rules) => void runRename(previews, rules)} t={t} />
          : <ReplaceWorkspace operation={workspace} files={operationFiles} busy={Boolean(activeJob)} onBack={() => setWorkspace('inbox')} onScan={scanReplacement} onRun={(operation, config, previews) => void runReplacement(operation, config, previews)} t={t} />}
    {progress && <ProgressOverlay phase={progress.phase} completed={progress.completed} total={progress.total} currentFile={progress.currentFile} onCancel={cancelJob} t={t} />}
  </div>
}
