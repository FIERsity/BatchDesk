import { FilePlus2, FolderOpen, RefreshCw, Search, Sheet, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FileKind, InputFile } from '../types'
import { formatBytes } from '../lib/files'

interface InboxProps {
  files: InputFile[]
  selected: Set<string>
  busy: boolean
  onAdd: (files: File[]) => void
  onSelectionChange: (selected: Set<string>) => void
  onRemove: (id: string) => void
  onClear: () => void
  onOpen: (workspace: 'rename' | 'docx-replace' | 'xlsx-replace') => void
  t: (key: string, variables?: Record<string, string | number>) => string
}

export function Inbox({ files, selected, busy, onAdd, onSelectionChange, onRemove, onClear, onOpen, t }: InboxProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<FileKind | 'all'>('all')
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    folderInput.current?.setAttribute('webkitdirectory', '')
    folderInput.current?.setAttribute('directory', '')
  }, [])

  const visible = useMemo(() => files.filter((file) => {
    const matchesKind = kind === 'all' || file.kind === kind
    const query = search.trim().toLocaleLowerCase()
    return matchesKind && (!query || file.relativePath.toLocaleLowerCase().includes(query))
  }), [files, kind, search])
  const issueCount = files.reduce((count, file) => count + file.issues.length, 0)
  const allVisibleSelected = visible.length > 0 && visible.every((file) => selected.has(file.id))

  const acceptInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = Array.from(event.target.files ?? [])
    if (next.length) onAdd(next)
    event.target.value = ''
  }
  const toggleVisible = () => {
    const next = new Set(selected)
    visible.forEach((file) => allVisibleSelected ? next.delete(file.id) : next.add(file.id))
    onSelectionChange(next)
  }

  return (
    <main className="workspace inbox-workspace">
      <input ref={fileInput} type="file" multiple hidden onChange={acceptInput} />
      <input ref={folderInput} type="file" multiple hidden onChange={acceptInput} />
      <section
        className={`drop-band ${dragging ? 'dragging' : ''}`}
        onDragEnter={(event) => { event.preventDefault(); setDragging(true) }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false) }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); onAdd(Array.from(event.dataTransfer.files)) }}
      >
        <div className="drop-copy"><Upload size={24} /><span><strong>{t('dropTitle')}</strong><small>{t('dropHint')}</small></span></div>
        <div className="button-row">
          <button type="button" className="btn secondary" onClick={() => fileInput.current?.click()}><FilePlus2 size={16} />{t('addFiles')}</button>
          <button type="button" className="btn secondary" onClick={() => folderInput.current?.click()}><FolderOpen size={16} />{t('addFolder')}</button>
        </div>
      </section>

      <section className="summary-strip" aria-label={t('inbox')}>
        <div><span>{files.length}</span><small>{t('totalFiles')}</small></div>
        <div><span>{files.filter((file) => file.kind === 'docx').length}</span><small>{t('wordFiles')}</small></div>
        <div><span>{files.filter((file) => file.kind === 'xlsx').length}</span><small>{t('excelFiles')}</small></div>
        <div className={issueCount ? 'summary-warning' : ''}><span>{issueCount}</span><small>{t('issues')}</small></div>
        <p>{t('installDesktop')}</p>
      </section>

      <section className="file-surface">
        <div className="toolbar">
          <label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchFiles')} /></label>
          <select value={kind} onChange={(event) => setKind(event.target.value as FileKind | 'all')} aria-label={t('allTypes')}>
            <option value="all">{t('allTypes')}</option><option value="docx">DOCX</option><option value="xlsx">XLSX</option><option value="legacy">DOC / XLS</option><option value="other">{t('unsupported')}</option>
          </select>
          <span className="toolbar-spacer" />
          <span className="selection-label">{t('selectedCount', { count: selected.size })}</span>
          <button type="button" className="icon-btn" title={t('clear')} aria-label={t('clear')} disabled={!files.length || busy} onClick={onClear}><Trash2 size={16} /></button>
        </div>

        {files.length === 0 ? (
          <div className="empty-table"><Sheet size={28} /><span>{t('inbox')}</span></div>
        ) : (
          <div className="table-scroll">
            <table className="file-table">
              <thead><tr><th className="check-cell"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label={t('selectAll')} /></th><th>{t('name')}</th><th>{t('path')}</th><th>{t('type')}</th><th>{t('size')}</th><th>{t('status')}</th><th className="action-cell" /></tr></thead>
              <tbody>{visible.map((file) => {
                const highest = file.issues.some((issue) => issue.severity === 'error') ? 'error' : file.issues.length ? 'warning' : 'ready'
                return <tr key={file.id} className={selected.has(file.id) ? 'selected-row' : ''}>
                  <td className="check-cell"><input type="checkbox" checked={selected.has(file.id)} onChange={() => { const next = new Set(selected); if (next.has(file.id)) next.delete(file.id); else next.add(file.id); onSelectionChange(next) }} aria-label={`${t('name')}: ${file.name}`} /></td>
                  <td><div className="file-name"><span className={`file-badge ${file.kind}`}>{file.kind === 'other' ? 'FILE' : file.kind.toUpperCase()}</span><span title={file.name}>{file.name}</span></div></td>
                  <td className="muted truncate" title={file.directory}>{file.directory || '—'}</td><td>{file.extension || '—'}</td><td className="numeric">{formatBytes(file.size)}</td>
                  <td><span className={`status-pill ${highest}`} title={file.issues.map((issue) => t(issue.message)).join('\n')}>{highest === 'ready' ? t('healthy') : highest === 'warning' ? t('warning') : t('blocked')} {file.issues.length ? `(${file.issues.length})` : ''}</span></td>
                  <td className="action-cell"><button type="button" className="icon-btn subtle" onClick={() => onRemove(file.id)} title={t('remove')} aria-label={`${t('remove')} ${file.name}`}><X size={15} /></button></td>
                </tr>
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      <div className="action-dock" aria-label="Batch actions">
        <span>{t('selectedCount', { count: selected.size })}</span>
        <button type="button" className="btn secondary" disabled={!selected.size || busy} onClick={() => onOpen('rename')}><RefreshCw size={16} />{t('rename')}</button>
        <button type="button" className="btn secondary" disabled={!files.some((file) => selected.has(file.id) && file.kind === 'docx') || busy} onClick={() => onOpen('docx-replace')}><FilePlus2 size={16} />{t('wordReplace')}</button>
        <button type="button" className="btn primary" disabled={!files.some((file) => selected.has(file.id) && file.kind === 'xlsx') || busy} onClick={() => onOpen('xlsx-replace')}><Sheet size={16} />{t('excelReplace')}</button>
      </div>
    </main>
  )
}
