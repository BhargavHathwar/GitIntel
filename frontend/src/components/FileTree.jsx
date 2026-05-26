import { useState } from 'react'
import { LANG_COLORS } from '../utils/helpers.js'
import { Card, SectionLabel } from './UI.jsx'

function TreeNode({ name, node, depth }) {
  const isDir = node && typeof node === 'object'
  const [open, setOpen] = useState(depth < 2)
  const ext      = name.split('.').pop()
  const dotColor = isDir ? '#e8a045' : (LANG_COLORS[ext] || 'rgba(180,180,210,0.35)')

  return (
    <div>
      <div
        onClick={() => isDir && setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 8px',
          paddingLeft: 8 + depth * 14,
          borderRadius: 5,
          cursor: isDir ? 'pointer' : 'default',
          userSelect: 'none',
          transition: 'background .12s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.045)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ color: dotColor, fontSize: 12, width: 14, flexShrink: 0, textAlign: 'center' }}>
          {isDir ? (open ? '▾' : '▸') : '·'}
        </span>
        <span style={{ fontFamily: 'monospace', fontSize: 12.5, color: isDir ? '#dde0f0' : 'rgba(190,195,225,0.68)' }}>
          {name}
        </span>
      </div>

      {isDir && open && (
        Object.entries(node)
          .sort(([, a], [, b]) => (a === null ? 1 : 0) - (b === null ? 1 : 0))
          .map(([k, v]) => <TreeNode key={k} name={k} node={v} depth={depth + 1} />)
      )}
    </div>
  )
}

export default function FileTree({ treeObj, totalFiles }) {
  return (
    <Card className="fade-up">
      <SectionLabel>Repository Tree · {totalFiles} files</SectionLabel>
      <div style={{ maxHeight: 520, overflowY: 'auto' }}>
        {treeObj && Object.entries(treeObj)
          .sort(([, a], [, b]) => (a === null ? 1 : 0) - (b === null ? 1 : 0))
          .map(([k, v]) => <TreeNode key={k} name={k} node={v} depth={0} />)
        }
      </div>
    </Card>
  )
}
