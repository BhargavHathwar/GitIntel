# GitIntel — AI-Powered Repository Intelligence

A full-stack AI developer tool: paste any public GitHub URL and instantly
understand the codebase through AI summaries, semantic search, architecture
diagrams, and conversational chat.

**AI provider:** Google Gemini (`gemini-2.0-flash`)  
**Stack:** FastAPI (Python) backend · React + Vite frontend  
**Design:** GitHub-modern dark · Hanken Grotesk · JetBrains Mono · Material Symbols

---

Live : https://git-intel-tau.vercel.app/

## Project Structure

```
gitintel/
├── .gitignore
├── README.md
├── backend/
│   ├── main.py              ← FastAPI: GitHub fetch, Gemini stream/complete, CORS
│   ├── requirements.txt
│   └── .env.example         ← copy → .env, add your GEMINI_API_KEY
└── frontend/
    ├── index.html           ← Tailwind CDN, Google Fonts, Material Symbols
    ├── vite.config.js       ← Dev proxy: /api/* → localhost:8000
    ├── package.json
    └── src/
        ├── main.jsx
        ├── App.jsx          ← Full UI: Landing, Dashboard, Sidebar, all tabs
        ├── api/
        │   └── backend.js   ← fetchRepo / streamAI / completeAI
        └── utils/
            └── helpers.js   ← URL parser, stack detector, tree builder
```

---

## Quick Start

### Prerequisites

| Tool    | Version | Install              |
|---------|---------|----------------------|
| Python  | 3.10+   | https://python.org   |
| Node.js | 18+     | https://nodejs.org   |

---

### Step 1 — Get your Gemini API key (free)

1. Go to **https://aistudio.google.com/apikey**
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key — it looks like `AIzaSy_xxxxxxxxxxxxxxxxxxxxxxx`

---

### Step 2 — Backend

```bash
cd gitintel/backend

# Create and activate virtual environment
python -m venv venv

# macOS / Linux:
source venv/bin/activate

# Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp .env.example .env
```

Open `.env` and paste your key:

```
GEMINI_API_KEY=AIzaSy_xxxxxxxxxxxxxxxxxxxxxxx
```

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

Confirm: http://localhost:8000/health → `{"status":"ok","model":"gemini-2.0-flash"}`

---

### Step 3 — Frontend

Open a **second terminal**:

```bash
cd gitintel/frontend

npm install
npm run dev
```

Open **http://localhost:5173**

---

## How it works

```
Browser (localhost:5173)
  └─ /api/*  ──→  Vite proxy  ──→  FastAPI (localhost:8000)
                                        ├─ GitHub API     (repo metadata, tree, readme)
                                        └─ Gemini API     (AI summaries, chat, search)
```

- Your **Gemini API key stays in the backend `.env`** — never exposed to the browser
- GitHub data is fetched server-side, avoiding CORS issues
- Streaming responses use Gemini's `streamGenerateContent` SSE endpoint,
  normalised to a simple `{delta:{text}}` format for the frontend

---

## GitHub Rate Limits

Unauthenticated: **60 req/hr**. To increase to 5 000/hr:

1. GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. Generate new token — **select no scopes** (public repos need none)
4. Paste into the token field in the app UI

---

## Features

| Tab | Feature |
|-----|---------|
| AI Overview | Streaming Gemini analysis: purpose, architecture, tech choices, quality |
| File Explorer | Collapsible tree browser with language-colour dots |
| Semantic Search | Natural-language code-location search via Gemini |
| AI Chat | Full multi-turn conversation scoped to repo context |
| Architecture | Layered system diagram + AI architectural description |
| Code Analysis | Bug detection, security scan, maintainability score |

---

## Gemini Model

The backend uses **`gemini-2.0-flash`** by default — it's fast, has a large
context window (great for code), and is free under the generous Google AI
Studio quota.

To switch models, edit `GEMINI_MODEL` in `backend/main.py`:

```python
GEMINI_MODEL = "gemini-2.0-flash"        # default — fast, free tier
GEMINI_MODEL = "gemini-2.5-flash"        # smarter, still fast
GEMINI_MODEL = "gemini-2.5-pro"          # most capable
```

---

## Production Build

```bash
# Build frontend static files
cd frontend && npm run build   # → frontend/dist/

# Run backend with gunicorn
cd backend
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

Serve `frontend/dist/` as static files and proxy `/api/` to port 8000
via Nginx or Caddy.
