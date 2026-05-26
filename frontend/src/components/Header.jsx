import { IconGitHub } from './UI.jsx'

export default function Header({ repoLoaded, onReset }) {
  return (
    <header style={{
      borderBottom: '1px solid rgba(255,255,255,0.065)',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      background: 'rgba(7,7,15,0.94)',
      backdropFilter: 'blur(20px)',
    }}>
      <div style={{
        maxWidth: 1060,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 30, height: 30,
            background: 'linear-gradient(135deg,#4a88ff,#6030ef)',
            borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15,
          }}>◈</div>
          <span style={{
            fontWeight: 800, fontSize: 17.5,
            background: 'linear-gradient(135deg,#fff,#8898ff)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>GitIntel</span>
          <span style={{
            fontSize: 10, padding: '2px 7px',
            background: 'rgba(74,136,255,0.14)',
            color: '#6aabff',
            border: '1px solid rgba(74,136,255,0.3)',
            borderRadius: 20,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}>AI</span>
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'rgba(200,200,220,0.4)', display: 'flex' }}
          >
            <IconGitHub size={20} />
          </a>
          {repoLoaded && (
            <button className="btn btn-ghost" onClick={onReset}
              style={{ fontSize: 12, padding: '6px 13px' }}>
              ← New Repo
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
