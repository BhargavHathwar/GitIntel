// ── GitHub URL parser ────────────────────────────────────────────────────────
export function parseGitHubUrl(raw) {
  const cleaned = raw.trim().replace(/\/$/, '')
  const m = cleaned.match(/github\.com[/:]([^/\s?#]+)\/([^/\s?#]+)/)
  if (!m) return null
  return { owner: m[1], repo: m[2].replace(/\.git$/, '') }
}

// ── Tech stack detector ──────────────────────────────────────────────────────
export function detectStack(languages = {}, tree = []) {
  const paths = tree.map(n => (n.path || '').toLowerCase())
  const has = (...pats) => pats.some(p => paths.some(f => f.includes(p)))
  const techs = []

  if (languages.TypeScript) techs.push('TypeScript')
  if (languages.JavaScript || languages.TypeScript) {
    if (has('next.config'))       techs.push('Next.js')
    else if (has('vite.config'))  techs.push('Vite')
    if (has('react', '.jsx'))     techs.push('React')
    if (has('tailwind'))          techs.push('Tailwind CSS')
    if (has('express'))           techs.push('Express')
    if (!techs.includes('Next.js') && !techs.includes('Vite')) techs.push('Node.js')
  }
  if (languages.Python) {
    techs.push('Python')
    if (has('fastapi'))       techs.push('FastAPI')
    else if (has('django'))   techs.push('Django')
    else if (has('flask'))    techs.push('Flask')
  }
  if (languages.Go)       techs.push('Go')
  if (languages.Rust)     techs.push('Rust')
  if (languages.Java)     techs.push('Java')
  if (languages['C++'])   techs.push('C++')
  if (has('docker'))                        techs.push('Docker')
  if (has('kubernetes', '.k8s', 'helm'))    techs.push('Kubernetes')
  if (has('prisma'))                        techs.push('Prisma')
  if (has('mongo'))                         techs.push('MongoDB')
  if (has('postgres', '/pg'))               techs.push('PostgreSQL')
  if (has('.github/workflows'))             techs.push('GitHub Actions')
  if (has('terraform'))                     techs.push('Terraform')

  return [...new Set(techs)].slice(0, 12)
}

// ── Nested tree builder ──────────────────────────────────────────────────────
export function buildTreeObj(paths) {
  const root = {}
  for (const p of paths) {
    const parts = p.split('/')
    let cur = root
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        cur[part] = null
      } else {
        if (!cur[part] || cur[part] === null) cur[part] = {}
        cur = cur[part]
      }
    })
  }
  return root
}

// ── Build plain text context string sent to every AI prompt ─────────────────
export function buildContext(meta, techStack, tree, readme) {
  return `Repository: ${meta.full_name}
Description: ${meta.description || 'None'}
Primary language: ${meta.language}
Stars: ${meta.stargazers_count} | Forks: ${meta.forks_count}
Tech stack: ${techStack.join(', ')}
Topics: ${(meta.topics || []).join(', ')}
Files (first 120):
${tree
    .filter(n => n.type === 'blob')
    .map(n => n.path)
    .slice(0, 120)
    .join('\n')}
README (first 3000 chars):
${(readme || '').slice(0, 3000)}`
}

// ── Language colours (same as GitHub) ───────────────────────────────────────
export const LANG_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python:     '#3572A5',
  Go:         '#00ADD8',
  Rust:       '#dea584',
  Java:       '#b07219',
  'C++':      '#f34b7d',
  Ruby:       '#701516',
  CSS:        '#563d7c',
  HTML:       '#e34c26',
  Shell:      '#89e051',
  Kotlin:     '#A97BFF',
  Swift:      '#F05138',
  Dart:       '#00B4AB',
}
