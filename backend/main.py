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

load_dotenv()

app = FastAPI(title="GitIntel API", version="2.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL   = "gemini-2.0-flash"
GEMINI_BASE    = "https://generativelanguage.googleapis.com/v1beta/models"
GITHUB_API     = "https://api.github.com"


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
    # Use user-provided token first, fall back to server token
    effective_token = token or GITHUB_TOKEN
    if effective_token:
        h["Authorization"] = f"Bearer {effective_token}"
    return h

async def gh_get(client: httpx.AsyncClient, path: str, token: Optional[str]):
    try:
        r = await client.get(f"{GITHUB_API}{path}", headers=gh_headers(token), timeout=15)
        if r.status_code == 404:        return None, "not_found"
        if r.status_code in (403, 429): return None, "rate_limit"
        if not r.is_success:
            body = r.json() if "application/json" in r.headers.get("content-type", "") else {}
            return None, body.get("message", r.text)
        return r.json(), None
    except Exception as e:
        return None, str(e)


# ── Gemini helpers ────────────────────────────────────────────────────────────
def gemini_body(system: str, prompt: str, max_tokens: int) -> dict:
    return {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.4},
    }

def extract_text(data: dict) -> str:
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception:
        return ""


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "model": GEMINI_MODEL, "provider": "Google Gemini"}


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
            "readme":    readme_text[:4000],   # reduced to speed up AI
            "tree":      tree[:200],            # reduced to speed up AI
        }


# ── TRUE Gemini streaming using streamGenerateContent ────────────────────────
# We read the raw JSON array response and parse each chunk as it arrives.
# Gemini returns newline-delimited JSON objects (NOT SSE when alt=sse is off).
@app.post("/api/ai/stream")
async def ai_stream(req: AIRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(500, "GEMINI_API_KEY not set in backend .env")

    # Use streamGenerateContent WITHOUT alt=sse
    # This returns a streaming JSON array: [chunk1, chunk2, ...]
    # Each chunk arrives as it's generated — true real-time streaming
    url = (
        f"{GEMINI_BASE}/{GEMINI_MODEL}:streamGenerateContent"
        f"?key={GEMINI_API_KEY}"
    )

    async def generate():
        try:
            async with httpx.AsyncClient(timeout=90) as client:
                async with client.stream(
                    "POST",
                    url,
                    headers={"Content-Type": "application/json"},
                    json=gemini_body(req.system, req.prompt, req.max_tokens),
                ) as response:

                    if not response.is_success:
                        body = await response.aread()
                        try:
                            err_msg = json.loads(body)["error"]["message"]
                        except Exception:
                            err_msg = body.decode()[:300]
                        yield f"data: {json.dumps({'error': err_msg})}\n\n"
                        return

                    # Gemini streams a JSON array. Each chunk is a complete
                    # JSON object separated by commas and newlines.
                    # We buffer bytes and parse each object as soon as we see one.
                    raw_buffer = b""
                    depth = 0
                    in_string = False
                    escape_next = False
                    obj_start = -1

                    async for chunk_bytes in response.aiter_bytes(chunk_size=512):
                        raw_buffer += chunk_bytes

                        # Parse JSON objects out of the stream as they complete
                        i = 0
                        while i < len(raw_buffer):
                            c = chr(raw_buffer[i])

                            if escape_next:
                                escape_next = False
                            elif c == '\\' and in_string:
                                escape_next = True
                            elif c == '"':
                                in_string = not in_string
                            elif not in_string:
                                if c == '{':
                                    if depth == 0:
                                        obj_start = i
                                    depth += 1
                                elif c == '}':
                                    depth -= 1
                                    if depth == 0 and obj_start >= 0:
                                        # We have a complete JSON object
                                        obj_bytes = raw_buffer[obj_start:i+1]
                                        raw_buffer = raw_buffer[i+1:]
                                        i = -1  # reset index after slice
                                        obj_start = -1

                                        try:
                                            obj = json.loads(obj_bytes)
                                            text = extract_text(obj)
                                            if text:
                                                yield f"data: {json.dumps({'delta': {'text': text}})}\n\n"
                                        except Exception:
                                            pass
                            i += 1

        except httpx.TimeoutException:
            yield f"data: {json.dumps({'error': 'Request timed out. Try again.'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )


# ── Non-streaming for search JSON ─────────────────────────────────────────────
@app.post("/api/ai/complete")
async def ai_complete(req: AIRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(500, "GEMINI_API_KEY not set in backend .env")

    url = f"{GEMINI_BASE}/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            url,
            headers={"Content-Type": "application/json"},
            json=gemini_body(req.system, req.prompt, req.max_tokens),
        )

    if not r.is_success:
        try:
            detail = r.json()["error"]["message"]
        except Exception:
            detail = r.text
        raise HTTPException(r.status_code, detail)

    return {"text": extract_text(r.json())}
