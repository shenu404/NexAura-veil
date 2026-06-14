import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Server, Users, ArrowUp, ArrowDown, Activity, Cpu, HardDrive, RefreshCw, Zap } from 'lucide-react'
import api from '../lib/api'
import { formatBytes, formatUptime, protocolColor } from '../lib/utils'

// Live management badge — polls /api/xray/status
function XrayLiveBadge() {
  const [live, setLive] = useState(null)
  useEffect(() => {
    api.get('/xray/status')
      .then(r => setLive(r.data?.live_management ?? r.data?.api_reachable ?? false))
      .catch(() => setLive(false))
  }, [])
  if (live === null) return null
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-card" style={{ fontSize: 11 }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
        background: live ? '#4ade80' : '#f59e0b',
        boxShadow: live ? '0 0 6px #4ade80' : 'none',
      }} />
      <span style={{ color: live ? '#4ade80' : '#f59e0b' }}>
        {live ? 'Live Mgmt ON' : 'Restart Mode'}
      </span>
    </div>
  )
}


function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="glass-card glass-card-hover p-4 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}22`, border: `1px solid ${color}33` }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: '#6b5a8a', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#e2d9f3', lineHeight: 1.2, marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#6b5a8a', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="glass-card px-3 py-2" style={{ fontSize: 12 }}>
      <div style={{ color: '#9d7fc7', marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }}>
          {p.name}: {formatBytes(p.value)}
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const [status, setStatus] = useState(null)
  const [history, setHistory] = useState([])
  const [inbounds, setInbounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const [s, h, ib] = await Promise.all([
        api.get('/server/status'),
        api.get('/server/traffic-history'),
        api.get('/inbounds'),
      ])
      setStatus(s.data.data || s.data)
      setHistory(Array.isArray(h.data) ? h.data : (h.data.data || []))
      setInbounds((Array.isArray(ib.data) ? ib.data : (ib.data.data || [])).slice(0, 6))
    } catch {}
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const refresh = () => { setRefreshing(true); load() }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div style={{ color: '#8040ff', fontSize: 13 }} className="animate-pulse">Loading...</div>
    </div>
  )

  const sys = status?.system || {}
  const traffic = status?.traffic || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#c4b5ff', letterSpacing: '-0.02em' }}>Dashboard</h1>
          <p style={{ fontSize: 13, color: '#6b5a8a', marginTop: 2 }}>{sys.hostname} · {sys.platform}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-card" style={{ fontSize: 12 }}>
            <span className={`w-2 h-2 rounded-full ${status?.xray_status ? 'dot-online' : 'dot-offline'}`} />
            <span style={{ color: status?.xray_status ? '#4ade80' : '#f87171' }}>
              Xray {status?.xray_status ? 'Running' : 'Stopped'}
            </span>
            {status?.xray_version && <span style={{ color: '#6b5a8a' }}>v{status.xray_version}</span>}
          </div>
          <XrayLiveBadge />
          <button onClick={refresh} className="glass-card p-2 rounded-lg hover:border-purple-500/40 transition-colors"
            style={{ border: '1px solid rgba(128,64,255,0.18)', background: 'transparent', cursor: 'pointer', color: '#8040ff' }}>
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <StatCard icon={Server} label="Inbounds" value={status?.inbounds?.active || 0}
          sub={`${status?.inbounds?.total || 0} total`} color="#8040ff" />
        <StatCard icon={Users} label="Clients" value={status?.clients?.active || 0}
          sub={`${status?.clients?.total || 0} total`} color="#3b82f6" />
        <StatCard icon={ArrowUp} label="Upload" value={formatBytes(traffic.up)}
          sub="total sent" color="#22c55e" />
        <StatCard icon={ArrowDown} label="Download" value={formatBytes(traffic.down)}
          sub="total received" color="#f59e0b" />
        <StatCard icon={Cpu} label="CPU Load" value={`${sys.load || 0}`}
          sub={`${sys.cpu?.count || 0} cores`} color="#ec4899" />
        <StatCard icon={HardDrive} label="Memory" value={`${sys.mem?.percent || 0}%`}
          sub={`${formatBytes(sys.mem?.used)} / ${formatBytes(sys.mem?.total)}`} color="#06b6d4" />
      </div>

      {/* Uptime */}
      {sys.uptime && (
        <div className="glass-card px-4 py-3 flex items-center gap-3">
          <Activity size={15} style={{ color: '#8040ff' }} />
          <span style={{ fontSize: 12, color: '#9d7fc7' }}>
            Server uptime: <strong style={{ color: '#c4b5ff' }}>{formatUptime(sys.uptime)}</strong>
          </span>
        </div>
      )}

      {/* Traffic chart */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#c4b5ff' }}>Traffic — Last 24h</h2>
          <div className="flex items-center gap-4" style={{ fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#22c55e' }}>
              <span style={{ width: 10, height: 2, background: '#22c55e', borderRadius: 1, display: 'inline-block' }} /> Upload
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#8040ff' }}>
              <span style={{ width: 10, height: 2, background: '#8040ff', borderRadius: 1, display: 'inline-block' }} /> Download
            </span>
          </div>
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="up" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="down" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8040ff" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#8040ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,64,255,0.08)" />
              <XAxis dataKey="hour" tick={{ fill: '#6b5a8a', fontSize: 10 }} tickLine={false} axisLine={false}
                interval={3} />
              <YAxis tick={{ fill: '#6b5a8a', fontSize: 10 }} tickLine={false} axisLine={false}
                tickFormatter={v => formatBytes(v)} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="up" name="Upload" stroke="#22c55e" strokeWidth={1.5} fill="url(#up)" dot={false} />
              <Area type="monotone" dataKey="down" name="Download" stroke="#8040ff" strokeWidth={1.5} fill="url(#down)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent inbounds */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#c4b5ff' }}>Inbounds</h2>
          <button onClick={() => navigate('/inbounds')}
            style={{ fontSize: 12, color: '#8040ff', background: 'none', border: 'none', cursor: 'pointer' }}>
            View all →
          </button>
        </div>
        <table className="nx-table">
          <thead>
            <tr>
              <th>Remark</th><th>Protocol</th><th>Port</th>
              <th>Traffic</th><th>Clients</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {inbounds.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#3d2860', padding: '24px 0' }}>No inbounds yet</td></tr>
            ) : inbounds.map(ib => (
              <tr key={ib.id} style={{ cursor: 'pointer' }} onClick={() => navigate('/inbounds')}>
                <td style={{ color: '#e2d9f3', fontWeight: 500 }}>{ib.remark}</td>
                <td><span className={`badge ${protocolColor(ib.protocol)}`}>{ib.protocol}</span></td>
                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{ib.port}</td>
                <td style={{ fontSize: 12 }}>
                  <span style={{ color: '#22c55e' }}>↑{formatBytes(ib.up)}</span>
                  <span style={{ color: '#6b5a8a', margin: '0 4px' }}>/</span>
                  <span style={{ color: '#8040ff' }}>↓{formatBytes(ib.down)}</span>
                </td>
                <td style={{ fontSize: 12, color: '#9d7fc7' }}>{ib.client_count}</td>
                <td>
                  <span className={`badge ${ib.enable ? 'badge-green' : 'badge-red'}`}>
                    {ib.enable ? 'Active' : 'Disabled'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
