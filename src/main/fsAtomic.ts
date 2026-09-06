import { writeFileSync, renameSync, openSync, fsyncSync, closeSync } from 'fs'

/**
 * Replace a file's contents so that a crash can never leave it truncated.
 *
 * The data is written to a sibling temp file and flushed to disk, the previous
 * version is rotated to `<target>.bak`, then the temp file is renamed into
 * place. Rename is atomic on both NTFS and POSIX, so a reader only ever sees
 * the old file or the new one — never a half-written one, and the `.bak` copy
 * covers the brief window between the two renames.
 *
 * A plain writeFileSync truncates before writing, so losing power mid-write
 * destroyed the file — which for the session store meant every saved library.
 */
export function writeFileAtomicSync(target: string, data: string | Uint8Array): void {
  const tmp = `${target}.tmp`

  const fd = openSync(tmp, 'w')
  try {
    writeFileSync(fd, data)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }

  try {
    renameSync(target, `${target}.bak`)
  } catch {
    // No previous version — this is the first write.
  }
  renameSync(tmp, target)
}
