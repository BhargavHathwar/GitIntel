import { useState, useEffect, useRef } from 'react'
import { fetchRepoMeta, fetchRepoDetails, streamAI, completeAI } from './api/backend.js'
import { parseGitHubUrl, detectStack, buildTreeObj, buildContext, LANG_COLORS } from './utils/helpers.js'

// ─── Tiny shared primitives ─────────────────────────────────────────────────

const Icon = ({ name, className = '', fill = false }) => (
  <span className={`material-symbols-outlined ${fill ? 'icon-fill' : ''} ${className}`}>{name}</span>
)

const Spinner = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={2} strokeLinecap="round"
    style={{ animation: 'spin .8s linear infinite', flexShrink: 0 }}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
  </svg>
)

function MD({ text, streaming }) {
  const html = (text || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) => `<pre><code>${c.trimEnd()}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br/>')
  return (
    <div className={`md-content ${streaming ? 'typing' : ''}`}
      dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />
  )
}

const GitHubLogo = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
    <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.35 3.12.88.01.64.01 1.24.01 1.38 0 .21-.15.46-.55.38A8.013 8.013 0 0 1 0 8c0-4.42 3.58-8 8-8z" />
  </svg>
)

// ─── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ icon, iconColor, label, value }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
      <span className="text-xs font-code tracking-widest text-on-surface-variant uppercase block mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <Icon name={icon} className={`text-lg ${iconColor}`} fill />
        <span className="font-headline text-lg font-bold text-on-surface">{value ?? '—'}</span>
      </div>
    </div>
  )
}

// ─── File Tree ───────────────────────────────────────────────────────────────
function TreeNode({ name, node, depth }) {
  const isDir = node && typeof node === 'object'
  const [open, setOpen] = useState(depth < 2)
  const ext = name.split('.').pop()
  const dot = isDir ? '#acc7ff' : (LANG_COLORS[ext] || '#8b909f')
  return (
    <div>
      <div
        onClick={() => isDir && setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer hover:bg-surface-container-high transition-colors group"
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <span className="text-xs w-3 flex-shrink-0 text-center" style={{ color: dot }}>
          {isDir ? (open ? '▾' : '▸') : '·'}
        </span>
        <span className={`font-code text-xs ${isDir ? 'text-on-surface' : 'text-on-surface-variant'}`}>{name}</span>
      </div>
      {isDir && open && Object.entries(node)
        .sort(([, a], [, b]) => (a === null ? 1 : 0) - (b === null ? 1 : 0))
        .map(([k, v]) => <TreeNode key={k} name={k} node={v} depth={depth + 1} />)}
    </div>
  )
}

// ─── Tree skeleton (shown while tree loads) ──────────────────────────────────
function TreeSkeleton() {
  // Mimic a realistic folder structure with varying widths
  const rows = [
    { depth: 0, w: 120, isDir: true },
    { depth: 1, w: 90,  isDir: false },
    { depth: 1, w: 105, isDir: false },
    { depth: 1, w: 80,  isDir: false },
    { depth: 0, w: 100, isDir: true },
    { depth: 1, w: 130, isDir: false },
    { depth: 1, w: 85,  isDir: false },
    { depth: 0, w: 95,  isDir: true },
    { depth: 1, w: 110, isDir: false },
    { depth: 1, w: 70,  isDir: false },
    { depth: 1, w: 125, isDir: false },
    { depth: 0, w: 88,  isDir: false },
    { depth: 0, w: 76,  isDir: false },
    { depth: 0, w: 92,  isDir: false },
  ]
  return (
    <div className="p-2 space-y-1">
      {rows.map((r, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 px-2 py-0.5"
          style={{ paddingLeft: 8 + r.depth * 16 }}
        >
          <div className="skeleton rounded w-3 h-3 flex-shrink-0" style={{ opacity: 0.5 }} />
          <div
            className="skeleton rounded h-3"
            style={{ width: r.w, animationDelay: `${i * 60}ms` }}
          />
        </div>
      ))}
    </div>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'overview',     label: 'AI Overview',   icon: 'auto_awesome' },
  { id: 'files',        label: 'File Explorer', icon: 'folder_open' },
  { id: 'search',       label: 'Semantic Search', icon: 'manage_search' },
  { id: 'chat',         label: 'AI Chat',       icon: 'chat' },
  { id: 'architecture', label: 'Architecture',  icon: 'schema' },
  { id: 'bugs',         label: 'Code Analysis', icon: 'bug_report' },
]

function Sidebar({ tab, setTab, onNew }) {
  return (
    <aside className="hidden lg:flex flex-col h-full w-64 bg-surface-container-low border-r border-outline-variant flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-outline-variant">
        <div className="w-8 h-8 bg-surface-container-highest border border-outline-variant rounded-md flex items-center justify-center flex-shrink-0 text-on-surface">
          <GitHubLogo className="w-5 h-5" />
        </div>
        <div>
          <div className="font-headline font-bold text-on-surface text-base leading-tight">GitIntel</div>
          <div className="font-code text-[10px] text-on-surface-variant uppercase tracking-widest">Repo Intelligence</div>
        </div>
      </div>

      {/* New repo button */}
      <div className="px-3 py-3">
        <button
          onClick={onNew}
          className="w-full py-2 px-4 bg-tertiary text-white rounded-lg font-bold text-xs tracking-wide flex items-center justify-center gap-2 hover:brightness-110 transition-all shadow-sm border border-outline-variant/30"
        >
          <Icon name="add" className="text-base" /> Analyze New Repo
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-xs font-code tracking-wide ${
                active
                  ? 'bg-secondary-container text-on-secondary-container font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              }`}
            >
              <Icon name={item.icon} className="text-xl" fill={active} />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Bottom links */}
      <div className="px-2 py-3 border-t border-outline-variant space-y-0.5">
        <a href="mailto:support@gitintel.dev" className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors text-xs font-code tracking-wide">
          <Icon name="help" className="text-xl" />
          Support
        </a>
      </div>
    </aside>
  )
}

