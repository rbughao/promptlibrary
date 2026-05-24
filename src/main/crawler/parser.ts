import * as cheerio from 'cheerio'
import type { PageContent } from '../../types'

export function parsePage(html: string, url: string): PageContent {
  const $ = cheerio.load(html)

  // Strip non-content elements
  $(
    'nav, footer, header, .cookie-banner, .cookie-notice, .cookie-bar, ' +
    '#cookie-banner, #cookie-notice, script, style, noscript, ' +
    '[aria-hidden="true"], .ads, .advertisement, .ad-banner, ' +
    '.social-share, .social-links, .sidebar, aside, .popup, .modal, ' +
    '.notification-bar, .alert-bar, .skip-link, [role="dialog"]'
  ).remove()

  const title = $('title').text().trim() || $('h1').first().text().trim() || url
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() ?? ''

  const h1s: string[] = []
  $('h1').each((_, el) => {
    const t = $(el).text().trim()
    if (t) h1s.push(t)
  })

  const h2s: string[] = []
  $('h2').each((_, el) => {
    const t = $(el).text().trim()
    if (t) h2s.push(t)
  })

  const h3s: string[] = []
  $('h3').each((_, el) => {
    const t = $(el).text().trim()
    if (t) h3s.push(t)
  })

  // Prefer main content area, fall back to body
  const mainSelector = 'main, [role="main"], article, .content, .main-content, #content, #main'
  const mainEl = $(mainSelector).first()
  const rawText = mainEl.length > 0 ? mainEl.text() : $('body').text()
  const bodyText = rawText.replace(/\s+/g, ' ').trim().slice(0, 15000)

  const internalLinks: string[] = []
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
    if (/\.(pdf|jpg|jpeg|png|gif|svg|webp|mp4|mp3|zip|doc|docx|xls|xlsx)$/i.test(href)) return
    internalLinks.push(href)
  })

  return { url, title, metaDescription, h1s, h2s, h3s, bodyText, internalLinks }
}
