import { Card, SectionLabel, LoadingRow } from './UI.jsx'

const LAYERS = [
  { label: 'Presentation',   color: '#4a88ff', items: ['UI Components', 'State Management', 'Routing', 'API Client'] },
  { label: 'Application',    color: '#7040ff', items: ['Business Logic', 'Auth / AuthZ', 'Data Transform', 'Event System'] },
  { label: 'Infrastructure', color: '#e8a045', items: ['REST / GraphQL', 'Middleware', 'Rate Limiting', 'Caching'] },
  { label: 'Persistence',    color: '#5a9e6a', items: ['Database', 'File Storage', 'Search Index', 'Message Queue'] },
]

export default function Architecture({ insight, loading }) {
  return (
    <Card className="fade-up">
      <SectionLabel>Architecture Diagram</SectionLabel>

      {loading && !insight && <LoadingRow label="Analyzing architecture…" />}

      {insight && (
        <p style={{ fontSize: 13.5, color: 'rgba(210,215,240,0.75)', lineHeight: 1.72, marginBottom: 20 }}>
          {insight}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {LAYERS.map((l, i) => (
          <div key={l.label}>
            <div style={{ border: `1px solid ${l.color}38`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                background: `${l.color}16`,
                borderBottom: `1px solid ${l.color}25`,
                padding: '5px 14px',
                fontSize: 11, fontWeight: 700, color: l.color,
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>{l.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '9px 14px' }}>
                {l.items.map(it => (
                  <span key={it} style={{
                    fontSize: 12, padding: '3px 10px', borderRadius: 20,
                    background: `${l.color}10`, color: l.color,
                    border: `1px solid ${l.color}28`,
                  }}>{it}</span>
                ))}
              </div>
            </div>
            {i < LAYERS.length - 1 && (
              <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(200,200,220,0.28)', padding: '2px 0' }}>↕</div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
