import { IconGitHub } from './UI.jsx'
import { LANG_COLORS } from '../utils/helpers.js'

export default function RepoHeader({ meta, languages, techStack }) {
  const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0)
  const langBars = Object.entries(languages)
    .map(([l, b]) => ({ l, pct: Math.round((b / totalBytes) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 7)

  return (
    <div style={{ marginBottom: 22 }}>
      {/* Name + avatar + stats */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <img
              src={meta.owner?.avatar_url} alt=""
              width={36} height={36}
              style={{ borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)' }}
            />
            <div>
              <div style={{ fontSize: 21, fontWeight: 700, color: '#e8eaf8' }}>{meta.name}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(200,200,220,0.38)' }}>by {meta.owner?.login}</div>
            </div>
          </div>

          {meta.description && (
            <p style={{ fontSize: 13.5, color: 'rgba(200,210,240,0.58)', margin: '0 0 10px', maxWidth: 520, lineHeight: 1.6 }}>
              {meta.description}
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {[
              ['★', meta.stargazers_count?.toLocaleString(), 'stars'],
              ['⑂', meta.forks_count?.toLocaleString(), 'forks'],
              ['◉', meta.open_issues_count?.toLocaleString(), 'issues'],
            ].map(([ic, v, l]) => (
              <span key={l} style={{ fontSize: 12.5, color: 'rgba(200,200,220,0.48)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: '#e8a045' }}>{ic}</span> {v} {l}
              </span>
            ))}
          </div>
        </div>

        <a
          href={meta.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
          style={{ textDecoration: 'none', fontSize: 13 }}
        >
          <IconGitHub /> View on GitHub
        </a>
      </div>

      {/* Language bar */}
      {langBars.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ height: 7, borderRadius: 4, display: 'flex', overflow: 'hidden', marginBottom: 9 }}>
            {langBars.map(({ l, pct }) => (
              <div key={l} style={{ width: `${pct}%`, background: LANG_COLORS[l] || '#666' }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {langBars.map(({ l, pct }) => (
              <span key={l} style={{ fontSize: 12, color: 'rgba(200,200,220,0.52)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: LANG_COLORS[l] || '#666', display: 'inline-block' }} />
                {l} {pct}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tech stack badges */}
      {techStack.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
          {techStack.map(t => (
            <span key={t} style={{
              fontSize: 12, padding: '3px 11px',
              background: 'rgba(96,48,239,0.14)',
              color: '#a090ff',
              border: '1px solid rgba(96,48,239,0.28)',
              borderRadius: 20, fontWeight: 500,
            }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}
