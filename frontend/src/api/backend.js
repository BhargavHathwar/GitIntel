// All communication with the FastAPI backend lives here.
// The Vite proxy forwards /api/* → http://localhost:8000/api/*

const BASE = '/api'

// ── Fetch repo data (meta + tree + languages + readme) ─────────────────────
export async function fetchRepo(owner, repo, token = '') {
  const res = await fetch(`${BASE}/repo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner, repo, token }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err.detail || 'Failed to fetch repo'), { status: res.status })
  }
  return res.json()
}

// ── Streaming AI call — calls onChunk(fullTextSoFar) on every token ─────────
export async function streamAI(system, prompt, onChunk, maxTokens = 1200) {
  const res = await fetch(`${BASE}/ai/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, prompt, max_tokens: maxTokens }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `AI stream error ${res.status}`)
  }

  const reader = res.body.getReader()
  const dec    = new TextDecoder()
  let full     = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of dec.decode(value).split('\n')) {
      if (!line.startsWith('data: ')) continue
      const raw = line.slice(6)
      if (raw === '[DONE]') continue
      try {
        const data = JSON.parse(raw)
        if (data.error) throw new Error(data.error)
        const delta = data?.delta?.text || ''
        full += delta
        onChunk?.(full)
      } catch (e) {
        if (e.message !== 'JSON parse') throw e
      }
    }
  }
  return full
}

// ── Non-streaming AI (used for structured JSON responses e.g. search) ───────
export async function completeAI(system, prompt, maxTokens = 1200) {
  const res = await fetch(`${BASE}/ai/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, prompt, max_tokens: maxTokens }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `AI complete error ${res.status}`)
  }
  const data = await res.json()
  return data.text
}
