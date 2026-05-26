import { useState, useEffect } from 'react'

import Header       from './components/Header.jsx'
import Landing      from './components/Landing.jsx'
import RepoHeader   from './components/RepoHeader.jsx'
import Overview     from './components/Overview.jsx'
import FileTree     from './components/FileTree.jsx'
import SemanticSearch from './components/SemanticSearch.jsx'
import AIChat       from './components/AIChat.jsx'
import Architecture from './components/Architecture.jsx'
import BugAnalysis  from './components/BugAnalysis.jsx'

import { fetchRepo, streamAI } from './api/backend.js'
import { parseGitHubUrl, detectStack, buildTreeObj, buildContext } from './utils/helpers.js'

const TABS = [
  { id: 'overview',      label: 'Overview',      ic: '◈' },
  { id: 'files',         label: 'Files',          ic: '⌂' },
  { id: 'search',        label: 'Search',         ic: '⌕' },
  { id: 'chat',          label: 'AI Chat',        ic: '◎' },
  { id: 'architecture',  label: 'Architecture',   ic: '⊞' },
  { id: 'bugs',          label: 'Analysis',       ic: '⚠' },
]

export default function App() {
  // ── Loading / error state ──────────────────────────────────────────────────
  const [loading,  setLoading]  = useState(false)
  const [loadStep, setLoadStep] = useState('')
  const [error,    setError]    = useState('')

  // ── Repo data ──────────────────────────────────────────────────────────────
  const [repoMeta,  setRepoMeta]  = useState(null)
  const [rawTree,   setRawTree]   = useState([])
  const [treeObj,   setTreeObj]   = useState(null)
  const [languages, setLanguages] = useState({})
  const [techStack, setTechStack] = useState([])
  const [readme,    setReadme]    = useState('')

  // ── Tab ────────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('overview')

  // ── Feature states ─────────────────────────────────────────────────────────
  const [summary,     setSummary]     = useState('')
  const [sumLoading,  setSumLoading]  = useState(false)
  const [archText,    setArchText]    = useState('')
  const [archLoading, setArchLoading] = useState(false)
  const [bugText,     setBugText]     = useState('')
  const [bugLoading,  setBugLoading]  = useState(false)

  // ── Context string shared with AI tabs ─────────────────────────────────────
  const ctx = repoMeta
    ? buildContext(repoMeta, techStack, rawTree, readme)
    : ''

  // ── Main analyze flow ───────────────────────────────────────────────────────
  const handleAnalyze = async (url, token) => {
    const parsed = parseGitHubUrl(url)
    if (!parsed) {
      setError('Please paste a valid GitHub URL — e.g. https://github.com/facebook/react')
      return
    }

    setError(''); setLoading(true)
    setRepoMeta(null); setSummary(''); setArchText(''); setBugText('')

    try {
      setLoadStep('Fetching repository data…')
      const data = await fetchRepo(parsed.owner, parsed.repo, token)

      setRepoMeta(data.meta)
      setLanguages(data.languages)
      setReadme(data.readme)
      setRawTree(data.tree)

      const stack = detectStack(data.languages, data.tree)
      setTechStack(stack)
      setTreeObj(buildTreeObj(
        data.tree.filter(n => n.type === 'blob').map(n => n.path).slice(0, 150)
      ))

      // Kick off AI summary immediately
      setLoadStep('Generating AI summary…')
      setSumLoading(true)
      const summaryCtx = buildContext(data.meta, stack, data.tree, data.readme)
      await streamAI(
        'You are a senior engineer summarizing GitHub repos. Be concise and specific.',
        `Analyze this repo:\n\n${summaryCtx}\n\nProvide:\n1. **What it does** — one clear paragraph\n2. **Architecture** — how it is structured\n3. **Key features** — bullet list\n4. **Tech choices** — why the stack makes sense\n5. **Code quality** — honest assessment`,
        t => setSummary(t)
      )
      setSumLoading(false)
      setTab('overview')
    } catch (e) {
      setError(e.message || 'Something went wrong. Check the URL and try again.')
    } finally {
      setLoading(false); setLoadStep('')
    }
  }

  // ── Lazy-load Architecture tab ──────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'architecture' && repoMeta && !archText && !archLoading) {
      setArchLoading(true)
      streamAI(
        'You are a software architect. Give a crisp 3–4 sentence architectural description.',
        `Describe the architecture of:\n\n${ctx}`,
        t => setArchText(t)
      ).finally(() => setArchLoading(false))
    }
  }, [tab, repoMeta])

  // ── Lazy-load Bug analysis tab ──────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'bugs' && repoMeta && !bugText && !bugLoading) {
      setBugLoading(true)
      streamAI(
        'You are a senior code reviewer. Be specific and practical.',
        `Analyze:\n\n${ctx}\n\n1. **Potential Bugs**\n2. **Security Concerns**\n3. **Code Smells**\n4. **Dependency Risks**\n5. **Maintainability Score** /10 with justification`,
        t => setBugText(t),
        1400
      ).finally(() => setBugLoading(false))
    }
  }, [tab, repoMeta])

  // ── Reset ────────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setRepoMeta(null); setSummary(''); setArchText(''); setBugText('')
    setRawTree([]); setTreeObj(null); setLanguages({}); setTechStack([])
    setReadme(''); setError(''); setTab('overview')
  }

  return (
    <>
      <Header repoLoaded={!!repoMeta} onReset={handleReset} />

      <main style={{ maxWidth: 1060, margin: '0 auto', padding: '0 24px 80px' }}>
        {/* Landing page */}
        {!repoMeta && (
          <Landing
            onAnalyze={handleAnalyze}
            loading={loading}
            loadStep={loadStep}
            error={error}
          />
        )}

        {/* Repo dashboard */}
        {repoMeta && (
          <div style={{ paddingTop: 26, animation: 'up .3s ease' }}>
            <RepoHeader meta={repoMeta} languages={languages} techStack={techStack} />

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 22, paddingBottom: 2 }}>
              {TABS.map(t => (
                <button
                  key={t.id}
                  className={`tab ${tab === t.id ? 'active' : 'inactive'}`}
                  onClick={() => setTab(t.id)}
                >
                  <span>{t.ic}</span> {t.label}
                </button>
              ))}
            </div>

            {/* Tab panels */}
            {tab === 'overview'     && <Overview     summary={summary}   loading={sumLoading} />}
            {tab === 'files'        && <FileTree      treeObj={treeObj}   totalFiles={rawTree.filter(n => n.type === 'blob').length} />}
            {tab === 'search'       && <SemanticSearch context={ctx} />}
            {tab === 'chat'         && <AIChat         context={ctx} />}
            {tab === 'architecture' && <Architecture  insight={archText}  loading={archLoading} />}
            {tab === 'bugs'         && <BugAnalysis   report={bugText}    loading={bugLoading} />}
          </div>
        )}
      </main>
    </>
  )
}
