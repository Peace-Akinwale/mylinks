# MyLinks — AI Internal Linking Assistant

MyLinks is an SEO tool that helps content teams build internal links intelligently. You crawl your site, upload a draft article, and get AI-generated link suggestions with exact anchor positions — which you can review and apply directly back to your Google Doc.

---

## How It Works

### 1. Create a Project
Add your domain (and optionally a custom sitemap URL). MyLinks discovers your sitemap automatically via `robots.txt` or common paths (`/sitemap.xml`, `/wp-sitemap.xml`, etc.).

### 2. Crawl Your Site
Kick off a crawl and MyLinks:
- Parses your sitemap (including nested sitemap indexes)
- Fetches each page and extracts: title, meta description, H1, H2s, word count, published date, and page type
- Scores each page by priority (homepage > blog post > service/product > category > other)
- Streams progress to your browser in real time via SSE

### 3. Upload an Article
Paste your draft or connect a Google Doc. MyLinks stores the raw text for analysis.

### 4. Generate AI Suggestions
MyLinks sends your draft + top 200 pages (by priority, filtered to last 4 years) to **Google Gemini 2.5 Flash**. Gemini returns 8–15 link suggestions, each with:
- Target URL and anchor text (verbatim match in your draft)
- Exact character positions (`char_start`, `char_end`)
- Relevance score (0.0–1.0, minimum 0.6 to show)
- Confidence level (high / medium / low)
- Justification for why the link adds value

All positions are validated — if Gemini gets the index wrong, MyLinks auto-corrects by searching the draft text.

### 5. Review Suggestions
Split-panel UI: your article on the left with highlighted anchors, suggestion cards on the right. Click an anchor → jumps to the card. Click a card → jumps to the anchor. Approve or reject each one.

### 6. Apply to Google Doc
Once approved, MyLinks maps character positions to Google Doc indices and uses the **Google Docs API `batchUpdate`** to insert the links directly — no copy-pasting.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (magic link) + Google OAuth |
| AI | Google Gemini 2.5 Flash (structured JSON output) |
| Crawling | Cheerio (HTML parsing), xml2js (sitemap parsing) |
| Google Docs | Google Docs API + Google Drive API |
| Deployment | Vercel |

---

## Database Schema

| Table | Purpose |
|---|---|
| `projects` | User projects, each tied to a domain |
| `pages` | Crawled page inventory (title, H1s, type, priority, published date) |
| `articles` | Draft articles (paste or Google Doc) |
| `suggestions` | AI-generated link suggestions with position data |
| `google_tokens` | OAuth tokens for Google Docs access |
| `crawl_logs` | Crawl history and status |

All tables use RLS — users only see their own data.

---

## Local Setup

### Prerequisites
- Node.js 18+
- A Supabase project
- A Google Cloud project with Docs API + OAuth enabled
- A Gemini API key

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

GEMINI_API_KEY=your_gemini_api_key

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Database

Apply the migrations in `supabase/` to your Supabase project:

```bash
supabase db push
```

---

## Key Design Decisions

- **Structured LLM output** — Gemini's `responseSchema` enforces JSON structure, removing the need for prompt-hacking or post-processing.
- **Character-level precision** — Suggestions store exact `char_start/char_end` positions in the draft, enabling reliable anchor highlighting and Google Doc index mapping.
- **Priority-weighted inventory** — Only the top 200 pages by type + recency go into the prompt, keeping token usage predictable and suggestions relevant.
- **Streaming crawls** — Sitemap crawling uses server-sent events so large sites don't time out the browser.
- **RLS-first multi-tenancy** — Access control is enforced at the database level, not just in API logic.
