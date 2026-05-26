from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import os
import json
import asyncio
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="GitIntel API", version="1.0.0")

# ── CORS — allows the React dev server to talk to this backend ──────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_URL     = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL   = "claude-sonnet-4-20250514"
GITHUB_API        = "https://api.github.com"


# ═══════════════════════════════════════════════════════════════════════════
#  Request / Response models
# ═══════════════════════════════════════════════════════════════════════════

class RepoRequest(BaseModel):
    owner: str
    repo:  str
    token: Optional[str] = None   # optional GitHub PAT from the user

class AIRequest(BaseModel):
    system:     str
    prompt:     str
    max_tokens: Optional[int] = 1200


# ═══════════════════════════════════════════════════════════════════════════
#  GitHub helpers
# ═══════════════════════════════════════════════════════════════════════════

def gh_headers(token: Optional[str]) -> dict:
    h = {
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


async def gh_get(client: httpx.AsyncClient, path: str, token: Optional[str]):
    """Fetch one GitHub API path; returns (data, error_string)."""
    try:
        r = await client.get(f"{GITHUB_API}{path}", headers=gh_headers(token), timeout=15)
        if r.status_code == 404:
            return None, "not_found"
        if r.status_code in (403, 429):
            return None, "rate_limit"
        if not r.is_success:
            body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
            return None, body.get("message", r.text)
        return r.json(), None
    except Exception as e:
        return None, str(e)


# ═══════════════════════════════════════════════════════════════════════════
#  Routes
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"status": "ok", "model": ANTHROPIC_MODEL}


# ── 1. Fetch repo metadata + tree + languages + readme ─────────────────────
@app.post("/api/repo")
async def fetch_repo(req: RepoRequest):
    async with httpx.AsyncClient() as client:
        # metadata is mandatory — fail fast
        meta, err = await gh_get(client, f"/repos/{req.owner}/{req.repo}", req.token)
        if err == "not_found":
            raise HTTPException(404, f'Repository "{req.owner}/{req.repo}" not found or is private.')
        if err == "rate_limit":
            raise HTTPException(429, "GitHub API rate limit hit. Add a Personal Access Token in the app.")
        if err:
            raise HTTPException(502, f"GitHub error: {err}")

        # parallel soft fetches
        branch = meta.get("default_branch", "HEAD")
        langs_task   = gh_get(client, f"/repos/{req.owner}/{req.repo}/languages", req.token)
        readme_task  = gh_get(client, f"/repos/{req.owner}/{req.repo}/readme", req.token)
        tree_task    = gh_get(client, f"/repos/{req.owner}/{req.repo}/git/trees/{branch}?recursive=1", req.token)

        (langs, _), (readme_raw, _), (tree_raw, _) = await asyncio.gather(
            langs_task, readme_task, tree_task
        )

        # decode readme
        readme_text = ""
        if readme_raw and "content" in readme_raw:
            import base64
            try:
                readme_text = base64.b64decode(
                    readme_raw["content"].replace("\n", "")
                ).decode("utf-8", errors="replace")
            except Exception:
                pass

        tree = []
        if tree_raw and "tree" in tree_raw:
            tree = [
                {"path": n["path"], "type": n["type"]}
                for n in tree_raw["tree"]
                if n.get("type") in ("blob", "tree")
            ]

        return {
            "meta":     meta,
            "languages": langs or {},
            "readme":   readme_text[:6000],   # cap at 6k chars
            "tree":     tree[:300],            # cap at 300 nodes
        }


# ── 2. Generic streaming AI endpoint ──────────────────────────────────────
@app.post("/api/ai/stream")
async def ai_stream(req: AIRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY not set in backend .env")

    async def generate():
        async with httpx.AsyncClient(timeout=90) as client:
            async with client.stream(
                "POST",
                ANTHROPIC_URL,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                },
                json={
                    "model":      ANTHROPIC_MODEL,
                    "max_tokens": req.max_tokens,
                    "stream":     True,
                    "system":     req.system,
                    "messages":   [{"role": "user", "content": req.prompt}],
                },
            ) as response:
                if not response.is_success:
                    body = await response.aread()
                    err  = json.loads(body).get("error", {}).get("message", "Unknown error")
                    yield f"data: {json.dumps({'error': err})}\n\n"
                    return

                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        yield f"{line}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ── 3. Non-streaming AI (for search JSON responses) ────────────────────────
@app.post("/api/ai/complete")
async def ai_complete(req: AIRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(500, "ANTHROPIC_API_KEY not set in backend .env")

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            ANTHROPIC_URL,
            headers={
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
            },
            json={
                "model":      ANTHROPIC_MODEL,
                "max_tokens": req.max_tokens,
                "system":     req.system,
                "messages":   [{"role": "user", "content": req.prompt}],
            },
        )
    if not r.is_success:
        detail = r.json().get("error", {}).get("message", r.text)
        raise HTTPException(r.status_code, detail)

    data = r.json()
    text = "".join(b.get("text", "") for b in data.get("content", []))
    return {"text": text}
