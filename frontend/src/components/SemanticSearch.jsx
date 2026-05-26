import { useState } from 'react'
import { Spinner, Card, SectionLabel } from './UI.jsx'
import { completeAI } from '../api/backend.js'

const SUGGESTIONS = [
  'How does authentication work?',
  'Where are API calls handled?',
  'Database models & schema',
  'Error handling patterns',
  'Main entry point',
]

export default function SemanticSearch({ context }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  const search = async (q = query) => {
    if (!q.trim()) return
    setLoading(true); setResults([]); setError('')
    try {
      const raw = await completeAI(
        'You are a semantic code search engine. Return ONLY a valid JSON array, no markdown, no prose.',
        `Repository context:\n${context}\n\nSearch query: "${q}"\n\nReturn a JSON array of 4 results:\n[{"file":"path/to/file","relevance":"high|medium","explanation":"why this is relevant","snippet":"short illustrative pseudocode or comment"}]`
      )
      const clean = raw.replace(/```json|```/g, '').trim()
      setResults(JSON.parse(clean))
    } catch {
      setError('Could not parse results — try rephrasing your query.')
      setResults([])
    }
    setLoading(false)
  }

  return (
    <div className="fade-up">
      {/* Input card */}
      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>Semantic Code Search</SectionLabel>
        <div style={{ display: 'flex', gap: 9, marginBottom: 12 }}>
          <input
            className="inp"
            placeholder="How does authentication work? Where are API calls?"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
          />
          <button className="btn btn-primary" onClick={() => search()} disabled={loading} style={{ whiteSpace: 'nowrap' }}>
            {loading ? <Spinner size={15} /> : '⌕'} Search
          </button>
        </div>

        {/* Quick suggestions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => { setQuery(s); search(s) }}
              style={{
                fontSize: 12, padding: '4px 10px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.075)',
                borderRadius: 20, color: 'rgba(200,200,220,0.48)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >{s}</button>
          ))}
        </div>
      </Card>

      {error && (
        <div style={{ color: '#ff9090', fontSize: 13, padding: '8px 0' }}>⚠ {error}</div>
      )}

      {/* Results */}
      {results.map((r, i) => (
        <div key={i} className="card" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#7eb8ff' }}>{r.file}</span>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 20,
              background: r.relevance === 'high' ? 'rgba(74,200,100,.12)' : 'rgba(230,180,50,.12)',
              color:      r.relevance === 'high' ? '#5de87b'              : '#e8c832',
              border: `1px solid ${r.relevance === 'high' ? 'rgba(74,200,100,.28)' : 'rgba(230,180,50,.28)'}`,
            }}>{r.relevance}</span>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(210,215,240,0.7)', margin: '0 0 8px', lineHeight: 1.65 }}>
            {r.explanation}
          </p>
          {r.snippet && <pre className="mcb" style={{ margin: 0 }}>{r.snippet}</pre>}
        </div>
      ))}
    </div>
  )
}
