# Prompt Library Builder

A cross-platform desktop application that crawls any website, extracts topics via NLP, and uses AI to generate a curated library of 50+ customer questions optimised for AI search discovery (ChatGPT, Claude, Gemini).

Built for marketers and businesses who want to understand how potential customers might discover them through AI assistants.

![Prompt Library Builder](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

---

## Features

- **Website Crawler** — BFS crawl up to 25 pages (depth 3), strips nav/footer noise, extracts structured content
- **NLP Extraction** — Uses compromise.js to extract noun phrases, entities, and service terms from crawled content
- **AI Prompt Generation** — Calls your configured LLM to generate 50+ realistic customer questions grouped into 4–8 topic clusters
- **Industry-Specific Personas** — 8 pre-built buyer personas per industry category; persona filter rewrites prompts in each persona's voice
- **Custom Personas** — Add your own persona with a label and the AI adapts all prompts to that audience
- **Multi-Provider LLM Support** — Anthropic (Claude), OpenAI, Google Gemini, Ollama, LM Studio, or any OpenAI-compatible endpoint
- **Prompt Library** — Sortable/filterable table with inline editing, tagging, and soft-delete
- **Session History** — All sessions persisted locally on disk; reload any past library instantly
- **Export** — CSV, JSON, plain text, or copy all to clipboard

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 33 |
| Build tool | electron-vite |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS v4 |
| State | Zustand |
| Web crawling | Cheerio + undici |
| NLP | compromise.js |
| AI | Anthropic SDK + OpenAI SDK |
| Storage | JSON document store in Electron `userData` |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm 10+

### Install & Run

```bash
git clone https://github.com/rbughao/promptlibrary.git
cd promptlibrary
npm install
npm run dev
```

### Build Distributables

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

---

## LLM Configuration

On first launch, the Settings modal opens automatically. Configure any of the supported providers:

| Provider | Requires API Key | Requires Base URL |
|---|---|---|
| Anthropic (Claude) | Yes | No |
| OpenAI | Yes | No |
| Google Gemini | Yes | No |
| Ollama | No | Yes (default: `http://localhost:11434/v1`) |
| LM Studio | No | Yes (default: `http://localhost:1234/v1`) |
| Custom / OpenAI-compatible | Optional | Yes |

The provider status badge in the top-right corner shows green when the LLM is ready to use.

---

## How It Works

1. **Enter a URL** — paste any website URL and select an industry category
2. **Select Personas** *(optional)* — choose industry-specific personas or add your own; prompts will be rewritten to match each persona's language and priorities
3. **Analyze & Generate** — the app crawls the site, extracts topics, and calls your configured LLM to generate the prompt library
4. **Browse & Filter** — filter by cluster, persona, trust word, or free-text search
5. **Export** — download as CSV / JSON / TXT or copy all to clipboard

---

## Project Structure

```
src/
├── main/
│   ├── index.ts              # Main process entry
│   ├── ipc/                  # IPC handlers (crawl, generate, db, settings)
│   ├── crawler/              # BFS crawler + Cheerio parser
│   ├── nlp/                  # compromise.js term extractor
│   ├── ai/                   # LLM generator (prompts + persona filter)
│   └── db/                   # Local JSON store (sessions, clusters, prompts)
├── preload/
│   └── index.ts              # contextBridge API bridge
└── renderer/src/
    ├── App.tsx               # Root component + nav
    ├── store/useStore.ts     # Zustand global state
    ├── pages/
    │   ├── Setup.tsx         # URL input, category, personas, crawl trigger
    │   ├── Library.tsx       # Prompt table with filter + export
    │   └── History.tsx       # Saved sessions browser
    └── components/
        ├── CrawlProgress.tsx
        ├── PromptRow.tsx
        ├── ExportPanel.tsx
        └── SettingsModal.tsx
```

---

## Industry Categories & Personas

The app ships with 10 industry categories, each with 8 tailored buyer personas:

- **Hospitality** — Weekend Guest, Business Traveller, Family Vacationer, Luxury Seeker, Budget Guest, Honeymoon Couple, Event Planner, Long-Stay Guest
- **Travel & Tourism** — Adventure Traveller, Cultural Explorer, Solo Backpacker, Luxury Holidaymaker, Family Vacationer, Eco Tourist, Cruise Passenger, Digital Nomad
- **Digital Marketing** — Small Business Owner, E-commerce Manager, Brand Strategist, Content Creator, Agency Marketer, Startup Founder, Marketing Analyst, B2B Marketer
- **Airlines & Aviation** — Frequent Business Flyer, Budget Traveller, Family Traveller, First-Time Flyer, Loyalty Member, Long-Haul Traveller, Last-Minute Booker, Accessibility Traveller
- **Food & Beverage** — Fine Dining Enthusiast, Health-Conscious Diner, Family Diner, Foodie Explorer, Corporate Event Planner, Quick Service Customer, Dietary-Restricted Diner, Home Cook
- **Real Estate** — First-Time Buyer, Property Investor, Upsizing Family, Downsizer, Luxury Buyer, Commercial Seeker, Renter, Property Developer
- **Healthcare** — Patient Seeking Treatment, Caregiver, Wellness Seeker, Chronic Condition Manager, New Parent, Senior Patient, Insurance Shopper, Medical Professional
- **E-commerce & Retail** — Deal Hunter, Impulse Buyer, Loyal Customer, Sustainable Shopper, Gift Buyer, Bulk Buyer, Cautious Shopper, Tech Enthusiast
- **Finance & Banking** — First-Time Investor, Retirement Planner, Home Loan Seeker, Small Business Owner, High-Net-Worth Individual, Debt Manager, Young Saver, Expat/International
- **Education** — School-Age Student, University Student, Working Professional, Parent Researching Schools, Career Changer, International Student, Corporate Learner, Lifelong Learner

Custom industries show only the "Add new persona…" option — type any persona label and the AI adapts.

---

## License

MIT

---

Developed by [Rowel Bughao](https://github.com/rbughao)
