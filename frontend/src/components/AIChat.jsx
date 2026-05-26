import { useState, useRef, useEffect } from 'react'
import { Spinner, MD } from './UI.jsx'
import { streamAI } from '../api/backend.js'

const STARTERS = [
  'Explain the main architecture',
  'How do I contribute?',
  'What are the key dependencies?',
  'Walk me through the auth flow',
]

export default function AIChat({ context }) {
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (text = input) => {
    if (!text.trim() || loading) return
    setInput('')
    const userMsg = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', streaming: true }])
    setLoading(true)

    try {
      const history = messages
        .map(m => `${m.role === 'user' ? 'Human' : 'Assistant'}: ${m.content}`)
        .join('\n')

      let aiText = ''
      await streamAI(
        `You are GitIntel's expert code assistant. You have full context of the repo below.\n\n${context}`,
        `${history ? history + '\n' : ''}Human: ${text}`,
        (partial) => {
          aiText = partial
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: 'assistant', content: partial, streaming: true }
            return updated
          })
        }
      )
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: aiText, streaming: false }
        return updated
      })
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: `Error: ${e.message}`, streaming: false }
        return updated
      })
    }
    setLoading(false)
  }

  return (
    <div className="fade-up">
      {/* Message window */}
      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ height: 440, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '55px 20px', color: 'rgba(200,200,220,0.28)' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>◎</div>
              <div style={{ fontSize: 15, marginBottom: 6, color: 'rgba(200,200,220,0.42)' }}>Chat with this repo</div>
              <div style={{ fontSize: 13, marginBottom: 20 }}>Ask anything about the codebase</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {STARTERS.map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    style={{
                      fontSize: 12, padding: '6px 12px',
                      background: 'rgba(74,136,255,0.1)',
                      border: '1px solid rgba(74,136,255,0.22)',
                      borderRadius: 20, color: '#6aabff',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >{q}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                display: 'flex', gap: 10,
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                animation: 'up .18s ease',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                background: m.role === 'user'
                  ? 'linear-gradient(135deg,#4a88ff,#6030ef)'
                  : 'rgba(255,255,255,0.065)',
              }}>
                {m.role === 'user' ? 'U' : '◈'}
              </div>

              {/* Bubble */}
              <div style={{
                maxWidth: '83%', padding: '9px 13px',
                borderRadius: m.role === 'user' ? '13px 4px 13px 13px' : '4px 13px 13px 13px',
                background: m.role === 'user' ? 'rgba(74,136,255,0.16)' : 'rgba(255,255,255,0.038)',
                border: `1px solid ${m.role === 'user' ? 'rgba(74,136,255,0.26)' : 'rgba(255,255,255,0.068)'}`,
              }}>
                {m.role === 'assistant'
                  ? <div className={m.streaming ? 'cursor' : ''}><MD text={m.content || '…'} /></div>
                  : <p style={{ margin: 0, fontSize: 13.5, color: '#dde0f0', lineHeight: 1.65 }}>{m.content}</p>
                }
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div style={{ display: 'flex', gap: 9 }}>
        <input
          className="inp"
          placeholder="Ask about the codebase…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading}
        />
        <button
          className="btn btn-primary"
          onClick={() => send()}
          disabled={loading || !input.trim()}
          style={{ padding: '10px 16px' }}
        >
          {loading ? <Spinner size={15} /> : '→'}
        </button>
      </div>
    </div>
  )
}
