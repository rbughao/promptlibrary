import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { extractRawTerms } from '../nlp/extractor'
import type {
  PageContent, Cluster, GenerateResult, GenerateProgress,
  PersonaDef, ProviderConfig, ProviderType,
} from '../../types'
import { TRUST_WORDS, PROVIDER_DEFAULT_URLS, PROVIDER_MODELS } from '../../types'

// ── Low-level provider call ──────────────────────────────────────────────────

async function callLLM(
  config: ProviderConfig,
  system: string,
  user: string,
  maxTokens = 8192,
  timeoutMs = 300_000
): Promise<string> {
  if (config.type === 'anthropic') {
    const client = new Anthropic({ apiKey: config.apiKey, timeout: timeoutMs })
    const response = await client.messages.create({
      model: config.model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    })
    const block = response.content[0]
    return block.type === 'text' ? block.text : ''
  }

  const baseURL = config.baseUrl || PROVIDER_DEFAULT_URLS[config.type]
  const apiKey =
    config.apiKey ||
    (config.type === 'ollama' || config.type === 'lmstudio' ? 'not-required' : 'sk-placeholder')
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}), timeout: timeoutMs })

  const response = await client.chat.completions.create({
    model: config.model,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  })
  return response.choices[0]?.message?.content ?? ''
}

// ── List available models ─────────────────────────────────────────────────────

export async function listModels(cfg: {
  type: ProviderType
  apiKey: string
  baseUrl: string
}): Promise<string[]> {
  if (cfg.type === 'anthropic') {
    if (!cfg.apiKey) return [...PROVIDER_MODELS.anthropic]
    const client = new Anthropic({ apiKey: cfg.apiKey })
    const page = await client.models.list({ limit: 100 })
    const ids = page.data.map((m) => m.id).sort()
    return ids.length > 0 ? ids : [...PROVIDER_MODELS.anthropic]
  }

  const baseURL = cfg.baseUrl || PROVIDER_DEFAULT_URLS[cfg.type]
  const apiKey =
    cfg.apiKey || (cfg.type === 'ollama' || cfg.type === 'lmstudio' ? 'not-required' : cfg.apiKey)

  if (!baseURL && !apiKey) return []

  const client = new OpenAI({ apiKey: apiKey || 'sk-placeholder', ...(baseURL ? { baseURL } : {}), timeout: 10_000 })
  try {
    const result = await client.models.list()
    return result.data.map((m) => m.id).sort()
  } catch (err) {
    // Custom / local servers often don't implement GET /models — return empty so
    // the caller falls back to letting the user type the model name manually.
    if (cfg.type === 'custom' || cfg.type === 'ollama' || cfg.type === 'lmstudio') return []
    throw err
  }
}

// ── Test connection ───────────────────────────────────────────────────────────

export interface TestResult {
  success: boolean
  latencyMs: number
  model: string
  response?: string
  error?: string
}