// ─── TopBar ──────────────────────────────────────────────────────────────────
function TopBar({ repoMeta, onNew, tab, setTab, theme, toggleTheme }) {
  return (
    <header className="bg-[#24292f] border-b border-[#30363d] flex items-center justify-between px-6 h-14 flex-shrink-0 sticky top-0 z-30 text-white">
      {/* Mobile logo */}
      <div className="flex items-center gap-3 lg:hidden text-white">
        <GitHubLogo className="w-6 h-6 text-white" />
        <span className="font-headline font-bold text-base">GitIntel</span>
      </div>

      {/* Mobile tab selector */}
      <div className="lg:hidden flex-1 ml-4 overflow-x-auto">
        <div className="flex gap-1">
          {NAV_ITEMS.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded text-xs font-code tracking-wide transition-colors ${tab === item.id ? 'bg-[#30363d] text-white' : 'text-[#8b949e] hover:text-white'}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 ml-4">
        {repoMeta && (
          <span className="hidden md:flex items-center gap-1.5 font-code text-xs text-[#8b949e]">
            <GitHubLogo className="w-4 h-4 text-[#8b949e]" />
            <span className="text-white font-semibold">{repoMeta.full_name}</span>
          </span>
        )}
        <div className="h-4 w-[1px] bg-[#30363d] hidden md:block mx-2" />
        <button onClick={onNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#21262d] border border-[#30363d] rounded text-white text-xs font-code tracking-wide hover:border-[#8b949e] transition-colors shadow-sm">
          <Icon name="add" className="text-base" /> New
        </button>
        <button onClick={toggleTheme} className="text-[#8b949e] hover:text-white transition-colors p-1.5 rounded hover:bg-[#30363d]" title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="text-xl" />
        </button>
        <div className="w-8 h-8 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center">
          <Icon name="person" className="text-[#8b949e] text-xl" fill />
        </div>
      </div>
    </header>
  )
}

// ─── Landing page ─────────────────────────────────────────────────────────────
const EXAMPLES = [
  'https://github.com/facebook/react',
  'https://github.com/vercel/next.js',
  'https://github.com/fastapi/fastapi',
  'https://github.com/microsoft/vscode',
]

const FEATURES = [
  ['auto_awesome',  'AI Summary',       'Streaming GPT analysis: purpose, architecture, quality'],
  ['manage_search', 'Semantic Search',  'Find code locations by natural language intent'],
  ['chat',          'AI Chat',          'Full conversational Q&A scoped to the repository'],
  ['schema',        'Architecture',     'Layered system diagram with AI architectural insight'],
  ['bug_report',    'Bug Detection',    'AI-powered quality, security & maintainability scan'],
  ['folder_open',   'File Explorer',    'Interactive collapsible repository tree browser'],
]

function Landing({ onAnalyze, loading, loadStep, error, theme, toggleTheme }) {
  const [url, setUrl] = useState('')
  return (
    <div className="flex flex-col items-center min-h-screen bg-background relative overflow-hidden">
      {/* Radial hero glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 70% 40% at 50% 30%, var(--primary-glow) 0%, transparent 70%)' }} />

      {/* Top nav */}
      <header className="w-full bg-[#24292f] border-b border-[#30363d] flex items-center justify-between px-6 h-14 sticky top-0 z-50 text-white">
        <div className="flex items-center gap-3 text-white">
          <GitHubLogo className="w-6 h-6 text-white" />
          <span className="font-headline font-bold text-base">GitIntel</span>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          {['Dashboard', 'History', 'Docs'].map(l => (
            <a key={l} href="#" className="text-sm text-[#8b949e] hover:text-white transition-colors font-body">{l}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="text-[#8b949e] hover:text-white transition-colors p-1.5 rounded hover:bg-[#30363d]" title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} className="text-xl" />
          </button>
          <button className="text-[#8b949e] hover:text-white transition-colors"><Icon name="settings" /></button>
          <div className="w-8 h-8 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center">
            <Icon name="person" className="text-[#8b949e]" fill />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative w-full max-w-5xl mx-auto px-6 pt-20 pb-16 text-center fade-up">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-6 bg-primary-container-low border border-primary-container-border rounded-full">
          <Icon name="bolt" className="text-primary text-sm" fill />
          <span className="text-primary text-xs font-code tracking-widest uppercase">Technical Intelligence v2.0</span>
        </div>

        <h1 className="font-display text-4xl md:text-5xl font-bold text-on-surface leading-tight mb-4" style={{ letterSpacing: '-0.02em' }}>
          Instant Repository Insights for<br />
          <span className="text-primary">High-Velocity</span> Teams
        </h1>
        <p className="text-on-surface-variant text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
          Bridge the gap between granular code analysis and architectural oversight.
          Paste any GitHub URL to unlock deep intelligence in seconds.
        </p>

        {/* URL input */}
        <div className="max-w-2xl mx-auto mb-4">
          <div className="input-glow flex items-center bg-surface-container-low border border-outline-variant rounded-xl p-2 focus-within:border-primary transition-all duration-300">
            <Icon name="link" className="text-outline ml-3 flex-shrink-0" />
            <input
              className="bg-transparent border-none focus:ring-0 w-full font-code text-sm text-on-surface px-3 placeholder-outline outline-none"
              placeholder="https://github.com/organization/repository"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && url.trim() && onAnalyze(url.trim())}
            />
            <button
              onClick={() => url.trim() && onAnalyze(url.trim())}
              disabled={loading || !url.trim()}
              className="flex items-center gap-2 bg-primary text-on-primary hover:brightness-95 disabled:opacity-40 text-sm font-bold px-5 py-2.5 rounded-lg transition-all flex-shrink-0 shadow-sm"
            >
              {loading ? <Spinner size={16} /> : <Icon name="summarize" className="text-base" />}
              {loading ? 'Analyzing…' : 'Quick Summary'}
            </button>
          </div>


          {/* Error */}
          {error && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-error-container-low border border-error-container-border rounded-lg text-left">
              <Icon name="warning" className="text-error text-base flex-shrink-0 mt-0.5" />
              <p className="text-error text-sm leading-relaxed">{error}</p>
            </div>
          )}

          {/* Load step */}
          {loading && loadStep && (
            <div className="mt-3 flex items-center gap-2 text-on-surface-variant text-sm">
              <Spinner size={15} /> <span className="font-code text-xs">{loadStep}</span>
            </div>
          )}
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-8 mb-12 opacity-60">
          {[['verified_user', 'Secure Analysis'], ['cloud_done', 'Real-time Data'], ['code', 'LLM Powered']].map(([ic, label]) => (
            <span key={label} className="flex items-center gap-1.5 text-on-surface-variant font-code text-xs tracking-widest uppercase">
              <Icon name={ic} className="text-base" /> {label}
            </span>
          ))}
        </div>

        {/* Example repos */}
        <div className="flex flex-wrap justify-center gap-2 mb-16">
          <span className="text-xs text-outline self-center font-code">Try:</span>
          {EXAMPLES.map(e => (
            <button key={e} onClick={() => setUrl(e)}
              className="text-xs px-3 py-1.5 bg-surface-container-low border border-outline-variant rounded-full text-on-surface-variant hover:border-primary hover:text-primary transition-all font-code">
              {e.replace('https://github.com/', '')}
            </button>
          ))}
        </div>

        {/* Feature bento grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
          {FEATURES.map(([icon, title, desc]) => (
            <div key={title} className="bg-surface-container-low border border-outline-variant rounded-xl p-5 card-hover">
              <div className="w-10 h-10 rounded-lg bg-primary-container-low flex items-center justify-center mb-3">
                <Icon name={icon} className="text-primary text-xl" />
              </div>
              <h3 className="font-headline font-semibold text-on-surface text-sm mb-1">{title}</h3>
              <p className="text-on-surface-variant text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ─── Repo stats hero bar ─────────────────────────────────────────────────────
function RepoHero({ meta, languages, techStack }) {
  const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0)
  const langBars = Object.entries(languages)
    .map(([l, b]) => ({ l, pct: Math.round((b / totalBytes) * 100) }))
    .sort((a, b) => b.pct - a.pct).slice(0, 7)

  return (
    <section className="bg-surface-container-low border-b border-outline-variant px-6 py-5">
      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <img src={meta.owner?.avatar_url} alt="" width={28} height={28} className="rounded-full border border-outline-variant" />
            <span className="text-on-surface-variant font-body text-sm">{meta.owner?.login} /</span>
            <h1 className="font-headline font-bold text-on-surface text-xl">{meta.name}</h1>
            <span className="px-2 py-0.5 border border-outline-variant text-on-surface-variant bg-transparent rounded-full font-code text-xs">
              {meta.private ? 'Private' : 'Public'}
            </span>
          </div>
          {meta.description && (
            <p className="text-on-surface-variant text-sm max-w-2xl leading-relaxed">{meta.description}</p>
          )}
          {/* Topic pills */}
          {meta.topics?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {meta.topics.slice(0, 8).map(t => (
                <span key={t} className="px-2 py-0.5 bg-primary-container-low text-primary border border-primary-container-border rounded-full font-code text-xs">{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <a href={meta.html_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high border border-outline-variant rounded-lg text-on-surface font-code text-xs hover:border-primary transition-colors">
            <Icon name="open_in_new" className="text-base" /> View on GitHub
          </a>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high border border-outline-variant rounded-lg text-on-surface font-code text-xs hover:border-primary transition-colors">
            <Icon name="star" className="text-base" fill /> {meta.stargazers_count?.toLocaleString()}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high border border-outline-variant rounded-lg text-on-surface font-code text-xs hover:border-primary transition-colors">
            <Icon name="fork_right" className="text-base" /> {meta.forks_count?.toLocaleString()}
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon="code" iconColor="text-primary" label="Main Language" value={meta.language} />
        <StatCard icon="info" iconColor="text-error" label="Open Issues" value={meta.open_issues_count?.toLocaleString()} />
        <StatCard icon="visibility" iconColor="text-primary" label="Watchers" value={meta.watchers_count?.toLocaleString()} />
        <StatCard icon="bolt" iconColor="text-tertiary" label="Intel Score" value="—" />
      </div>

      {/* Language bar */}
      {langBars.length > 0 && (
        <div>
          <div className="flex h-2 rounded-full overflow-hidden mb-2">
            {langBars.map(({ l, pct }) => (
              <div key={l} title={`${l} ${pct}%`} style={{ width: `${pct}%`, background: LANG_COLORS[l] || '#8b909f' }} />
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            {langBars.map(({ l, pct }) => (
              <span key={l} className="flex items-center gap-1.5 font-code text-xs text-on-surface-variant">
                <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: LANG_COLORS[l] || '#8b909f' }} />
                {l} <span className="text-outline">{pct}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tech stack */}
      {techStack.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {techStack.map(t => (
            <span key={t} className="px-2.5 py-0.5 bg-surface-container-high border border-outline-variant rounded font-code text-xs text-on-surface-variant">{t}</span>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────
function Overview({ summary, loading }) {
  return (
    <div className="fade-up">
      <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-surface-container border-b border-outline-variant flex items-center gap-2">
          <Icon name="auto_awesome" className="text-primary text-xl" />
          <span className="font-headline font-semibold text-base">AI Intelligence Overview</span>
          <span className="ml-auto font-code text-xs text-tertiary">GitIntel v2</span>
        </div>
        <div className="p-5">
          {loading && !summary && (
            <div className="space-y-3">
              {[80, 60, 90, 50, 70].map((w, i) => (
                <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}
          {!loading && !summary && (
            <p className="text-on-surface-variant text-sm">No overview available. Try analyzing the repository again.</p>
          )}
          {summary && <MD text={summary} streaming={loading} />}
        </div>
      </div>
    </div>
  )
}

// ─── File explorer tab ────────────────────────────────────────────────────────
function FileExplorer({ treeObj, totalFiles, treeLoading }) {
  return (
    <div className="fade-up">
      <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-surface-container border-b border-outline-variant flex items-center gap-2">
          <Icon name="folder_open" className="text-primary text-xl" />
          <span className="font-headline font-semibold text-base">Repository Tree</span>
          <span className="ml-auto font-code text-xs text-on-surface-variant">
            {treeLoading
              ? <span className="flex items-center gap-1.5"><Spinner size={12} /> Loading tree…</span>
              : `${totalFiles} files`}
          </span>
        </div>
        <div className="p-2 max-h-[560px] overflow-y-auto">
          {/* Show skeleton while tree is loading */}
          {treeLoading && <TreeSkeleton />}

          {/* Show real tree once loaded */}
          {!treeLoading && treeObj && Object.entries(treeObj)
            .sort(([, a], [, b]) => (a === null ? 1 : 0) - (b === null ? 1 : 0))
            .map(([k, v]) => <TreeNode key={k} name={k} node={v} depth={0} />)}

          {/* Empty state */}
          {!treeLoading && !treeObj && (
            <p className="text-on-surface-variant text-xs p-4 font-code">No files found.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Semantic search tab ──────────────────────────────────────────────────────
const SEARCH_SUGGESTIONS = [
  'How does authentication work?',
  'Where are API calls handled?',
  'Database models & schema',
  'Error handling patterns',
  'Main entry point',
]

function SemanticSearch({ context }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const search = async (q = query) => {
    if (!q.trim()) return
    setLoading(true); setResults([]); setErr('')
    try {
      const raw = await completeAI(
        'You are a semantic code search engine. Return ONLY a valid JSON array, no markdown.',
        `Repository:\n${context}\n\nQuery: "${q}"\n\nReturn JSON array of 4:\n[{"file":"path/to/file","relevance":"high|medium","explanation":"why relevant","snippet":"short code or comment"}]`
      )
      setResults(JSON.parse(raw.replace(/```json|```/g, '').trim()))
    } catch {
      setErr('Could not parse results — try rephrasing.')
    }
    setLoading(false)
  }

  return (
    <div className="fade-up space-y-4">
      <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-surface-container border-b border-outline-variant flex items-center gap-2">
          <Icon name="manage_search" className="text-primary text-xl" />
          <span className="font-headline font-semibold text-base">Semantic Code Search</span>
        </div>
        <div className="p-5">
          <div className="input-glow flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg p-2 focus-within:border-primary transition-all mb-4">
            <Icon name="search" className="text-outline ml-2 flex-shrink-0" />
            <input
              className="bg-transparent border-none focus:ring-0 w-full font-code text-sm text-on-surface px-3 placeholder-outline outline-none"
              placeholder="How does authentication work? Where are API calls?"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
            <button onClick={() => search()} disabled={loading}
              className="flex items-center gap-1.5 bg-primary text-on-primary hover:brightness-95 disabled:opacity-40 text-xs font-bold px-4 py-2 rounded-md transition-all flex-shrink-0 shadow-sm">
              {loading ? <Spinner size={14} /> : <Icon name="search" className="text-base" />}
              Search
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {SEARCH_SUGGESTIONS.map(s => (
              <button key={s} onClick={() => { setQuery(s); search(s) }}
                className="text-xs px-3 py-1.5 bg-surface-container-high border border-outline-variant rounded-full text-on-surface-variant hover:border-primary hover:text-primary transition-all font-code">
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {err && <div className="text-error text-sm font-code p-3 bg-error-container-low border border-error-container-border rounded-lg">⚠ {err}</div>}

      {results.map((r, i) => (
        <div key={i} className="bg-surface-container-low border border-outline-variant rounded-xl p-5 card-hover">
          <div className="flex items-center gap-3 mb-3">
            <Icon name="description" className="text-primary text-xl flex-shrink-0" />
            <span className="font-code text-sm text-primary flex-1">{r.file}</span>
            <span className={`px-2 py-0.5 rounded-full font-code text-xs border ${
              r.relevance === 'high'
                ? 'bg-tertiary-container-low text-tertiary border-tertiary-container-border'
                : 'bg-primary-container-low text-primary border-primary-container-border'
            }`}>{r.relevance}</span>
          </div>
          <p className="text-on-surface-variant text-sm leading-relaxed mb-3">{r.explanation}</p>
          {r.snippet && <pre className="bg-surface-container-lowest border border-outline-variant rounded-lg p-3 font-code text-xs text-tertiary overflow-x-auto whitespace-pre">{r.snippet}</pre>}
        </div>
      ))}
    </div>
  )
}

// ─── AI Chat tab ──────────────────────────────────────────────────────────────
const CHAT_STARTERS = [
  'Explain the main architecture',
  'How do I contribute to this project?',
  'What are the key dependencies?',
  'Walk me through the authentication flow',
]

function AIChat({ context }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = async (text = input) => {
    if (!text.trim() || loading) return
    setInput('')
    setMessages(p => [...p, { role: 'user', content: text }, { role: 'assistant', content: '', streaming: true }])
    setLoading(true)
    let ai = ''
    try {
      const hist = messages.map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`).join('\n')
      await streamAI(
        `You are GitIntel's expert code assistant. You have full repo context:\n\n${context}`,
        `${hist ? hist + '\n' : ''}Human: ${text}`,
        t => { ai = t; setMessages(p => { const u = [...p]; u[u.length - 1] = { role: 'assistant', content: t, streaming: true }; return u }) }
      )
      setMessages(p => { const u = [...p]; u[u.length - 1] = { role: 'assistant', content: ai, streaming: false }; return u })
    } catch (e) {
      setMessages(p => { const u = [...p]; u[u.length - 1] = { role: 'assistant', content: `Error: ${e.message}`, streaming: false }; return u })
    }
    setLoading(false)
  }

  return (
    <div className="fade-up flex flex-col gap-3" style={{ height: 'calc(100vh - 280px)', minHeight: 500 }}>
      {/* Messages */}
      <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden flex flex-col flex-1">
        <div className="px-5 py-3 bg-surface-container border-b border-outline-variant flex items-center gap-2 flex-shrink-0">
          <Icon name="chat" className="text-primary text-xl" />
          <span className="font-headline font-semibold text-base">Repository Chat</span>
          <span className="ml-auto flex items-center gap-1.5 font-code text-xs text-tertiary">
            <span className="w-1.5 h-1.5 bg-tertiary rounded-full inline-block" /> Online
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-primary-container-low rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="chat" className="text-primary text-2xl" />
              </div>
              <p className="text-on-surface font-headline font-semibold mb-1">Chat with this repo</p>
              <p className="text-on-surface-variant text-sm mb-6">Ask anything about the codebase, architecture, or how to contribute.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {CHAT_STARTERS.map(q => (
                  <button key={q} onClick={() => send(q)}
                    className="text-xs px-3 py-2 bg-primary-container-low border border-primary-container-border rounded-lg text-primary hover:bg-primary-container-low/85 transition-colors font-code">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                m.role === 'user' ? 'bg-[#2F81F7] text-white' : 'bg-surface-container-highest border border-outline-variant'
              }`}>
                {m.role === 'user' ? <Icon name="person" className="text-base" fill /> : <Icon name="auto_awesome" className="text-primary text-base" fill />}
              </div>
              <div className={`max-w-[82%] px-4 py-3 rounded-xl border ${
                m.role === 'user'
                  ? 'bg-chat-user-bg border-chat-user-border rounded-tr-sm'
                  : 'bg-surface-container border-outline-variant rounded-tl-sm'
              }`}>
                {m.role === 'assistant'
                  ? <MD text={m.content || '…'} streaming={m.streaming} />
                  : <p className="text-sm text-on-surface leading-relaxed">{m.content}</p>}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="input-glow flex items-center bg-surface-container-low border border-outline-variant rounded-xl p-2 focus-within:border-primary transition-all flex-shrink-0">
        <input
          className="bg-transparent border-none focus:ring-0 w-full font-code text-sm text-on-surface px-3 placeholder-outline outline-none"
          placeholder="Ask about the codebase…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          className="flex items-center gap-1.5 bg-primary text-on-primary hover:brightness-95 disabled:opacity-40 text-sm font-bold px-4 py-2.5 rounded-lg transition-all flex-shrink-0 shadow-sm">
          {loading ? <Spinner size={16} /> : <Icon name="send" className="text-base" />}
        </button>
      </div>
    </div>
  )
}

// ─── Architecture tab ─────────────────────────────────────────────────────────
const ARCH_LAYERS = [
  { label: 'Presentation',   color: 'var(--presentation-color)', bg: 'var(--presentation-bg)', border: 'var(--presentation-border)', items: ['UI Components', 'State Management', 'Routing', 'API Client'] },
  { label: 'Application',    color: 'var(--application-color)', bg: 'var(--application-bg)', border: 'var(--application-border)', items: ['Business Logic', 'Auth / AuthZ', 'Data Transform', 'Event System'] },
  { label: 'Infrastructure', color: 'var(--infrastructure-color)', bg: 'var(--infrastructure-bg)', border: 'var(--infrastructure-border)', items: ['REST / GraphQL', 'Middleware', 'Rate Limiting', 'Caching'] },
  { label: 'Persistence',    color: 'var(--persistence-color)', bg: 'var(--persistence-bg)', border: 'var(--persistence-border)', items: ['Database', 'File Storage', 'Search Index', 'Message Queue'] },
]

function Architecture({ insight, loading }) {
  return (
    <div className="fade-up">
      <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-surface-container border-b border-outline-variant flex items-center gap-2">
          <Icon name="schema" className="text-primary text-xl" />
          <span className="font-headline font-semibold text-base">System Architecture</span>
        </div>
        <div className="p-5">
          {loading && !insight && (
            <div className="space-y-2 mb-6">
              {[90, 70, 80].map((w, i) => <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />)}
            </div>
          )}
          {insight && (
            <p className="text-on-surface-variant text-sm leading-relaxed mb-6 pb-5 border-b border-outline-variant">{insight}</p>
          )}
          <div className="space-y-3">
            {ARCH_LAYERS.map((l, i) => (
              <div key={l.label}>
                <div className="border rounded-xl overflow-hidden" style={{ borderColor: l.border }}>
                  <div className="px-4 py-2 flex items-center gap-2 border-b" style={{ background: l.bg, borderColor: l.border }}>
                    <span className="font-code text-xs font-bold tracking-widest uppercase" style={{ color: l.color }}>{l.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 p-4">
                    {l.items.map(it => (
                      <span key={it} className="px-3 py-1 rounded-full font-code text-xs border" style={{ background: l.bg, color: l.color, borderColor: l.border }}>{it}</span>
                    ))}
                  </div>
                </div>
                {i < ARCH_LAYERS.length - 1 && (
                  <div className="text-center text-outline text-xs py-1">↕</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Bug analysis tab ─────────────────────────────────────────────────────────
function BugAnalysis({ report, loading }) {
  return (
    <div className="fade-up">
      <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-surface-container border-b border-outline-variant flex items-center gap-2">
          <Icon name="bug_report" className="text-error text-xl" />
          <span className="font-headline font-semibold text-base">AI Code Analysis</span>
          <span className="ml-auto px-2 py-0.5 bg-error-container-low text-error border border-error-container-border rounded-full font-code text-xs">Security Scan</span>
        </div>
        <div className="p-5">
          {loading && !report && (
            <div className="space-y-2">
              {[85, 65, 75, 55, 80].map((w, i) => <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />)}
            </div>
          )}
          {report && <MD text={report} streaming={loading} />}
        </div>
      </div>
    </div>
  )
}

// ─── Right sidebar (ToC / meta) ───────────────────────────────────────────────
function RightPanel({ meta, tab, setTab }) {
  const sections = NAV_ITEMS.map(n => ({ id: n.id, label: n.label, icon: n.icon }))
  return (
    <aside className="hidden xl:flex flex-col w-60 flex-shrink-0 space-y-4">
      <div className="bg-surface-container-low border border-outline-variant rounded-xl overflow-hidden sticky top-20">
        <div className="px-4 py-3 border-b border-outline-variant">
          <span className="font-code text-xs text-on-surface-variant uppercase tracking-widest">Dashboard</span>
        </div>
        <ul className="p-2 space-y-0.5">
          {sections.map(s => (
            <li key={s.id}>
              <button onClick={() => setTab(s.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors font-code text-xs tracking-wide ${
                  tab === s.id
                    ? 'bg-primary-container-low text-primary border-l-2 border-primary'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
                }`}>
                <Icon name={s.icon} className="text-base" fill={tab === s.id} />
                {s.label}
              </button>
            </li>
          ))}
        </ul>
        {meta && (
          <div className="m-3 p-3 bg-surface-container-high rounded-xl border border-outline-variant">
            <span className="font-code text-xs text-on-surface-variant uppercase tracking-widest block mb-2">Intelligence Report</span>
            <p className="text-on-surface-variant text-xs leading-relaxed mb-3">Last deep-scan completed. Data sourced from GitHub API + Claude AI.</p>
            <button className="w-full py-1.5 px-3 border border-primary text-primary rounded font-code text-xs hover:bg-primary-container-low transition-colors">
              Generate PDF
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}

// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [loading, setLoading] = useState(false)
  const [loadStep, setLoadStep] = useState('')
  const [error, setError] = useState('')

  const [repoMeta, setRepoMeta] = useState(null)
  const [rawTree, setRawTree] = useState([])
  const [treeObj, setTreeObj] = useState(null)
  const [treeLoading, setTreeLoading] = useState(false)   // ← new: tracks phase-2 tree loading
  const [languages, setLanguages] = useState({})
  const [techStack, setTechStack] = useState([])
  const [readme, setReadme] = useState('')

  const [tab, setTab] = useState('overview')

  const [summary, setSummary] = useState('')
  const [sumLoading, setSumLoading] = useState(false)
  const [archText, setArchText] = useState('')
  const [archLoading, setArchLoading] = useState(false)
  const [bugText, setBugText] = useState('')
  const [bugLoading, setBugLoading] = useState(false)

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const ctx = repoMeta ? buildContext(repoMeta, techStack, rawTree, readme) : ''

  const handleAnalyze = async (url) => {
    const parsed = parseGitHubUrl(url)
    if (!parsed) { setError('Please paste a valid GitHub URL — e.g. https://github.com/facebook/react'); return }
    setError(''); setLoading(true)
    setRepoMeta(null); setSummary(''); setArchText(''); setBugText('')
    setRawTree([]); setTreeObj(null); setReadme('')

    try {
      // ── Phase 1: fetch meta + languages (fast, ~300-600ms) ──────────────
      setLoadStep('Fetching repository…')
      const { meta, languages: langs } = await fetchRepoMeta(parsed.owner, parsed.repo)

      // Compute tech stack from languages alone (no tree yet — enough for most detections)
      const partialStack = detectStack(langs, [])
      setRepoMeta(meta)
      setLanguages(langs)
      setTechStack(partialStack)
      setLoading(false)        // ← landing spinner off; skeleton is now visible
      setLoadStep('')

      // ── Phase 2: fetch tree + readme in background (slow, ~1-3s) ────────
      setTreeLoading(true)
      setSumLoading(true)
      setTab('overview')

      // Fire tree+readme fetch and AI summary in parallel
      const detailsPromise = fetchRepoDetails(parsed.owner, parsed.repo)
        .then(({ readme: rm, tree }) => {
          const stack = detectStack(langs, tree)
          setTechStack(stack)
          setRawTree(tree)
          setReadme(rm)
          setTreeObj(buildTreeObj(tree.filter(n => n.type === 'blob').map(n => n.path).slice(0, 150)))
          setTreeLoading(false)
          return { readme: rm, tree, stack }
        })
        .catch(err => {
          console.warn('Tree/readme fetch failed:', err)
          setTreeLoading(false)
          return { readme: '', tree: [], stack: partialStack }
        })

      // AI summary — use what we have from phase 1, update when details arrive
      const shortCtx = `Repo: ${meta.full_name}
Description: ${meta.description || 'None'}
Language: ${meta.language} | Stars: ${meta.stargazers_count} | Forks: ${meta.forks_count}
Stack: ${partialStack.join(', ')}`

      // Start streaming with partial context immediately
      try {
        // Wait briefly for details to enrich context, but cap at 800ms so AI starts fast
        const raceResult = await Promise.race([
          detailsPromise,
          new Promise(res => setTimeout(() => res(null), 800))
        ])

        const enrichedCtx = raceResult
          ? `${shortCtx}\nTop files: ${raceResult.tree.filter(n => n.type === 'blob').map(n => n.path).slice(0, 80).join(', ')}\nREADME (full):\n${raceResult.readme.slice(0, 2500)}`
          : shortCtx

        await streamAI(
          'You are a senior software engineer doing a deep technical review. Write detailed, insightful analysis. Use markdown formatting with **bold** section headers. Be thorough and specific — mention actual file names, patterns, and technologies you see.',
          `Analyze this GitHub repository in depth and produce a comprehensive intelligence report:\n\n${enrichedCtx}\n\n## 🎯 What It Does\nExplain the purpose, problem it solves, and target users in 3-4 sentences.\n\n## 🏗️ Architecture & Design\nDescribe the overall architecture, design patterns used, how components interact, and folder structure in 4-5 sentences.\n\n## ✨ Key Features\nList 6-8 notable features or capabilities with a brief explanation of each.\n\n## 🛠️ Tech Stack & Dependencies\nBreak down the technologies, frameworks, libraries used and why they matter for this project.\n\n## 📁 Codebase Structure\nWalk through the important files/folders and what role each plays.\n\n## ⚡ Code Quality & Best Practices\nAssess code organization, patterns, test coverage, documentation quality, and any notable strengths or concerns.\n\n## 🚀 Getting Started\nBriefly explain how someone would set up and run this project.\n\n## 💡 Verdict\nOverall assessment: is this production-ready, a learning project, or a prototype? Rate it 1-10 with justification.`,
          t => setSummary(t),
          2000
        )
      } catch (aiErr) {
        setSummary(`**Overview generation failed**\n\nCould not generate AI summary: ${aiErr.message}\n\nThe repository data was loaded successfully. You can still use File Explorer, Search, and Chat tabs.`)
      } finally {
        setSumLoading(false)
      }

      // Make sure details are done (they may still be in-flight)
      await detailsPromise

    } catch (e) {
      setError(e.message || 'Something went wrong. Check the URL and try again.')
      setLoading(false)
      setLoadStep('')
      setTreeLoading(false)
      setSumLoading(false)
    }
  }

  // Build a short context for lazy tabs
  const shortCtx = repoMeta ? `Repo: ${repoMeta.full_name}
Description: ${repoMeta.description || 'None'}
Language: ${repoMeta.language} | Stack: ${techStack.join(', ')}
Top files: ${rawTree.filter(n => n.type === 'blob').map(n => n.path).slice(0, 80).join(', ')}
README: ${readme.slice(0, 2000)}` : ''

  useEffect(() => {
    if (tab === 'architecture' && repoMeta && !archText && !archLoading) {
      setArchLoading(true)
      streamAI(
        'You are a senior software architect. Write a detailed, insightful architectural analysis.',
        `Analyze the system architecture of this repository:\n\n${shortCtx}\n\nDescribe: the overall architectural pattern (MVC, microservices, monolith, etc.), how the layers interact, key design decisions, data flow, and any architectural strengths or concerns you notice. Be specific and thorough — 5-7 sentences.`,
        t => setArchText(t),
        800
      ).catch(e => setArchText(`Architecture analysis failed: ${e.message}`))
        .finally(() => setArchLoading(false))
    }
    if (tab === 'bugs' && repoMeta && !bugText && !bugLoading) {
      setBugLoading(true)
      streamAI(
        'You are an expert code reviewer and security engineer. Be specific, detailed, and actionable.',
        `Perform a thorough code quality and security analysis of this repository:\n\n${shortCtx}\n\n## 🐛 Potential Bugs\nList 4-5 specific potential bugs or logic issues with file references where possible.\n\n## 🔒 Security Concerns\nList 4-5 security vulnerabilities or risks (injection, auth issues, exposed secrets, etc.).\n\n## 📊 Code Quality Assessment\nAssess: naming conventions, code organization, error handling, DRY principles, and documentation quality in 3-4 sentences.\n\n## 🧪 Testing & Reliability\nComment on test coverage, missing tests, and reliability concerns.\n\n## 🔧 Top Improvements\nList the 5 most impactful improvements the team should prioritize.\n\n## 📈 Maintainability Score: X/10\nJustify the score in 2 sentences.`,
        t => setBugText(t),
        1500
      ).catch(e => setBugText(`Code analysis failed: ${e.message}`))
        .finally(() => setBugLoading(false))
    }
  }, [tab, repoMeta])

  const handleReset = () => {
    setRepoMeta(null); setSummary(''); setArchText(''); setBugText('')
    setRawTree([]); setTreeObj(null); setLanguages({}); setTechStack([])
    setReadme(''); setError(''); setTab('overview'); setTreeLoading(false)
  }

  if (!repoMeta) {
    return <Landing onAnalyze={handleAnalyze} loading={loading} loadStep={loadStep} error={error} theme={theme} toggleTheme={toggleTheme} />
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background">
      <TopBar repoMeta={repoMeta} onNew={handleReset} tab={tab} setTab={setTab} theme={theme} toggleTheme={toggleTheme} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar tab={tab} setTab={setTab} onNew={handleReset} />

        <main className="flex-1 overflow-y-auto">
          <RepoHero meta={repoMeta} languages={languages} techStack={techStack} />

          <div className="flex gap-6 p-6">
            {/* Main content */}
            <div className="flex-1 min-w-0">
              {tab === 'overview'     && <Overview    summary={summary}   loading={sumLoading} />}
              {tab === 'files'        && <FileExplorer treeObj={treeObj}   totalFiles={rawTree.filter(n => n.type === 'blob').length} treeLoading={treeLoading} />}
              {tab === 'search'       && <SemanticSearch context={ctx} />}
              {tab === 'chat'         && <AIChat        context={ctx} />}
              {tab === 'architecture' && <Architecture  insight={archText} loading={archLoading} />}
              {tab === 'bugs'         && <BugAnalysis   report={bugText}   loading={bugLoading} />}
            </div>

            <RightPanel meta={repoMeta} tab={tab} setTab={setTab} />
          </div>
        </main>
      </div>
    </div>
  )
}
