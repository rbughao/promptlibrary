export interface PageContent {
  url: string
  title: string
  metaDescription: string
  h1s: string[]
  h2s: string[]
  h3s: string[]
  bodyText: string
  internalLinks: string[]
}

export interface RawTerm {
  term: string
  count: number
}

export interface Cluster {
  name: string
  terms: string[]
}

export interface Prompt {
  id: string
  sessionId: string
  text: string
  cluster: string
  trustWord: string
  persona?: string
  tags: string[]
  edited: boolean
  deleted: boolean
}

export interface Session {
  id: string
  url: string
  category: string
  createdAt: number
  pageCount: number
  promptCount: number
}

export interface PersonaDef {
  id: string
  label: string
  description: string
}

export interface CrawlProgress {
  pagesVisited: number
  currentUrl: string
  status: 'crawling' | 'complete' | 'error'
  error?: string
}

export interface GenerateResult {
  clusters: Cluster[]
  prompts: Array<{
    text: string
    cluster: string
    trustWord: string
    persona?: string
  }>
}

export interface SessionWithPrompts extends Session {
  clusters: Cluster[]
  prompts: Prompt[]
}

// ── Provider system ──────────────────────────────────────────────────────────

export type ProviderType = 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'lmstudio' | 'custom'

export interface ProviderConfig {
  type: ProviderType
  apiKey: string
  baseUrl: string
  model: string
}

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
  ollama: 'Ollama — Local',
  lmstudio: 'LM Studio — Local',
  custom: 'Custom / OpenAI-compatible',
}

export const PROVIDER_MODELS: Record<ProviderType, string[]> = {
  anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini'],
  gemini: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  ollama: [],
  lmstudio: [],
  custom: [],
}

export const PROVIDER_DEFAULT_URLS: Partial<Record<ProviderType, string>> = {
  ollama: 'http://localhost:11434/v1',
  lmstudio: 'http://localhost:1234/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
}

export const PROVIDER_DEFAULT_MODELS: Record<ProviderType, string> = {
  anthropic: 'claude-opus-4-7',
  openai: 'gpt-4o',
  gemini: 'gemini-2.0-flash',
  ollama: 'llama3.2',
  lmstudio: '',
  custom: '',
}

export const PROVIDER_NEEDS_KEY: Record<ProviderType, boolean> = {
  anthropic: true,
  openai: true,
  gemini: true,
  ollama: false,
  lmstudio: false,
  custom: false,
}

export const PROVIDER_NEEDS_URL: Record<ProviderType, boolean> = {
  anthropic: false,
  openai: false,
  gemini: false,
  ollama: true,
  lmstudio: true,
  custom: true,
}

// ── Static data ──────────────────────────────────────────────────────────────

export const CATEGORIES = [
  'Hospitality',
  'Travel & Tourism',
  'Digital Marketing',
  'Airlines & Aviation',
  'Food & Beverage',
  'Real Estate',
  'Healthcare',
  'E-commerce & Retail',
  'Finance & Banking',
  'Education',
] as const

