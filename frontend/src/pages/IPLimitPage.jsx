import { useState, useEffect, useCallback } from 'react'
import { ShieldBan, ShieldCheck, RefreshCw, Clock, Wifi, WifiOff, AlertTriangle, Info, Zap, Activity } from 'lucide-react'
import api from '../lib/api'

// ─── helpers ──────────────────────────────────────────────────────────────────

function timeLeft(unbanAt) {
  const diff = unbanAt - Date.now()
  if (diff <= 0) return 'Expiring...'
  const m = Math.floor(diff / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function timeSince(ms) {
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ${m % 60}m ago`
}


// ─── Event Log Panel ──────────────────────────────────────────────────────────

const LOG_ICONS = {
  connect:    { icon: Wifi,         color: '#22c55e', label: 'Connected'   },
  disconnect: { icon: WifiOff,      color: '#6b5a8a', label: 'Disconnected'},
  ban:        { icon: ShieldBan,    color: '#ef4444', label: 'Banned'      },
  unban:      { icon: ShieldCheck,  color: '#22c55e', label: 'Unbanned'    },
  ip_switch:  { icon: Activity,     color: '#f59e0b', label: 'IP Switched' },
}

function EventLogPanel({ logs, loading }) {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? logs : logs.filter(l => l.type === filter)

  return (
    <div className="glass-card" style={{ marginTop: 24 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(128,64,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Zap size={16} color="#8040ff" />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: '#e2d9f3' }}>Event Log</h2>
          <span style={{ fontSize: 11, color: '#4a3a6a', background: 'rgba(128,64,255,0.1)', border: '1px solid rgba(128,64,255,0.2)', padding: '1px 8px', borderRadius: 10 }}>
            {logs.length} events
          </span>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'connect', 'disconnect', 'ban', 'unban', 'ip_switch'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '3px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
              fontWeight: filter === f ? 600 : 400,
              background: filter === f ? 'rgba(128,64,255,0.2)' : 'transparent',
              border: filter === f ? '1px solid rgba(128,64,255,0.4)' : '1px solid rgba(128,64,255,0.12)',
              color: filter === f ? '#c4b5ff' : '#6b5a8a',
              transition: 'all 0.15s',
            }}>
              {f === 'all' ? 'All' : LOG_ICONS[f]?.label || f}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxHeight: 380, overflowY: 'auto' }}>
        {loading || filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#4a3a6a', fontSize: 13 }}>
            {loading ? 'Loading...' : 'No events yet — waiting for connections'}
          </div>
        ) : (
          <table className="nx-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>Event</th>
                <th>Client</th>
                <th>Detail</th>
                <th style={{ width: 120 }}>Time</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => {
                const meta = LOG_ICONS[log.type] || { icon: Info, color: '#9d7fc7', label: log.type }
                const Icon = meta.icon
                return (
                  <tr key={log.id}>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        fontSize: 11, padding: '3px 8px', borderRadius: 5, fontWeight: 500,
                        background: `${meta.color}18`,
                        border: `1px solid ${meta.color}35`,
                        color: meta.color,
                      }}>
                        <Icon size={11} />
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                      {log.email}
                    </td>
                    <td style={{ fontSize: 12, color: '#7c6a9e' }}>
                      {log.detail || '—'}
                    </td>
                    <td style={{ fontSize: 11, color: '#4a3a6a', fontFamily: 'JetBrains Mono, monospace' }}>
                      {new Date(log.ts).toLocaleTimeString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}


// ─── Ban List Table ───────────────────────────────────────────────────────────

function BanTable({ bans, onUnban, unbanning }) {
  const [ticks, setTicks] = useState(0)

  // Re-render every second to update countdown
  useEffect(() => {
    const t = setInterval(() => setTicks(x => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  if (!bans.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b5a8a' }}>
        <ShieldCheck size={36} style={{ margin: '0 auto 12px', color: '#22c55e', opacity: 0.6 }} />
        <div style={{ fontSize: 14 }}>No active bans</div>
        <div style={{ fontSize: 12, marginTop: 4 }}>All clients are within IP limits</div>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="nx-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Reason</th>
            <th>Banned At</th>
            <th>Auto Unban In</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {bans.map(ban => (
            <tr key={ban.email}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#e2d9f3' }}>
                    {ban.email}
                  </span>
                </div>
              </td>
              <td>
                <span style={{
                  fontSize: 11, color: '#f59e0b',
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.2)',
                  padding: '2px 8px', borderRadius: 4,
                }}>
                  {ban.reason || 'Multiple IPs detected'}
                </span>
              </td>
              <td style={{ fontSize: 12, color: '#9d7fc7' }}>
                {timeSince(ban.banned_at)}
              </td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={12} color="#8040ff" />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#c4b5ff' }}>
                    {timeLeft(ban.unban_at)}
                  </span>
                </div>
              </td>
              <td>
                <button
                  onClick={() => onUnban(ban.email)}
                  disabled={unbanning === ban.email}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                    background: 'rgba(34,197,94,0.12)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    color: '#22c55e', fontSize: 12, fontWeight: 500,
                    opacity: unbanning === ban.email ? 0.5 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.22)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(34,197,94,0.12)'}
                >
                  {unbanning === ban.email
                    ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    : <ShieldCheck size={12} />}
                  Unban
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── IP Stats Cards ───────────────────────────────────────────────────────────

function IPStatsGrid({ stats, onBan, onUnban, actioning }) {
  const entries = Object.entries(stats)
  if (!entries.length) return null

  return (
    <div>
      <h3 style={{ fontSize: 13, fontWeight: 600, color: '#9d7fc7', marginBottom: 12 }}>
        Active IP Tracking
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
        {entries.map(([email, info]) => (
          <div key={email} className="glass-card" style={{
            padding: '12px 14px',
            borderColor: info.banned
              ? 'rgba(239,68,68,0.3)'
              : info.currentIP
                ? 'rgba(128,64,255,0.2)'
                : 'rgba(128,64,255,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: '#e2d9f3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                {email}
              </span>
              {info.banned
                ? <span style={{ fontSize: 10, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>BANNED</span>
                : info.currentIP
                  ? <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', padding: '2px 7px', borderRadius: 4 }}>ACTIVE</span>
                  : <span style={{ fontSize: 10, color: '#6b5a8a', padding: '2px 7px' }}>IDLE</span>
              }
            </div>
            {info.currentIP && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wifi size={12} color="#8040ff" />
                <span style={{ fontSize: 11, color: '#9d7fc7', fontFamily: 'JetBrains Mono, monospace' }}>
                  {info.currentIP}
                </span>
                {info.lastSeen && (
                  <span style={{ fontSize: 10, color: '#6b5a8a', marginLeft: 'auto' }}>
                    {timeSince(info.lastSeen)}
                  </span>
                )}
              </div>
            )}
            {!info.currentIP && !info.banned && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <WifiOff size={12} color="#6b5a8a" />
                <span style={{ fontSize: 11, color: '#6b5a8a' }}>No active connection</span>
              </div>
            )}

            {/* Ban / Unban buttons */}
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              {info.banned ? (
                <button
                  onClick={() => onUnban(email)}
                  disabled={actioning === email}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, cursor: 'pointer',
                    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                    color: '#22c55e', fontSize: 11, fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    opacity: actioning === email ? 0.5 : 1,
                  }}
                >
                  <ShieldCheck size={11} /> Unban
                </button>
              ) : (
                <button
                  onClick={() => onBan(email)}
                  disabled={actioning === email}
                  style={{
                    flex: 1, padding: '5px 0', borderRadius: 6, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                    color: '#ef4444', fontSize: 11, fontWeight: 500,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    opacity: actioning === email ? 0.5 : 1,
                  }}
                >
                  <ShieldBan size={11} /> Ban
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IPLimitPage() {
  const [bans,       setBans]       = useState([])
  const [stats,      setStats]      = useState({})
  const [loading,    setLoading]    = useState(true)
  const [unbanning,  setUnbanning]  = useState(null)
  const [banning,    setBanning]    = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [logs,       setLogs]        = useState([])
  const [toast,      setToast]      = useState(null)

  const showToast = (msg, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [bansRes, statsRes, logsRes] = await Promise.all([
        api.get('/iplimit/bans'),
        api.get('/iplimit/stats'),
        api.get('/iplimit/logs?limit=200'),
      ])
      setBans(bansRes.data)
      setStats(statsRes.data)
      setLogs(logsRes.data)
      setLastUpdate(new Date())
    } catch {}
    if (!silent) setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const t = setInterval(() => fetchData(true), 5000)
    return () => clearInterval(t)
  }, [fetchData])

  const handleUnban = async (email) => {
    setUnbanning(email)
    try {
      await api.post(`/iplimit/unban/${encodeURIComponent(email)}`)
      showToast(`${email} unbanned successfully`)
      await fetchData(true)
    } catch (e) {
      showToast(e.response?.data?.error || 'Unban failed', false)
    }
    setUnbanning(null)
  }

  const handleBan = async (email) => {
    if (!window.confirm(`Manually ban ${email} for 1 hour?`)) return
    setBanning(email)
    try {
      await api.post(`/iplimit/ban/${encodeURIComponent(email)}`, { reason: 'Manual ban by admin' })
      showToast(`${email} banned for 1 hour`)
      await fetchData(true)
    } catch (e) {
      showToast(e.response?.data?.error || 'Ban failed', false)
    }
    setBanning(null)
  }

  const activeBans  = bans.length
  const activeConns = Object.values(stats).filter(s => s.currentIP && !s.banned).length

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 24, zIndex: 100,
          padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: toast.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          color: toast.ok ? '#22c55e' : '#ef4444',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e2d9f3', marginBottom: 4 }}>
            IP Limit Manager
          </h1>
          <p style={{ fontSize: 13, color: '#6b5a8a' }}>
            Strict single-IP enforcement — auto ban on violation
            {lastUpdate && (
              <span style={{ marginLeft: 12, fontSize: 11, color: '#4a3a6a' }}>
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchData()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(128,64,255,0.12)', border: '1px solid rgba(128,64,255,0.3)',
            color: '#9d64ff', fontSize: 13,
          }}
        >
          <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Active Bans',       value: activeBans,  color: '#ef4444', glow: 'rgba(239,68,68,0.2)',  icon: ShieldBan  },
          { label: 'Active Connections',value: activeConns, color: '#22c55e', glow: 'rgba(34,197,94,0.2)',  icon: Wifi       },
          { label: 'Tracked Clients',   value: Object.keys(stats).length, color: '#8040ff', glow: 'rgba(128,64,255,0.2)', icon: ShieldCheck },
        ].map(({ label, value, color, glow, icon: Icon }) => (
          <div key={label} className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `rgba(${color === '#ef4444' ? '239,68,68' : color === '#22c55e' ? '34,197,94' : '128,64,255'},0.12)`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 12px ${glow}` }}>
              <Icon size={18} color={color} />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
              <div style={{ fontSize: 11, color: '#6b5a8a', marginTop: 2 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Ban List */}
      <div className="glass-card" style={{ marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(128,64,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldBan size={16} color="#ef4444" />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#e2d9f3' }}>Active Bans</h2>
            {activeBans > 0 && (
              <span style={{ fontSize: 11, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '1px 8px', borderRadius: 10, fontWeight: 600 }}>
                {activeBans}
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: '#6b5a8a' }}>Auto-refreshes every 5s</span>
        </div>
        <div style={{ padding: 0 }}>
          {loading
            ? <div style={{ padding: 40, textAlign: 'center', color: '#6b5a8a' }}>Loading...</div>
            : <BanTable bans={bans} onUnban={handleUnban} unbanning={unbanning || banning} />
          }
        </div>
      </div>

      {/* IP Stats Grid */}
      {!loading && Object.keys(stats).length > 0 && (
        <div className="glass-card" style={{ padding: 20 }}>
          <IPStatsGrid stats={stats} onBan={handleBan} onUnban={handleUnban} actioning={banning || unbanning} />
        </div>
      )}

      {/* Event Log */}
      <EventLogPanel logs={logs} loading={loading} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
