from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
import os
import json
import asyncio
import base64
from typing import Optional
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

app = FastAPI(title="GitIntel API", version="2.4.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://git-intel-phi.vercel.app",
        "https://git-intel-git-main-bhargavhathwars-projects.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL   = "llama-3.3-70b-versatile"   # fast, free, generous quota
GITHUB_API   = "https://api.github.com"

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


# ── Models ───────────────────────────────────────────────────────────────────
class RepoRequest(BaseModel):
    owner: str
    repo:  str
    token: Optional[str] = None

class AIRequest(BaseModel):
    system:     str
    prompt:     str
    max_tokens: Optional[int] = 1500


# ── GitHub helpers ────────────────────────────────────────────────────────────
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

def gh_headers(token: Optional[str]) -> dict:
    h = {"Accept": "application/vnd.github.v3+json", "X-GitHub-Api-Version": "2022-11-28"}
    effective_token = token or GITHUB_TOKEN
    if effective_token:
        h["Authorization"] = f"Bearer {effective_token}"
    return h

async def gh_get(client: httpx.AsyncClient, path: str, token: Optional[str], timeout: float = 12):
    try:
        r = await client.get(f"{GITHUB_API}{path}", headers=gh_headers(token), timeout=timeout)
        if r.status_code == 404:        return None, "not_found"
        if r.status_code in (403, 429): return None, "rate_limit"
        if not r.is_success:
            body = r.json() if "application/json" in r.headers.get("content-type", "") else {}
            return None, body.get("message", r.text)
        return r.json(), None
    except Exception as e:
        return None, str(e)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model": GROQ_MODEL, "provider": "Groq"}


# ── Phase 1: fast skeleton (meta + languages only) ────────────────────────────
@app.post("/api/repo/meta")
async def fetch_repo_meta(req: RepoRequest):
    async with httpx.AsyncClient() as client:
        meta, err = await gh_get(client, f"/repos/{req.owner}/{req.repo}", req.token)
        if err == "not_found":
            raise HTTPException(404, f'Repository "{req.owner}/{req.repo}" not found or is private.')
        if err == "rate_limit":
            raise HTTPException(429, "GitHub API rate limit hit. Add a Personal Access Token in the app.")
        if err:
            raise HTTPException(502, f"GitHub API error: {err}")

        langs, _ = await gh_get(client, f"/repos/{req.owner}/{req.repo}/languages", req.token)
        return {"meta": meta, "languages": langs or {}}


# ── Phase 2: tree + readme (background) ──────────────────────────────────────
@app.post("/api/repo/details")
async def fetch_repo_details(req: RepoRequest):
    async with httpx.AsyncClient() as client:
        meta, err = await gh_get(client, f"/repos/{req.owner}/{req.repo}", req.token, timeout=8)
        if err:
            raise HTTPException(502, f"GitHub API error: {err}")

        branch = meta.get("default_branch", "HEAD")

        (readme_raw, _), (tree_raw, _) = await asyncio.gather(
            gh_get(client, f"/repos/{req.owner}/{req.repo}/readme", req.token, timeout=10),
            gh_get(client, f"/repos/{req.owner}/{req.repo}/git/trees/{branch}?recursive=1", req.token, timeout=20),
        )

        readme_text = ""
        if readme_raw and "content" in readme_raw:
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
            ][:300]

        return {"readme": readme_text[:4000], "tree": tree}


# ── Legacy combined endpoint ──────────────────────────────────────────────────
@app.post("/api/repo")
async def fetch_repo(req: RepoRequest):
    async with httpx.AsyncClient() as client:
        meta, err = await gh_get(client, f"/repos/{req.owner}/{req.repo}", req.token)
        if err == "not_found":
            raise HTTPException(404, f'Repository "{req.owner}/{req.repo}" not found or is private.')
        if err == "rate_limit":
            raise HTTPException(429, "GitHub API rate limit hit. Add a Personal Access Token in the app.")
        if err:
            raise HTTPException(502, f"GitHub API error: {err}")

        branch = meta.get("default_branch", "HEAD")
        (langs, _), (readme_raw, _), (tree_raw, _) = await asyncio.gather(
            gh_get(client, f"/repos/{req.owner}/{req.repo}/languages", req.token),
            gh_get(client, f"/repos/{req.owner}/{req.repo}/readme", req.token),
            gh_get(client, f"/repos/{req.owner}/{req.repo}/git/trees/{branch}?recursive=1", req.token),
        )

        readme_text = ""
        if readme_raw and "content" in readme_raw:
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
            "meta":      meta,
            "languages": langs or {},
            "readme":    readme_text[:4000],
            "tree":      tree[:200],
        }


# ── Groq streaming ────────────────────────────────────────────────────────────
@app.post("/api/ai/stream")
async def ai_stream(req: AIRequest):
    if not GROQ_API_KEY:
        raise HTTPException(500, "GROQ_API_KEY not set in backend .env")

    async def generate():
        try:
            # Groq streaming runs synchronously in the SDK, so we run it in a thread
            loop = asyncio.get_event_loop()

            def stream_groq():
                return groq_client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[
                        {"role": "system", "content": req.system},
                        {"role": "user",   "content": req.prompt},
                    ],
                    max_tokens=req.max_tokens,
                    temperature=0.4,
                    stream=True,
                )

            stream = await loop.run_in_executor(None, stream_groq)

            for chunk in stream:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield f"data: {json.dumps({'delta': {'text': delta}})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "X-Accel-Buffering": "no",
            "Connection":       "keep-alive",
        }
    )


# ── Groq non-streaming (search) ───────────────────────────────────────────────
@app.post("/api/ai/complete")
async def ai_complete(req: AIRequest):
    if not GROQ_API_KEY:
        raise HTTPException(500, "GROQ_API_KEY not set in backend .env")

    try:
        loop = asyncio.get_event_loop()

        def call_groq():
            return groq_client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": req.system},
                    {"role": "user",   "content": req.prompt},
                ],
                max_tokens=req.max_tokens,
                temperature=0.4,
                stream=False,
            )

        response = await loop.run_in_executor(None, call_groq)
        return {"text": response.choices[0].message.content}

    except Exception as e:
        raise HTTPException(500, str(e))
