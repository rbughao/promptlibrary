import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import type { Session, Prompt, Cluster, SessionWithPrompts } from '../../types'
import { type Store, emptyStore } from './schema'

let store: Store = emptyStore()
let storePath = ''

export function initDb(): void {
  storePath = join(app.getPath('userData'), 'promptlibrary.json')
  if (existsSync(storePath)) {
    try {
      store = JSON.parse(readFileSync(storePath, 'utf-8')) as Store
    } catch {
      store = emptyStore()
    }
  }
}

function persist(): void {
  writeFileSync(storePath, JSON.stringify(store), 'utf-8')
}

export function saveSession(
  sessionData: { url: string; category: string },
  clusters: Cluster[],
  prompts: Array<{ text: string; cluster: string; trustWord: string; persona?: string }>
): { sessionId: string } {
  const sessionId = randomUUID()

  const session: Session = {
    id: sessionId,
    url: sessionData.url,
    category: sessionData.category,
    createdAt: Date.now(),
    pageCount: 0,
    promptCount: prompts.length,
  }

  store.sessions.push(session)

  for (const cluster of clusters) {
    store.clusters.push({ id: randomUUID(), sessionId, name: cluster.name, terms: cluster.terms })
  }

  for (const p of prompts) {
    store.prompts.push({
      id: randomUUID(),
      sessionId,
      text: p.text,
      cluster: p.cluster,
      trustWord: p.trustWord,
      persona: p.persona,
      tags: [],
      edited: false,
      deleted: false,
    })
  }

  persist()
  return { sessionId }
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
  persist()
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
  persist()
}
