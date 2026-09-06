import type { Session, Prompt } from '../../types'

export interface StoredCluster {
  id: string
  sessionId: string
  name: string
  terms: string[]
}

export interface Store {
  sessions: Session[]
  clusters: StoredCluster[]
  prompts: Prompt[]
}

export function emptyStore(): Store {
  return { sessions: [], clusters: [], prompts: [] }
}
