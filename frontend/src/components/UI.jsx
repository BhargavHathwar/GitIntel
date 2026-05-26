// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 17 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      style={{ animation: 'spin .85s linear infinite', flexShrink: 0 }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

// ── GitHub icon ──────────────────────────────────────────────────────────────
export function IconGitHub({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  )
}

// ── Markdown renderer ────────────────────────────────────────────────────────
export function MD({ text }) {
  const html = (text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) => `<pre class="mcb"><code>${c.trimEnd()}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="mic">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^[-*] (.+)$/gm,  '<li>$1</li>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br/>')

  return (
    <div
      className="md-body"
      dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }}
    />
  )
}

// ── Generic card wrapper ─────────────────────────────────────────────────────
export function Card({ children, style = {} }) {
  return <div className="card" style={style}>{children}</div>
}

// ── Section heading ──────────────────────────────────────────────────────────
export function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>
}

// ── Empty / loading state ────────────────────────────────────────────────────
export function LoadingRow({ label = 'Loading…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'rgba(200,200,220,0.4)', fontSize: 13.5 }}>
      <Spinner /> {label}
    </div>
  )
}

// ── Error banner ─────────────────────────────────────────────────────────────
export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <div style={{
      background: 'rgba(255,80,80,0.09)',
      border: '1px solid rgba(255,80,80,0.22)',
      borderRadius: 9,
      padding: '11px 15px',
      color: '#ff9090',
      fontSize: 13,
      lineHeight: 1.65,
    }}>
      ⚠ {message}
    </div>
  )
}
