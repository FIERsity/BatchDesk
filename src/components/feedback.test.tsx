import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProgressOverlay } from './ProgressOverlay'
import { ResultView, type CompletedResult } from './ResultView'

const t = (key: string) => key

describe('task feedback', () => {
  it('presents an all-failed result as an error instead of success', () => {
    const result: CompletedResult = {
      artifacts: [],
      bundle: new Blob(),
      reportCsv: new Blob(),
      reportJson: new Blob(),
      report: {
        schemaVersion: 1,
        jobId: 'failed-job',
        operation: 'docx-replace',
        createdAt: '2026-08-10T00:00:00.000Z',
        totals: { input: 1, success: 0, skipped: 0, failed: 1 },
        files: [{ inputPath: 'input.docx', outputPath: 'input.docx', status: 'failed', matchCount: 1, appliedCount: 0, warnings: [], error: 'processingFailed' }],
      },
    }
    const { container } = render(<ResultView result={result} onBack={() => {}} onDownload={() => {}} onSaveFolder={() => {}} t={t} />)
    expect(screen.getByRole('heading', { name: 'operationFailed' })).toBeInTheDocument()
    expect(container.querySelector('.result-hero')).toHaveClass('error')
  })

  it('focuses the cancel action, traps Tab, and supports Escape', () => {
    const before = document.createElement('button')
    document.body.appendChild(before)
    before.focus()
    const onCancel = vi.fn()
    const { unmount } = render(<ProgressOverlay phase="process" completed={1} total={3} onCancel={onCancel} t={t} />)
    const cancel = screen.getByRole('button', { name: /cancel/ })
    expect(cancel).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(cancel).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
    unmount()
    expect(before).toHaveFocus()
    before.remove()
  })
})