export const INDUSTRY_PERSONAS: Record<string, PersonaDef[]> = {
  'Hospitality': [
    { id: 'hosp-weekend', label: 'Weekend Guest', description: 'short leisure stay, seeking comfort and local experiences' },
    { id: 'hosp-business', label: 'Business Traveller', description: 'needs efficient check-in, reliable WiFi, and corporate amenities' },
    { id: 'hosp-family', label: 'Family Vacationer', description: 'wants kid-friendly rooms, pools, and family dining options' },
    { id: 'hosp-luxury', label: 'Luxury Seeker', description: 'desires premium experiences, spa, fine dining, and concierge service' },
    { id: 'hosp-budget', label: 'Budget Guest', description: 'price-sensitive, looks for deals, promotions, and best value' },
    { id: 'hosp-couple', label: 'Honeymoon Couple', description: 'wants romantic packages, privacy, and special personal touches' },
    { id: 'hosp-event', label: 'Event Planner', description: 'organising conferences, weddings, or corporate retreats' },
    { id: 'hosp-longstay', label: 'Long-Stay Guest', description: 'extended stays, needs home-like amenities and flexible rates' },
  ],
  'Travel & Tourism': [
    { id: 'tour-adventure', label: 'Adventure Traveller', description: 'seeks outdoor activities, trekking, and extreme sports' },
    { id: 'tour-culture', label: 'Cultural Explorer', description: 'interested in history, museums, and authentic local experiences' },
    { id: 'tour-backpacker', label: 'Solo Backpacker', description: 'budget travel, flexible itineraries, and social hostels' },
    { id: 'tour-luxury', label: 'Luxury Holidaymaker', description: '5-star resorts, private tours, and premium travel experiences' },
    { id: 'tour-family', label: 'Family Vacationer', description: 'child-friendly activities, safety, and convenience' },
    { id: 'tour-eco', label: 'Eco Tourist', description: 'sustainable travel, nature conservation, and responsible tourism' },
    { id: 'tour-cruise', label: 'Cruise Passenger', description: 'port excursions, onboard amenities, and group shore tours' },
    { id: 'tour-nomad', label: 'Digital Nomad', description: 'WiFi quality, co-working spaces, and long-stay flexibility' },
  ],
  'Digital Marketing': [
    { id: 'mktg-smb', label: 'Small Business Owner', description: 'wants local visibility, affordable tools, and clear ROI' },
    { id: 'mktg-ecom', label: 'E-commerce Manager', description: 'focused on conversion rates, ROAS, and product advertising' },
    { id: 'mktg-brand', label: 'Brand Strategist', description: 'concerned with brand awareness, storytelling, and positioning' },
    { id: 'mktg-content', label: 'Content Creator', description: 'needs SEO tools, content strategy, and social media growth' },
    { id: 'mktg-agency', label: 'Agency Marketer', description: 'managing multiple clients, reporting dashboards, and campaigns' },
    { id: 'mktg-startup', label: 'Startup Founder', description: 'bootstrapped, looking for growth hacks and lean strategies' },
    { id: 'mktg-analyst', label: 'Marketing Analyst', description: 'data-driven, attribution models, and performance metrics' },
    { id: 'mktg-b2b', label: 'B2B Marketer', description: 'lead generation, account-based marketing, and LinkedIn strategies' },
  ],
  'Airlines & Aviation': [
    { id: 'air-business', label: 'Frequent Business Flyer', description: 'lounge access, upgrades, miles, and flexible rebooking' },
    { id: 'air-budget', label: 'Budget Traveller', description: 'cheapest fares, no-frills, carry-on only' },
    { id: 'air-family', label: 'Family Traveller', description: 'extra baggage allowance, seat selection together, child meals' },
    { id: 'air-firsttime', label: 'First-Time Flyer', description: 'needs reassurance, clear step-by-step guidance, and travel tips' },
    { id: 'air-loyalty', label: 'Loyalty Member', description: 'maximising miles and points, status tier perks, partner benefits' },
    { id: 'air-longhaul', label: 'Long-Haul Traveller', description: 'comfort on long flights, lie-flat seats, in-flight entertainment' },
    { id: 'air-lastmin', label: 'Last-Minute Booker', description: 'flexible dates, last-minute deals, and quick self-check-in' },
    { id: 'air-access', label: 'Accessibility Traveller', description: 'wheelchair assistance, special meals, and medical support' },
  ],
  'Food & Beverage': [
    { id: 'fnb-finedine', label: 'Fine Dining Enthusiast', description: 'tasting menus, wine pairings, and Michelin-level experiences' },
    { id: 'fnb-health', label: 'Health-Conscious Diner', description: 'plant-based, organic options, and nutritional transparency' },
    { id: 'fnb-family', label: 'Family Diner', description: 'kids menu, casual atmosphere, and value family meals' },
    { id: 'fnb-foodie', label: 'Foodie Explorer', description: 'local cuisine, street food, and authentic cultural experiences' },
    { id: 'fnb-event', label: 'Corporate Event Planner', description: 'catering packages, private dining rooms, and group bookings' },
    { id: 'fnb-quick', label: 'Quick Service Customer', description: 'fast, convenient, and value meals on the go' },
    { id: 'fnb-dietary', label: 'Dietary-Restricted Diner', description: 'gluten-free, vegan, and allergen-aware menu options' },
    { id: 'fnb-homecook', label: 'Home Cook', description: 'premium ingredients, recipes, and cooking class experiences' },
  ],
  'Real Estate': [
    { id: 're-firstbuy', label: 'First-Time Buyer', description: 'needs guidance, mortgage tips, and neighbourhood reassurance' },
    { id: 're-investor', label: 'Property Investor', description: 'rental yield, capital growth potential, and market trends' },
    { id: 're-upsize', label: 'Upsizing Family', description: 'larger homes, good school zones, and suburban lifestyle' },
    { id: 're-downsize', label: 'Downsizer', description: 'smaller low-maintenance homes and retirement communities' },
    { id: 're-luxury', label: 'Luxury Buyer', description: 'premium locations, exclusive listings, and lifestyle amenities' },
    { id: 're-commercial', label: 'Commercial Seeker', description: 'office space, retail units, or industrial property' },
    { id: 're-renter', label: 'Renter', description: 'flexible leases, furnished options, and pet-friendly buildings' },
    { id: 're-developer', label: 'Property Developer', description: 'land acquisition, planning permissions, and development ROI' },
  ],
  'Healthcare': [
    { id: 'hc-patient', label: 'Patient Seeking Treatment', description: 'researching diagnosis, treatment options, and specialist referrals' },
    { id: 'hc-carer', label: 'Caregiver', description: 'managing care for an elderly or disabled family member' },
    { id: 'hc-wellness', label: 'Wellness Seeker', description: 'preventive care, fitness, nutrition, and mental health support' },
    { id: 'hc-chronic', label: 'Chronic Condition Manager', description: 'long-term treatment plans and medication management' },
    { id: 'hc-parent', label: 'New Parent', description: 'pediatric care, vaccinations, and child development guidance' },
    { id: 'hc-senior', label: 'Senior Patient', description: 'age-related conditions, mobility support, and geriatric care' },
    { id: 'hc-insurance', label: 'Insurance Shopper', description: 'comparing coverage options, costs, and provider networks' },
    { id: 'hc-pro', label: 'Medical Professional', description: 'clinical resources, CME credits, and research tools' },
  ],
  'E-commerce & Retail': [
    { id: 'ecom-deal', label: 'Deal Hunter', description: 'discounts, flash sales, coupon codes, and best-price guarantees' },
    { id: 'ecom-impulse', label: 'Impulse Buyer', description: 'trending products, limited editions, and curated recommendations' },
    { id: 'ecom-loyal', label: 'Loyal Customer', description: 'rewards program, personalised picks, and early access' },
    { id: 'ecom-eco', label: 'Sustainable Shopper', description: 'eco-friendly products, ethical brands, and low carbon footprint' },
    { id: 'ecom-gift', label: 'Gift Buyer', description: 'occasion-based shopping, gift sets, and personalisation options' },
    { id: 'ecom-bulk', label: 'Bulk Buyer', description: 'wholesale pricing, subscription options, and business accounts' },
    { id: 'ecom-careful', label: 'Cautious Shopper', description: 'reads reviews carefully, needs clear returns policy and size guides' },
    { id: 'ecom-tech', label: 'Tech Enthusiast', description: 'product specs, head-to-head comparisons, and latest releases' },
  ],
  'Finance & Banking': [
    { id: 'fin-newInv', label: 'First-Time Investor', description: 'getting started with low-risk options and basic financial concepts' },
    { id: 'fin-retire', label: 'Retirement Planner', description: 'pension strategies, long-term savings, and income planning' },
    { id: 'fin-mortgage', label: 'Home Loan Seeker', description: 'mortgage rates, refinancing options, and home equity' },
    { id: 'fin-smb', label: 'Small Business Owner', description: 'business accounts, working capital loans, and cash flow tools' },
    { id: 'fin-hnw', label: 'High-Net-Worth Individual', description: 'wealth management, private banking, and tax optimisation' },
    { id: 'fin-debt', label: 'Debt Manager', description: 'debt consolidation, credit repair, and financial recovery' },
    { id: 'fin-young', label: 'Young Saver', description: 'savings accounts, student banking, and building credit history' },
    { id: 'fin-expat', label: 'Expat / International', description: 'foreign exchange, international transfers, and multi-currency accounts' },
  ],
  'Education': [
    { id: 'edu-school', label: 'School-Age Student', description: 'tutoring, study resources, and exam preparation' },
    { id: 'edu-uni', label: 'University Student', description: 'degree programs, scholarships, and campus student life' },
    { id: 'edu-pro', label: 'Working Professional', description: 'upskilling, industry certifications, and online courses' },
    { id: 'edu-parent', label: 'Parent Researching Schools', description: 'curriculum quality, fees, extracurriculars, and safety' },
    { id: 'edu-career', label: 'Career Changer', description: 'retraining programs, bootcamps, and new career pathways' },
    { id: 'edu-intl', label: 'International Student', description: 'visa requirements, language courses, and accommodation support' },
    { id: 'edu-corp', label: 'Corporate Learner', description: 'employee training, team workshops, and leadership development' },
    { id: 'edu-lifelong', label: 'Lifelong Learner', description: 'hobby courses, personal enrichment, and cultural education' },
  ],
}

export const TRUST_WORDS = [
  'best', 'trusted', 'recommended', 'reliable', 'top-rated',
  'leading', 'safest', 'most affordable', 'most reputable',
]
