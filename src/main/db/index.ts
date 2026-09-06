import { app } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync, renameSync } from 'fs'
import { randomUUID } from 'crypto'
import type { Session, Prompt, Cluster, SessionWithPrompts } from '../../types'
import { type Store, emptyStore } from './schema'
import { writeFileAtomicSync } from '../fsAtomic'

/**
 * Rapid edits — tagging or retyping several prompts — used to rewrite the
 * entire store on every keystroke-sized change. Coalescing them into one write
 * is what keeps the main process responsive; the write itself stays
 * synchronous so it can never be reordered against the flush on exit.
 */
const FLUSH_DELAY_MS = 250

let store: Store = emptyStore()
let storePath = ''

let dirty = false
let flushTimer: NodeJS.Timeout | null = null

// ── Loading ──────────────────────────────────────────────────────────────────

function isStore(value: unknown): value is Store {
  const s = value as Store
  return (
    !!s &&
    typeof s === 'object' &&
    Array.isArray(s.sessions) &&
    Array.isArray(s.clusters) &&
    Array.isArray(s.prompts)
  )
}

function readStore(path: string): Store | null {
  try {
    if (!existsSync(path)) return null
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    return isStore(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function initDb(): void {
  storePath = join(app.getPath('userData'), 'promptlibrary.json')

  // Fall back to the rotated backup if the main file is missing or unreadable —
  // it is written one version behind, so at worst the last edit is lost.
  const loaded = readStore(storePath) ?? readStore(`${storePath}.bak`)
  if (loaded) {
    store = loaded
    return
  }

  // Something exists but cannot be read. Move it aside rather than overwriting
  // it on the next save, so the user's data stays recoverable.
  if (existsSync(storePath)) {
    const quarantine = `${storePath}.corrupt-${Date.now()}`
    try {
      renameSync(storePath, quarantine)
      console.error(`[db] store was unreadable; preserved at ${quarantine}`)
    } catch (err) {
      console.error('[db] store was unreadable and could not be preserved:', err)
    }
  }

  store = emptyStore()
}

// ── Writing ──────────────────────────────────────────────────────────────────

function cancelPendingFlush(): void {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
}

/** Write any pending changes. Safe to call at any time, including on exit. */
export function flushDbSync(): void {
  cancelPendingFlush()
  if (!dirty || !storePath) return

  try {
    writeFileAtomicSync(storePath, JSON.stringify(store))
    dirty = false
  } catch (err) {
    // Stay dirty so the next flush retries rather than dropping the change.
    console.error('[db] failed to persist store:', err)
  }
}

/** Mark the store changed and schedule a coalesced write. */
function persist(immediate = false): void {
  dirty = true

  if (immediate) {
    flushDbSync()
    return
  }

  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    flushDbSync()
  }, FLUSH_DELAY_MS)
}

// ── Records ──────────────────────────────────────────────────────────────────

type NewPrompt = {
  text: string
  cluster: string
  trustWord: string
  persona?: string
  personaLabel?: string
}

function toRecord(sessionId: string, p: NewPrompt): Prompt {
  return {
    id: randomUUID(),
    sessionId,
    text: p.text,
    cluster: p.cluster,
    trustWord: p.trustWord,
    persona: p.persona,
    personaLabel: p.personaLabel,
    tags: [],
    edited: false,
    deleted: false,
  }
}

export function saveSession(
  sessionData: { url: string; category: string; pageCount?: number },
  clusters: Cluster[],
  prompts: NewPrompt[]
): { sessionId: string } {
  const sessionId = randomUUID()

  const session: Session = {
    id: sessionId,
    url: sessionData.url,
    category: sessionData.category,
    createdAt: Date.now(),
    pageCount: sessionData.pageCount ?? 0,
    promptCount: prompts.length,
  }

  store.sessions.push(session)

  for (const cluster of clusters) {
    store.clusters.push({ id: randomUUID(), sessionId, name: cluster.name, terms: cluster.terms })
  }

  for (const p of prompts) {
    store.prompts.push(toRecord(sessionId, p))
  }

  // A whole generated library is expensive to reproduce — write it out now.
  persist(true)
  return { sessionId }
}

/**
 * Add prompts to an existing session. Used when personas are applied after the
 * initial generation — saveSession would mint a new session id and orphan them.
 */
export function appendPrompts(
  sessionId: string,
  prompts: NewPrompt[]
): { success: boolean; added: number } {
  const session = store.sessions.find((s) => s.id === sessionId)
  if (!session) return { success: false, added: 0 }

  for (const p of prompts) {
    store.prompts.push(toRecord(sessionId, p))
  }

  session.promptCount = store.prompts.filter((p) => p.sessionId === sessionId).length

  persist(true)
  return { success: true, added: prompts.length }
}

export function loadSession(sessionId: string): SessionWithPrompts | null {
  const session = store.sessions.find((s) => s.id === sessionId)
  if (!session) return null

  const clusters = store.clusters
    .filter((c) => c.sessionId === sessionId)
    .map((c) => ({ name: c.name, terms: c.terms }))

  const prompts = store.prompts.filter((p) => p.sessionId === sessionId)

  return { ...session, clusters, prompts }
}

export function listSessions(): Session[] {
  return [...store.sessions].reverse()
}

export function deleteSession(sessionId: string): void {
  store.sessions = store.sessions.filter((s) => s.id !== sessionId)
  store.clusters = store.clusters.filter((c) => c.sessionId !== sessionId)
  store.prompts = store.prompts.filter((p) => p.sessionId !== sessionId)
  persist(true)
}

export function updatePromptRecord(
  promptId: string,
  changes: { text?: string; tags?: string[]; deleted?: boolean }
): void {
  const prompt = store.prompts.find((p) => p.id === promptId)
  if (!prompt) return

  if (changes.text !== undefined) {
    prompt.text = changes.text
    prompt.edited = true
  }
  if (changes.tags !== undefined) prompt.tags = changes.tags
  if (changes.deleted !== undefined) prompt.deleted = changes.deleted

  // Frequent and individually cheap — let these coalesce.
  persist()
}
