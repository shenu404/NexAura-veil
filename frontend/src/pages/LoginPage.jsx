import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState('')
  const { login, loading } = useAuth()
  const navigate = useNavigate()

  const handle = async e => {
    e.preventDefault()
    setError('')
    const res = await login(form.username, form.password)
    if (res.success) navigate('/dashboard')
    else setError(res.msg)
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: '#0a0612' }}>

      {/* Background glow orbs */}
      <div className="absolute" style={{
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(128,64,255,0.12) 0%, transparent 70%)',
        top: '10%', left: '20%', transform: 'translate(-50%,-50%)',
        pointerEvents: 'none'
      }} />
      <div className="absolute" style={{
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(83,15,168,0.1) 0%, transparent 70%)',
        bottom: '15%', right: '15%', pointerEvents: 'none'
      }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.015'%3E%3Cpath d='M0 0h40v1H0zM0 0v40h1V0z'/%3E%3C/g%3E%3C/svg%3E")`
      }} />

      <div className="relative w-full max-w-sm px-4 fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 pulse-glow"
            style={{ background: 'linear-gradient(135deg, #8040ff, #530fa8)' }}>
            <Shield size={28} color="white" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#c4b5ff', letterSpacing: '-0.03em' }}>NexAura Veil</h1>
          <p style={{ fontSize: 13, color: '#6b5a8a', marginTop: 4 }}>Proxy Management Panel</p>
        </div>

        {/* Card */}
        <div className="glass-card p-6">
          <form onSubmit={handle} className="space-y-4">
            <div>
              <label style={{ fontSize: 12, color: '#9d7fc7', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Username
              </label>
              <input
                className="nx-input"
                type="text"
                placeholder="admin"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                required autoFocus
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: '#9d7fc7', fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <div className="relative">
                <input
                  className="nx-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required
                  style={{ paddingRight: 40 }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-500 hover:text-purple-300 transition-colors"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg text-sm"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-glow w-full py-2.5 rounded-lg font-semibold text-white transition-all flex items-center justify-center gap-2"
              style={{ fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#3d2860' }}>
          NexAura Veil v1.0 — Secure Proxy Management
        </p>
      </div>
    </div>
  )
}
