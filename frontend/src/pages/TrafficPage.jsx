import { useState, useEffect, useRef } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { RefreshCw, Activity, Users, ArrowUp, ArrowDown, Zap } from 'lucide-react'
import api from '../lib/api'
import { formatBytes } from '../lib/utils'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2" style={{ fontSize: 12 }}>
      <div style={{ color: '#9d7fc7', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>{p.name}: {formatBytes(p.value)}</div>
      ))}
    </div>
  )
}

function buildHourlyData(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const buckets = {}
  rows.forEach(r => {
    const d = new Date(r.recorded_at)
    const label = `${String(d.getHours()).padStart(2,'0')}:00`
    if (!buckets[label]) buckets[label] = { hour: label, up: 0, down: 0 }
    buckets[label].up   += r.up   || 0
    buckets[label].down += r.down || 0
  })
  return Object.values(buckets).slice(-24)
}

// ─── Usage bar ────────────────────────────────────────────────────────────────
function UsageBar({ used, total, color = '#8040ff' }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const barColor = pct > 90 ? '#ef4444' : pct > 70 ? '#f59e0b' : color
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6b5a8a', marginBottom: 3 }}>
        <span>{formatBytes(used)}</span>
        {total > 0 && <span>{formatBytes(total)} limit</span>}
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 2, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  )
}

// ─── Live indicator ───────────────────────────────────────────────────────────
function LiveDot({ active }) {
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: active ? '#4ade80' : '#3d2860',
      boxShadow: active ? '0 0 6px #4ade80' : 'none',
      marginRight: 5,
      animation: active ? 'pulse 2s infinite' : 'none',
    }} />
  )
}

