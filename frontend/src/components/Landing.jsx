import { useState } from 'react'
import { Spinner, ErrorBanner } from './UI.jsx'

const EXAMPLES = [
  'https://github.com/facebook/react',
  'https://github.com/vercel/next.js',
  'https://github.com/fastapi/fastapi',
  'https://github.com/microsoft/vscode',
]

const FEATURES = [
  ['◈', 'AI Summary',       'Full AI analysis generated in seconds'],
  ['⌕', 'Semantic Search',  'Find code by intent, not just keywords'],
  ['◎', 'AI Chat',          'Ask anything about the codebase'],
  ['⊞', 'Architecture',     'Visualize system design & data flow'],
  ['⚠', 'Bug Detection',    'AI-powered quality & security scan'],
  ['⌂', 'File Explorer',    'Interactive collapsible repo tree'],
]

export default function Landing({ onAnalyze, loading, loadStep, error }) {
  const [url,       setUrl]       = useState('')
  const [token,     setToken]     = useState('')
  const [showToken, setShowToken] = useState(false)

  const handleSubmit = () => {
    if (url.trim()) onAnalyze(url.trim(), token.trim())
  }

  return (
    <div style={{ textAlign: 'center', padding: '72px 0 56px', animation: 'up .4s ease' }}>
      {/* Hero */}
      <div style={{ fontSize: 11, letterSpacing: '.16em', color: '#6aabff', fontWeight: 700, marginBottom: 18 }}>
        AI-POWERED REPOSITORY INTELLIGENCE
      </div>
      <h1 style={{
        fontSize: 46, fontWeight: 800, margin: '0 0 14px', lineHeight: 1.12,
        background: 'linear-gradient(135deg,#fff 40%,#8898ff)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>
        Understand any GitHub<br />repo in seconds
      </h1>
      <p style={{
        fontSize: 17, color: 'rgba(210,215,240,0.42)',
        margin: '0 auto 40px', maxWidth: 420, lineHeight: 1.6,
      }}>
        AI summaries · semantic search · architecture diagrams · conversational code exploration
      </p>

      {/* Input area */}
      <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'left' }}>
        <div style={{ display: 'flex', gap: 9, marginBottom: 8 }}>
          <input
            className="inp"
            placeholder="https://github.com/owner/repository"
            value={url}
            onChange={e => { setUrl(e.target.value) }}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ fontSize: 14.5 }}
          />
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading || !url.trim()}
            style={{ whiteSpace: 'nowrap', padding: '10px 20px' }}
          >
            {loading ? <><Spinner size={16} /> Analyzing…</> : 'Analyze →'}
          </button>
        </div>

        {/* GitHub PAT */}
        <div style={{ marginBottom: 10 }}>
          <button
            onClick={() => setShowToken(t => !t)}
            style={{
              background: 'none', border: 'none',
              color: 'rgba(200,200,220,0.38)', fontSize: 12,
              cursor: 'pointer', textDecoration: 'underline',
              padding: 0, fontFamily: 'inherit',
            }}
          >
            {showToken ? '▾ Hide' : '▸ Add'} GitHub token (fixes rate-limit errors)
          </button>

          {showToken && (
            <>
              <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
                <input
                  className="inp"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx  (no scopes needed for public repos)"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  style={{ fontSize: 13 }}
                />
              </div>
              <p style={{ fontSize: 11.5, color: 'rgba(200,200,220,0.32)', margin: '5px 0 0', lineHeight: 1.5 }}>
                Create one at: GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → no scopes needed.
              </p>
            </>
          )}
        </div>

        {/* Error */}
        <ErrorBanner message={error} />

        {/* Load step */}
        {loading && loadStep && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(200,200,220,0.4)', fontSize: 13, marginTop: 12 }}>
            <Spinner size={15} /> {loadStep}
          </div>
        )}

        {/* Quick examples */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 20, justifyContent: 'center' }}>
          <span style={{ fontSize: 12, color: 'rgba(200,200,220,0.28)', alignSelf: 'center' }}>Try:</span>
          {EXAMPLES.map(e => (
            <button
              key={e}
              onClick={() => setUrl(e)}
              style={{
                fontSize: 12, padding: '4px 11px',
                background: 'rgba(255,255,255,0.038)',
                border: '1px solid rgba(255,255,255,0.075)',
                borderRadius: 20, color: 'rgba(200,200,220,0.48)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {e.replace('https://github.com/', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Feature grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: 13, marginTop: 60, textAlign: 'left',
      }}>
        {FEATURES.map(([ic, title, desc]) => (
          <div key={title} className="card">
            <div style={{ fontSize: 22, marginBottom: 8, color: '#6aabff' }}>{ic}</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#dde0f0', marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 12.5, color: 'rgba(200,200,220,0.42)', lineHeight: 1.55 }}>{desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
