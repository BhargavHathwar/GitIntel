# GitIntel — AI-Powered Repository Intelligence

A full-stack AI app that lets you paste any GitHub URL and instantly understand
the codebase through AI summaries, semantic search, architecture diagrams, and
conversational AI chat.

```
gitintel/
├── backend/          ← FastAPI (Python)
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/         ← React + Vite (JavaScript)
    ├── src/
    │   ├── App.jsx
    │   ├── main.jsx
    │   ├── index.css
    │   ├── api/
    │   │   └── backend.js        ← all API calls
    │   ├── utils/
    │   │   └── helpers.js        ← URL parser, stack detector, tree builder
    │   └── components/
    │       ├── UI.jsx            ← shared: Spinner, MD, Card, ErrorBanner
    │       ├── Header.jsx
    │       ├── Landing.jsx
    │       ├── RepoHeader.jsx
    │       ├── Overview.jsx
    │       ├── FileTree.jsx
    │       ├── SemanticSearch.jsx
    │       ├── AIChat.jsx
    │       ├── Architecture.jsx
    │       └── BugAnalysis.jsx
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## Prerequisites

| Tool    | Version  | Install |
|---------|----------|---------|
| Python  | 3.10+    | https://python.org |
| Node.js | 18+      | https://nodejs.org |
| pip     | latest   | comes with Python |

---

## 1 — Backend Setup

```bash
cd gitintel/backend

# Create and activate a virtual environment
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create your .env file
cp .env.example .env
```

Open `.env` and paste your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Get your key at: https://console.anthropic.com → API Keys

Start the backend:

```bash
uvicorn main:app --reload --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```

Test it: open http://localhost:8000/health — should return `{"status":"ok"}`.

---

## 2 — Frontend Setup

Open a **second terminal**:

```bash
cd gitintel/frontend

# Install dependencies
npm install

# Start the dev server
npm run dev
```

You should see:
```
VITE v5.x  ready in Xms
➜  Local:   http://localhost:5173/
```

Open http://localhost:5173 in your browser. Done!

---

## How the proxy works

Vite is configured to forward all `/api/*` requests to the backend:

```
Browser → http://localhost:5173/api/repo
         ↓ (Vite proxy)
Backend → http://localhost:8000/api/repo
```

This means **no CORS issues** and **your API key stays on the backend** — it
never touches the browser.

---

## GitHub Rate Limits

Unauthenticated GitHub API calls are limited to **60 requests/hour per IP**.
To increase this, generate a free Personal Access Token:

1. GitHub → Settings → Developer settings
2. Personal access tokens → Tokens (classic)
3. Generate new token (classic)
4. **Select no scopes** (public repos don't need any)
5. Copy and paste it into the token field in the app

---

## Features

| Feature | Description |
|---------|-------------|
| AI Summary | Streaming GPT-powered repo analysis |
| File Tree | Interactive collapsible directory browser |
| Semantic Search | Natural-language code location search |
| AI Chat | Full conversation with repo context |
| Architecture | Layered system diagram + AI insight |
| Bug Analysis | AI-powered quality & security scan |
| Language Bar | Visual breakdown like GitHub |
| Tech Stack | Auto-detects frameworks & tools |

---

## Production Build

```bash
# Build frontend static files
cd frontend
npm run build        # outputs to frontend/dist/

# Serve backend with gunicorn
cd backend
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

Then point your web server (Nginx, Caddy, etc.) to serve `frontend/dist/`
as static files and proxy `/api/` to port 8000.
