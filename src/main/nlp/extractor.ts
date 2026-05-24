import nlp from 'compromise'
import type { PageContent, RawTerm } from '../../types'

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'this', 'that', 'with', 'have', 'from',
  'they', 'will', 'your', 'all', 'not', 'but', 'was', 'can', 'had',
  'her', 'his', 'our', 'you', 'its', 'more', 'also', 'than', 'then',
  'when', 'what', 'which', 'how', 'who', 'where', 'been', 'being',
  'into', 'over', 'after', 'under', 'about', 'such', 'through', 'during',
  'before', 'between', 'each', 'other', 'both', 'few', 'those', 'these',
  'their', 'there', 'here', 'just', 'like', 'very', 'even', 'some',
  'only', 'same', 'well', 'make', 'take', 'get', 'use', 'see', 'give',
  'page', 'click', 'read', 'learn', 'find', 'view', 'home', 'menu',
  'privacy', 'policy', 'terms', 'copyright', 'rights', 'reserved',
])

export function extractRawTerms(pages: PageContent[]): RawTerm[] {
  // Weight headings 3x, meta descriptions 2x, body text 1x
  const headingText = pages
    .flatMap(p => [...p.h1s, ...p.h2s, ...p.h3s])
    .join('. ')

  const metaText = pages
    .map(p => p.metaDescription)
    .filter(Boolean)
    .join('. ')

  const bodyText = pages
    .map(p => p.bodyText)
    .join(' ')
    .slice(0, 60000)

  const combined =
    headingText + '. ' + headingText + '. ' + headingText + '. ' +
    metaText + '. ' + metaText + '. ' +
    bodyText

  const doc = nlp(combined)

  const freqMap = new Map<string, number>()

  const nouns = doc.nouns().out('array') as string[]
  for (const noun of nouns) {
    const clean = cleanTerm(noun)
    if (!clean) continue
    freqMap.set(clean, (freqMap.get(clean) ?? 0) + 1)
  }

  // Also capture proper nouns / organizations explicitly
  const orgs = doc.organizations().out('array') as string[]
  for (const org of orgs) {
    const clean = cleanTerm(org)
    if (!clean) continue
    freqMap.set(clean, (freqMap.get(clean) ?? 0) + 2)
  }

  const places = doc.places().out('array') as string[]
  for (const place of places) {
    const clean = cleanTerm(place)
    if (!clean) continue
    freqMap.set(clean, (freqMap.get(clean) ?? 0) + 2)
  }

  return Array.from(freqMap.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([term, count]) => ({ term, count }))
}

function cleanTerm(raw: string): string | null {
  const clean = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s&-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (clean.length < 3) return null

  const words = clean.split(' ')
  if (words.every(w => STOPWORDS.has(w))) return null
  if (words.length === 1 && STOPWORDS.has(words[0])) return null

  return clean
}
