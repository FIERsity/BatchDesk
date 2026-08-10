export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function writeArtifactsToDirectory(artifacts: Array<{ relativePath: string; blob: Blob }>): Promise<boolean> {
  const picker = (window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker
  if (!picker) return false
  const root = await picker()
  for (const artifact of artifacts) {
    const parts = artifact.relativePath.split('/').filter(Boolean)
    let directory = root
    for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part, { create: true })
    const handle = await directory.getFileHandle(parts.at(-1) ?? 'output', { create: true })
    const writable = await handle.createWritable()
    await writable.write(artifact.blob)
    await writable.close()
  }
  return true
}
