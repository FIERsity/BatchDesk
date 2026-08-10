export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function createUniqueOutputDirectory(root: FileSystemDirectoryHandle, requestedName: string): Promise<{ handle: FileSystemDirectoryHandle; name: string }> {
  const cleaned = [...requestedName].map((character) => /[<>:"/\\|?*]/.test(character) || character.charCodeAt(0) < 32 ? '-' : character).join('')
  const base = cleaned.replace(/[. ]+$/g, '') || 'BatchDesk-output'
  for (let suffix = 1; suffix < 10_000; suffix += 1) {
    const name = suffix === 1 ? base : `${base}-${suffix}`
    try {
      await root.getDirectoryHandle(name)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return { handle: await root.getDirectoryHandle(name, { create: true }), name }
      }
      throw error
    }
  }
  throw new Error('outputFolderConflict')
}

export async function writeArtifactsToDirectory(artifacts: Array<{ relativePath: string; blob: Blob }>, folderName: string): Promise<string | false> {
  const picker = (window as Window & { showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker
  if (!picker) return false
  const root = await picker()
  const output = await createUniqueOutputDirectory(root, folderName)
  for (const artifact of artifacts) {
    const parts = artifact.relativePath.split('/').filter(Boolean)
    let directory = output.handle
    for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part, { create: true })
    const handle = await directory.getFileHandle(parts.at(-1) ?? 'output', { create: true })
    const writable = await handle.createWritable()
    await writable.write(artifact.blob)
    await writable.close()
  }
  return output.name
}
