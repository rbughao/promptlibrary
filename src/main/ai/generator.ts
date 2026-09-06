import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { extractRawTerms } from '../nlp/extractor'
import type { PageContent, Cluster, GenerateResult, PersonaDef, ProviderConfig, ProviderType } from '../../types'
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
  const parsed = parseJsonResponse(text)

  const clusters = (parsed.clusters as Cluster[] | undefined) ?? []
  let prompts = (parsed.prompts as GenerateResult['prompts'] | undefined) ?? []

  if (prompts.length < 50) {
    const extra = 50 - prompts.length
    try {
      const followText = await callLLM(
        config,
        SYSTEM_PROMPT,
        `Generate ${extra} more prompts using the same clusters. Return only: { "prompts": [...] }`,
        4096
      )
      const followParsed = parseJsonResponse(followText)
      if (Array.isArray(followParsed.prompts)) {
        prompts = [...prompts, ...followParsed.prompts]
      }
    } catch {
      // best effort
    }
  }

  return { clusters, prompts }
}

export async function applyPersonaFilter(
  basePrompts: Array<{ text: string; cluster: string; trustWord: string }>,
  personas: PersonaDef[],
  category: string,
  config: ProviderConfig
): Promise<GenerateResult['prompts']> {
  const results: GenerateResult['prompts'] = []

  for (const persona of personas) {
    const system = `You are an AI search optimization specialist. Rewrite customer questions to match a specific buyer persona. Maintain all trust words. Return ONLY valid JSON.`
    const user = `Industry: ${category}
Persona: ${persona.label} — ${persona.description}

Rewrite the following ${basePrompts.length} prompts to match this persona's language and priorities.
Keep cluster assignments. Each prompt must still contain a trust word from: ${TRUST_WORDS.join(', ')}

Original prompts:
${JSON.stringify(basePrompts, null, 2)}

Return ONLY: { "prompts": [{ "text": "...", "cluster": "...", "trustWord": "...", "persona": "${persona.id}" }] }`

    try {
      const text = await callLLM(config, system, user)
      const parsed = parseJsonResponse(text)
      if (Array.isArray(parsed.prompts)) {
        results.push(
          ...(parsed.prompts as Array<{ text: string; cluster: string; trustWord: string }>).map(
            (p) => ({ ...p, persona: persona.id, personaLabel: persona.label })
          )
        )
      }
    } catch {
      // skip on error
    }
  }

  return results
}

function parseJsonResponse(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0]) as Record<string, unknown>
    throw new Error('No valid JSON found in LLM response')
  }
}