export async function testConnection(config: ProviderConfig): Promise<TestResult> {
  const start = Date.now()
  try {
    const text = await callLLM(
      config,
      'You are a helpful assistant.',
      'Reply with exactly one word: OK',
      20,
      60_000
    )
    return {
      success: true,
      latencyMs: Date.now() - start,
      model: config.model,
      response: text.trim().slice(0, 80),
    }
  } catch (err) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      model: config.model,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── Prompt generation ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an AI search optimization specialist. Your job is to generate realistic questions that real customers type into AI assistants (ChatGPT, Claude, Gemini) when researching businesses.

Rules:
1. Every prompt must sound like a natural customer question — conversational, not a keyword query
2. Every prompt MUST contain at least one of these trust/intent words: ${TRUST_WORDS.join(', ')}
3. Prompts must reflect the actual services, products, and language found on the website content provided
4. Generate a minimum of 50 prompts total, spread across all clusters
5. Group prompts into 4–8 meaningful topic clusters
6. Return ONLY valid JSON — no markdown, no explanation`

export async function generatePrompts(
  pages: PageContent[],
  category: string,
  config: ProviderConfig
): Promise<GenerateResult> {
  const terms = extractRawTerms(pages)

  const pagesSummary = pages.slice(0, 12).map((p) => ({
    url: p.url,
    title: p.title,
    meta: p.metaDescription,
    headings: [...p.h1s, ...p.h2s.slice(0, 4), ...p.h3s.slice(0, 4)],
  }))

  const userPrompt = `Website industry: ${category}

Pages analyzed from the website:
${JSON.stringify(pagesSummary, null, 2)}

Top terms extracted from page content (term: frequency):
${terms.map((t) => `${t.term}: ${t.count}`).join('\n')}

Generate a prompt library using the EXACT JSON structure below. Do not add any text outside the JSON.

{
  "clusters": [
    { "name": "Cluster Name", "terms": ["term1", "term2", "term3"] }
  ],
  "prompts": [
    { "text": "What is the best ...", "cluster": "Cluster Name", "trustWord": "best" }
  ]
}

Requirements:
- At least 50 prompts total (minimum 6 per cluster)
- Each prompt reflects real offerings from this specific website
- Trust words to use: ${TRUST_WORDS.join(', ')}
- Vary question styles: comparisons, recommendations, "where to find", how-to, etc.`

  const text = await callLLM(config, SYSTEM_PROMPT, userPrompt)

  let clusters: Cluster[] = []
  let prompts: GenerateResult['prompts'] = []

  try {
    const parsed = parseJsonResponse(text)
    clusters = (parsed.clusters as Cluster[] | undefined) ?? []
    const list = parsed.prompts
    if (Array.isArray(list)) {
      prompts = (list as Array<Record<string, unknown>>)
        .filter(isPromptLike)
        .map((o) => toPrompt(o, 'General'))
    }
  } catch {
    // Truncated or non-JSON — salvage what was emitted below.
  }

  if (prompts.length === 0 || clusters.length === 0) {
    const salvaged = extractObjects(text)
    if (prompts.length === 0) {
      prompts = salvaged.filter(isPromptLike).map((o) => toPrompt(o, 'General'))
    }
    if (clusters.length === 0) {
      clusters = salvaged
        .filter((o) => typeof o.name === 'string' && Array.isArray(o.terms))
        .map((o) => ({ name: String(o.name), terms: (o.terms as unknown[]).map(String) }))
    }
  }

  if (prompts.length === 0) {
    throw new Error(
      'The model returned no usable prompts. It likely ran out of output tokens — ' +
      'try a model with a larger output limit, or one better at following JSON instructions.'
    )
  }

  // Clusters are only used for storage and export; if the model omitted them
  // (or they were cut off), rebuild the list from the prompts themselves.
  if (clusters.length === 0) {
    clusters = Array.from(new Set(prompts.map((p) => p.cluster))).map((name) => ({
      name,
      terms: [],
    }))
  }

  if (prompts.length < 50) {
    const extra = 50 - prompts.length
    const clusterNames = clusters.map((c) => c.name).join(', ')
    try {
      const followText = await callLLM(
        config,
        SYSTEM_PROMPT,
        `Generate ${extra} more prompts using these existing clusters: ${clusterNames}.\n` +
        `Do not repeat any of these existing prompts:\n${prompts.map((p) => `- ${p.text}`).join('\n')}\n\n` +
        `Return only: { "prompts": [{ "text": "...", "cluster": "...", "trustWord": "..." }] }`,
        4096
      )
      prompts = [...prompts, ...recoverPrompts(followText, clusters[0]?.name ?? 'General')]
    } catch {
      // best effort — the first batch already gave us a usable library
    }
  }

  return { clusters, prompts }
}

/**
 * Prompts sent per persona call. Asking a model to rewrite all 50+ prompts in
 * one response reliably overruns the output limit on smaller local models —
 * which used to silently discard the whole persona.
 */
const PERSONA_BATCH_SIZE = 12
/** A batch this small is not worth splitting again. */
const MIN_BATCH_SIZE = 4

export interface PersonaFilterResult {
  prompts: GenerateResult['prompts']
  /** Non-fatal problems worth showing the user (a persona or batch that failed). */
  warnings: string[]
}

async function rewriteBatch(
  items: RawPrompt[],
  persona: PersonaDef,
  category: string,
  config: ProviderConfig
): Promise<RawPrompt[]> {
  const system =
    'You are an AI search optimization specialist. Rewrite customer questions to ' +
    'match a specific buyer persona. Maintain all trust words. Return ONLY valid JSON.'

  const user = `Industry: ${category}
Persona: ${persona.label} — ${persona.description}

Rewrite each of the following ${items.length} prompts to match this persona's language and priorities.
Keep each prompt's cluster. Every prompt must still contain a trust word from: ${TRUST_WORDS.join(', ')}

Original prompts:
${JSON.stringify(items, null, 2)}

Return ONLY this JSON, containing exactly ${items.length} entries:
{ "prompts": [{ "text": "...", "cluster": "...", "trustWord": "..." }] }`

  // Sized to the batch rather than a flat 8192 — smaller ceilings finish faster
  // and leave far less room for a truncated response.
  const maxTokens = Math.max(1024, items.length * 120)
  const text = await callLLM(config, system, user, maxTokens)
  return recoverPrompts(text, items[0]?.cluster ?? 'General')
}

export async function applyPersonaFilter(
  basePrompts: RawPrompt[],
  personas: PersonaDef[],
  category: string,
  config: ProviderConfig,
  onProgress?: (p: GenerateProgress) => void
): Promise<PersonaFilterResult> {
  const results: GenerateResult['prompts'] = []
  const warnings: string[] = []

  for (const [personaIndex, persona] of personas.entries()) {
    // A work queue rather than a plain loop: a batch that comes back empty is
    // split in half and requeued once, since the usual cause is output length.
    const queue: Array<{ items: RawPrompt[]; retried: boolean }> = []
    for (let i = 0; i < basePrompts.length; i += PERSONA_BATCH_SIZE) {
      queue.push({ items: basePrompts.slice(i, i + PERSONA_BATCH_SIZE), retried: false })
    }

    let produced = 0
    let dropped = 0
    let done = 0
    let lastError = ''

    while (queue.length > 0) {
      const batch = queue.shift()!

      onProgress?.({
        stage: 'persona',
        personaLabel: persona.label,
        personaIndex: personaIndex + 1,
        personaTotal: personas.length,
        batchIndex: done + 1,
        batchTotal: done + queue.length + 1,
      })

      let rewritten: RawPrompt[] = []
      try {
        rewritten = await rewriteBatch(batch.items, persona, category, config)
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
      }

      if (rewritten.length === 0) {
        if (!batch.retried && batch.items.length > MIN_BATCH_SIZE) {
          const mid = Math.ceil(batch.items.length / 2)
          queue.unshift(
            { items: batch.items.slice(0, mid), retried: true },
            { items: batch.items.slice(mid), retried: true }
          )
          continue
        }
        dropped += batch.items.length
      } else {
        results.push(
          ...rewritten.map((p) => ({
            ...p,
            persona: persona.id,
            personaLabel: persona.label,
          }))
        )
        produced += rewritten.length
      }

      done++
    }

    if (produced === 0) {
      warnings.push(
        `${persona.label}: no prompts were generated${lastError ? ` — ${lastError}` : '.'}`
      )
    } else if (dropped > 0) {
      warnings.push(
        `${persona.label}: ${dropped} of ${basePrompts.length} prompts could not be rewritten.`
      )
    }
  }

  return { prompts: results, warnings }
}

// ── Response parsing ─────────────────────────────────────────────────────────

/** Remove ```json fences and any prose the model wrapped around the JSON. */
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  return (fenced ? fenced[1] : text).trim()
}

