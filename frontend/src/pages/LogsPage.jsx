import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Play, Square, Trash2 } from 'lucide-react'
import api from '../lib/api'

export default function LogsPage() {
  const [logs, setLogs] = useState([])
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [filter, setFilter] = useState('')
  const bottomRef = useRef(null)

  const load = async () => {
    try {
      const { data } = await api.get('/server/xray/logs')
      setLogs(data.data || [])
    } catch {}
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const t = setInterval(load, 3000)
    return () => clearInterval(t)
  }, [autoRefresh])

  useEffect(() => {
    if (autoRefresh && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs, autoRefresh])

  const filtered = filter
    ? logs.filter(l => l.msg?.toLowerCase().includes(filter.toLowerCase()))
    : logs

  const levelColor = type => {
    if (type === 'error') return '#f87171'
    if (type === 'system') return '#fbbf24'
    return '#9d7fc7'
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#c4b5ff', letterSpacing: '-0.02em' }}>Logs</h1>
          <p style={{ fontSize: 13, color: '#6b5a8a', marginTop: 2 }}>Xray process logs · {logs.length} entries</p>
        </div>
        <div className="flex items-center gap-2">
          <input className="nx-input" style={{ width: 180 }} placeholder="Filter logs..."
            value={filter} onChange={e => setFilter(e.target.value)} />
          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
            style={{
              background: autoRefresh ? 'rgba(34,197,94,0.1)' : 'rgba(128,64,255,0.08)',
              border: `1px solid ${autoRefresh ? 'rgba(34,197,94,0.3)' : 'rgba(128,64,255,0.2)'}`,
              color: autoRefresh ? '#4ade80' : '#9d7fc7', cursor: 'pointer', fontSize: 12
            }}>
            {autoRefresh ? <Square size={12} /> : <Play size={12} />}
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button onClick={load}
            style={{ background: 'rgba(128,64,255,0.08)', border: '1px solid rgba(128,64,255,0.2)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: '#8040ff' }}>
            <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} />
          </button>
          <button onClick={() => setLogs([])}
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: '#f87171' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Log terminal */}
      <div className="glass-card" style={{ borderRadius: 12, overflow: 'hidden' }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(128,64,255,0.12)', background: 'rgba(128,64,255,0.05)' }}>
          <div className="w-3 h-3 rounded-full" style={{ background: '#f87171' }} />
          <div className="w-3 h-3 rounded-full" style={{ background: '#fbbf24' }} />
          <div className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />
          <span style={{ fontSize: 11, color: '#6b5a8a', marginLeft: 6, fontFamily: 'JetBrains Mono, monospace' }}>xray — log stream</span>
          {autoRefresh && <span className="ml-auto flex items-center gap-1" style={{ fontSize: 10, color: '#4ade80' }}>
            <span className="w-1.5 h-1.5 rounded-full dot-online" />  live
          </span>}
        </div>
        <div style={{ height: 480, overflowY: 'auto', padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
          {filtered.length === 0 ? (
            <div style={{ color: '#3d2860', paddingTop: 16 }}>
              {logs.length === 0 ? '// No log entries yet. Start Xray to see logs.' : '// No matches for "' + filter + '"'}
            </div>
          ) : (
            filtered.map((entry, i) => (
              <div key={i} className="flex gap-3 py-0.5 hover:bg-purple-950/20 rounded px-1">
                <span style={{ color: '#3d2860', flexShrink: 0 }}>
                  {entry.time ? new Date(entry.time).toLocaleTimeString() : ''}
                </span>
                <span style={{ color: levelColor(entry.type), flexShrink: 0, textTransform: 'uppercase', fontSize: 10, paddingTop: 1 }}>
                  {entry.type?.slice(0, 4)}
                </span>
                <span style={{ color: entry.type === 'error' ? '#fca5a5' : '#c4b5e8', wordBreak: 'break-all' }}>
                  {entry.msg}
                </span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
