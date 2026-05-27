const BASE = '/api'

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

// Streaming — accumulates delta chunks and fires onChunk(fullText)
export async function streamAI(system, prompt, onChunk, maxTokens = 1500) {
  const res = await fetch(`${BASE}/ai/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, prompt, max_tokens: maxTokens }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Stream error ${res.status}`)
  }

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let accumulated = ''
  let lineBuffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    lineBuffer += dec.decode(value, { stream: true })
    const lines = lineBuffer.split('\n')
    lineBuffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const raw = trimmed.slice(5).trim()
      if (!raw || raw === '[DONE]') continue

      try {
        const parsed = JSON.parse(raw)
        if (parsed.error) throw new Error(parsed.error)
        const chunk = parsed?.delta?.text ?? ''
        if (chunk) {
          accumulated += chunk
          onChunk?.(accumulated)
        }
      } catch (e) {
        if (e.message && !e.message.startsWith('JSON')) throw e
      }
    }
  }

  return accumulated
}

// Non-streaming for structured JSON (search)
export async function completeAI(system, prompt, maxTokens = 1500) {
  const res = await fetch(`${BASE}/ai/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, prompt, max_tokens: maxTokens }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Complete error ${res.status}`)
  }
  return (await res.json()).text
}