function parseJsonResponse(text: string): Record<string, unknown> {
  const cleaned = stripFences(text)
  try {
    return JSON.parse(cleaned) as Record<string, unknown>
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as Record<string, unknown>
    throw new Error('No valid JSON found in LLM response')
  }
}

/**
 * Recover every complete `{...}` object in a string, at any nesting depth.
 *
 * Small local models routinely stop mid-array when they hit their output token
 * limit, which makes the document as a whole invalid JSON — the previous code
 * threw the entire response away. Scanning for balanced brace pairs salvages
 * every object that was fully emitted before the cut, so a truncated batch
 * still yields most of its prompts instead of none.
 */
function extractObjects(text: string): Array<Record<string, unknown>> {
  const found: Array<Record<string, unknown>> = []
  const stack: number[] = []
  let inString = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      if (inString) escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (ch === '{') {
      stack.push(i)
    } else if (ch === '}' && stack.length > 0) {
      const start = stack.pop()!
      try {
        found.push(JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>)
      } catch {
        // Not valid on its own — an outer wrapper whose tail was cut off.
      }
    }
  }

  return found
}

type RawPrompt = { text: string; cluster: string; trustWord: string }

function isPromptLike(o: Record<string, unknown>): boolean {
  return typeof o.text === 'string' && o.text.trim().length > 0
}

function toPrompt(o: Record<string, unknown>, fallbackCluster: string): RawPrompt {
  return {
    text: String(o.text).trim(),
    cluster:
      typeof o.cluster === 'string' && o.cluster.trim() ? o.cluster.trim() : fallbackCluster,
    trustWord: typeof o.trustWord === 'string' ? o.trustWord.trim() : '',
  }
}

/** Parse a `{ prompts: [...] }` response, falling back to object salvage. */
function recoverPrompts(text: string, fallbackCluster: string): RawPrompt[] {
  try {
    const parsed = parseJsonResponse(text)
    const list = Array.isArray(parsed) ? parsed : parsed.prompts
    if (Array.isArray(list)) {
      const usable = (list as Array<Record<string, unknown>>).filter(isPromptLike)
      if (usable.length > 0) return usable.map((o) => toPrompt(o, fallbackCluster))
    }
  } catch {
    // fall through to salvage
  }
  return extractObjects(text)
    .filter(isPromptLike)
    .map((o) => toPrompt(o, fallbackCluster))
}
