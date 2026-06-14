import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, Server, Users, Activity,
  Settings, LogOut, FileText, Shield, ChevronRight, Zap, ShieldBan
} from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '../../lib/api'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inbounds',  icon: Server,          label: 'Inbounds' },
  { to: '/clients',   icon: Users,           label: 'Clients' },
  { to: '/traffic',   icon: Activity,        label: 'Traffic' },
  { to: '/logs',      icon: FileText,        label: 'Logs' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
  { to: '/iplimit',   icon: ShieldBan,       label: 'IP Limit' },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [xrayUp, setXrayUp] = useState(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    api.get('/server/status').then(r => setXrayUp(r.data.data.xray_status)).catch(() => setXrayUp(false))
    const t = setInterval(() => {
      api.get('/server/status').then(r => setXrayUp(r.data.data.xray_status)).catch(() => setXrayUp(false))
    }, 15000)
    return () => clearInterval(t)
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0a0612' }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col transition-all duration-300 flex-shrink-0"
        style={{
          width: collapsed ? 64 : 220,
          background: 'rgba(17, 9, 32, 0.95)',
          borderRight: '1px solid rgba(128,64,255,0.15)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid rgba(128,64,255,0.12)' }}>
          <div className="flex-shrink-0 w-8 h-8 rounded-lg btn-glow flex items-center justify-center">
            <Shield size={16} color="#e2d9f3" />
          </div>
          {!collapsed && (
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#c4b5ff', letterSpacing: '-0.02em' }}>NexAura</div>
              <div style={{ fontSize: 10, color: '#6b5a8a', fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Veil Panel</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-purple-500 hover:text-purple-300 transition-colors"
            style={{ display: 'flex', marginLeft: collapsed ? 'auto' : undefined }}
          >
            <ChevronRight size={16} style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {/* Xray status */}
        {!collapsed && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg flex items-center gap-2"
            style={{ background: 'rgba(128,64,255,0.08)', border: '1px solid rgba(128,64,255,0.12)' }}>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${xrayUp ? 'dot-online' : xrayUp === false ? 'dot-offline' : 'dot-warning'}`} />
            <span style={{ fontSize: 12, color: '#9d7fc7' }}>
              Xray: {xrayUp ? 'Running' : xrayUp === false ? 'Stopped' : 'Checking...'}
            </span>
            <Zap size={11} style={{ color: xrayUp ? '#4ade80' : '#f87171', marginLeft: 'auto' }} />
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 mt-4 px-2 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 cursor-pointer group
                ${isActive ? 'nav-active' : 'text-purple-400/60 hover:text-purple-300 hover:bg-purple-500/8'}`
              }
              style={{ textDecoration: 'none', fontSize: 13, fontWeight: 500 }}
            >
              <Icon size={17} className="flex-shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User / logout */}
        <div style={{ borderTop: '1px solid rgba(128,64,255,0.12)', padding: '12px 8px' }}>
          {!collapsed && (
            <div className="flex items-center gap-2 px-3 py-2 mb-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style={{ background: 'rgba(128,64,255,0.25)', color: '#c4b5ff' }}>
                {user?.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 12, fontWeight: 600, color: '#c4b5ff' }}>{user?.username}</div>
                <div style={{ fontSize: 10, color: '#6b5a8a' }}>{user?.role}</div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors"
            style={{ color: '#f87171', fontSize: 13, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <LogOut size={16} className="flex-shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto" style={{ background: '#0a0612' }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 80% 50% at 50% -20%, rgba(128,64,255,0.12) 0%, transparent 60%),
              url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.015'%3E%3Cpath d='M0 0h40v1H0zM0 0v40h1V0z'/%3E%3C/g%3E%3C/svg%3E")
            `,
            zIndex: 0
          }}
        />
        <div className="relative z-10 p-6 fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