export default function TrafficPage() {
  const [history, setHistory]       = useState([])
  const [inbounds, setInbounds]     = useState([])
  const [userStats, setUserStats]   = useState([])
  const [pollerOn, setPollerOn]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const autoRef = useRef(autoRefresh)
  autoRef.current = autoRefresh

  const load = async (quiet = false) => {
    if (!quiet) setRefreshing(true)
    try {
      const [h, ib, us, pl] = await Promise.all([
        api.get('/server/traffic-history'),
        api.get('/inbounds'),
        api.get('/server/user-stats'),
        api.get('/server/stats/poller').catch(() => ({ data: { running: false } })),
      ])
      setHistory(buildHourlyData(Array.isArray(h.data) ? h.data : (h.data.data || [])))
      setInbounds(Array.isArray(ib.data) ? ib.data : (ib.data.data || []))
      setUserStats(Array.isArray(us.data) ? us.data : [])
      setPollerOn(pl.data?.running ?? false)
      setLastUpdated(new Date())
    } catch (e) {
      console.error('Traffic load error:', e)
    }
    if (!quiet) setRefreshing(false)
  }

  // Initial load
  useEffect(() => { load() }, [])

  // Auto-refresh every 30s (matches poller interval)
  useEffect(() => {
    const t = setInterval(() => { if (autoRef.current) load(true) }, 30000)
    return () => clearInterval(t)
  }, [])

  const totalUp   = userStats.reduce((a, b) => a + (b.up   || 0), 0)
  const totalDown = userStats.reduce((a, b) => a + (b.down || 0), 0)

  const inboundBarData = inbounds.slice(0, 10).map(ib => ({
    name: (ib.tag || ib.remark || 'Unknown').slice(0, 14),
    Upload:   ib.up   || 0,
    Download: ib.down || 0,
  }))

  // Sort user stats by total traffic desc
  const sortedUsers = [...userStats].sort((a, b) => (b.up + b.down) - (a.up + a.down))

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#c4b5ff', letterSpacing: '-0.02em' }}>Traffic</h1>
          <p style={{ fontSize: 13, color: '#6b5a8a', marginTop: 2 }}>
            ↑{formatBytes(totalUp)} · ↓{formatBytes(totalDown)}
            {lastUpdated && (
              <span style={{ marginLeft: 8 }}>
                · updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Live poller indicator */}
          <div className="glass-card px-3 py-1.5 flex items-center gap-2" style={{ fontSize: 11 }}>
            <LiveDot active={pollerOn} />
            <span style={{ color: pollerOn ? '#4ade80' : '#6b5a8a' }}>
              {pollerOn ? 'Live Stats' : 'Static'}
            </span>
          </div>
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(v => !v)}
            className="glass-card px-3 py-1.5"
            style={{ fontSize: 11, border: `1px solid ${autoRefresh ? 'rgba(128,64,255,0.4)' : 'rgba(128,64,255,0.15)'}`,
              color: autoRefresh ? '#a78bfa' : '#6b5a8a', cursor: 'pointer', borderRadius: 8 }}>
            {autoRefresh ? '⏸ Auto' : '▶ Auto'}
          </button>
          <button onClick={() => load()} className="glass-card p-2 rounded-lg"
            style={{ border: '1px solid rgba(128,64,255,0.18)', background: 'transparent', cursor: 'pointer', color: '#8040ff' }}>
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {[
          { label: 'Total Upload',   value: formatBytes(totalUp),             color: '#22c55e', icon: ArrowUp },
          { label: 'Total Download', value: formatBytes(totalDown),           color: '#8040ff', icon: ArrowDown },
          { label: 'Combined',       value: formatBytes(totalUp + totalDown), color: '#3b82f6', icon: Activity },
          { label: 'Active Users',   value: userStats.filter(u => u.enable).length, color: '#f59e0b', icon: Users },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 flex items-start gap-3">
            <s.icon size={16} style={{ color: s.color, marginTop: 3, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, color: '#6b5a8a', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, marginTop: 4 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Per-user live stats table ── */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid rgba(128,64,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#c4b5ff' }}>
            <Zap size={14} style={{ display: 'inline', marginRight: 6, color: '#8040ff' }} />
            Per-User Traffic
          </h2>
          <span style={{ fontSize: 11, color: '#6b5a8a' }}>{sortedUsers.length} users</span>
        </div>
        {sortedUsers.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: '#3d2860', fontSize: 13 }}>
            No user traffic data yet — stats update every 30s once xray API is online
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(128,64,255,0.1)' }}>
                  {['User', 'Inbound', '↑ Upload', '↓ Download', 'Total Usage', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 16px', textAlign: 'left', color: '#6b5a8a', fontWeight: 500, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((u, i) => {
                  const total = (u.up || 0) + (u.down || 0)
                  const limit = u.total_gb || 0
                  const pct   = limit > 0 ? (total / limit) * 100 : 0
                  return (
                    <tr key={u.email} style={{
                      borderBottom: '1px solid rgba(128,64,255,0.06)',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(128,64,255,0.02)',
                    }}>
                      <td style={{ padding: '10px 16px', color: '#c4b5fd', fontWeight: 500 }}>
                        <LiveDot active={u.enable} />
                        {u.email}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#6b5a8a' }}>
                        <span style={{ background: 'rgba(128,64,255,0.12)', borderRadius: 4, padding: '2px 7px', fontSize: 10 }}>
                          {u.inbound || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', color: '#22c55e', fontFamily: 'monospace' }}>
                        {formatBytes(u.up || 0)}
                      </td>
                      <td style={{ padding: '10px 16px', color: '#8040ff', fontFamily: 'monospace' }}>
                        {formatBytes(u.down || 0)}
                      </td>
                      <td style={{ padding: '10px 16px', minWidth: 160 }}>
                        <UsageBar used={total} total={limit} />
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background: u.enable ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                          color: u.enable ? '#4ade80' : '#f87171',
                        }}>
                          {u.enable ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Hourly chart ── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#c4b5ff' }}>Hourly Traffic — Last 24h</h2>
          <div className="flex items-center gap-4" style={{ fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#22c55e' }}>
              <span style={{ width: 10, height: 2, background: '#22c55e', borderRadius: 1, display: 'inline-block' }} /> Upload
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#8040ff' }}>
              <span style={{ width: 10, height: 2, background: '#8040ff', borderRadius: 1, display: 'inline-block' }} /> Download
            </span>
          </div>
        </div>
        <div style={{ height: 250 }}>
          {history.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d2860', fontSize: 13 }}>
              No traffic data yet — data appears after first poll cycle
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gUp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDown" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8040ff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8040ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,64,255,0.08)" />
                <XAxis dataKey="hour" tick={{ fill: '#6b5a8a', fontSize: 10 }} tickLine={false} axisLine={false} interval={3} />
                <YAxis tick={{ fill: '#6b5a8a', fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => formatBytes(v)} width={65} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="up"   name="Upload"   stroke="#22c55e" strokeWidth={2} fill="url(#gUp)"   dot={false} />
                <Area type="monotone" dataKey="down" name="Download" stroke="#8040ff" strokeWidth={2} fill="url(#gDown)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Per-inbound bar chart ── */}
      {inboundBarData.length > 0 && (
        <div className="glass-card p-5">
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#c4b5ff', marginBottom: 16 }}>Traffic Per Inbound</h2>
          <div style={{ height: Math.max(200, inboundBarData.length * 42 + 60) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inboundBarData} layout="vertical" margin={{ top: 4, right: 20, bottom: 0, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,64,255,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6b5a8a', fontSize: 10 }} tickLine={false} axisLine={false}
                  tickFormatter={v => formatBytes(v)} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#9d7fc7', fontSize: 11 }} tickLine={false} axisLine={false} width={95} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Upload"   fill="#22c55e" fillOpacity={0.8} radius={[0, 3, 3, 0]} />
                <Bar dataKey="Download" fill="#8040ff" fillOpacity={0.8} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
