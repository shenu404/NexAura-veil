import { useEffect, useState } from 'react'

export default function LoadingScreen({ onDone }) {
  const [phase, setPhase] = useState(0)
  // phase 0 = logo animate in
  // phase 1 = text appear
  // phase 2 = fade out

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600)
    const t2 = setTimeout(() => setPhase(2), 2400)
    const t3 = setTimeout(() => onDone && onDone(), 3000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [onDone])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#0a0612',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: phase === 2 ? 0 : 1,
      transition: phase === 2 ? 'opacity 0.6s ease' : 'none',
      pointerEvents: 'none',
    }}>

      {/* Ambient glow blobs */}
      <div style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(128,64,255,0.12) 0%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        animation: 'pulse-glow 3s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(192,132,255,0.07) 0%, transparent 70%)',
        top: '40%', left: '45%', transform: 'translate(-50%, -50%)',
        animation: 'pulse-glow 2.5s ease-in-out infinite reverse',
      }} />

      {/* Logo + Shield */}
      <div style={{
        position: 'relative',
        opacity: phase >= 0 ? 1 : 0,
        transform: phase >= 0 ? 'scale(1)' : 'scale(0.7)',
        transition: 'all 0.6s cubic-bezier(0.34,1.56,0.64,1)',
        marginBottom: 32,
      }}>
        {/* Outer ring */}
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ animation: 'spin-slow 8s linear infinite' }}>
          <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(128,64,255,0.25)" strokeWidth="1" strokeDasharray="6 4" />
        </svg>

        {/* Shield icon centered */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'linear-gradient(145deg, rgba(128,64,255,0.3), rgba(80,20,180,0.2))',
            border: '1.5px solid rgba(128,64,255,0.6)',
            boxShadow: '0 0 30px rgba(128,64,255,0.4), 0 0 60px rgba(128,64,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'shield-pulse 2s ease-in-out infinite',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
                fill="rgba(128,64,255,0.4)" stroke="#a855f7" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 12l2 2 4-4" stroke="#c084ff" strokeWidth="1.8"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Inner ring */}
        <svg width="100" height="100" viewBox="0 0 100 100" style={{
          position: 'absolute', inset: 0,
          animation: 'spin-slow 5s linear infinite reverse',
        }}>
          <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(192,132,255,0.15)" strokeWidth="1" strokeDasharray="3 8" />
        </svg>

        {/* Orbit dot */}
        <svg width="100" height="100" viewBox="0 0 100 100" style={{
          position: 'absolute', inset: 0,
          animation: 'spin-slow 3s linear infinite',
        }}>
          <circle cx="50" cy="4" r="3" fill="#8040ff" style={{ filter: 'drop-shadow(0 0 4px #8040ff)' }} />
        </svg>
      </div>

      {/* Brand text */}
      <div style={{
        textAlign: 'center',
        opacity: phase >= 1 ? 1 : 0,
        transform: phase >= 1 ? 'translateY(0)' : 'translateY(10px)',
        transition: 'all 0.5s ease',
      }}>
        <div style={{
          fontSize: 28, fontWeight: 800, letterSpacing: '0.06em',
          background: 'linear-gradient(135deg, #ffffff 0%, #c084ff 50%, #8040ff 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: 4,
        }}>
          NexAura Veil
        </div>

        {/* Separator line */}
        <div style={{
          width: 120, height: 1, margin: '10px auto',
          background: 'linear-gradient(90deg, transparent, rgba(128,64,255,0.6), transparent)',
        }} />

        <div style={{ fontSize: 11, color: '#6b5a8a', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>
          Powered by <span style={{ color: '#8040ff', fontWeight: 600 }}>NexAura™</span>
        </div>
        <div style={{ fontSize: 11, color: '#4a3a6a', letterSpacing: '0.1em' }}>
          Designed by <span style={{ color: '#9d64ff' }}>Shenu</span>
        </div>
      </div>

      {/* Loading bar */}
      <div style={{
        position: 'absolute', bottom: 40, left: '50%', transform: 'translateX(-50%)',
        width: 160,
        opacity: phase >= 1 ? 1 : 0,
        transition: 'opacity 0.4s ease 0.2s',
      }}>
        <div style={{ height: 2, background: 'rgba(128,64,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: 'linear-gradient(90deg, #8040ff, #c084ff)',
            boxShadow: '0 0 8px rgba(128,64,255,0.6)',
            animation: 'loading-bar 1.6s ease forwards',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes shield-pulse {
          0%,100% { box-shadow: 0 0 30px rgba(128,64,255,0.4), 0 0 60px rgba(128,64,255,0.15); }
          50%      { box-shadow: 0 0 40px rgba(128,64,255,0.6), 0 0 80px rgba(128,64,255,0.25); }
        }
        @keyframes pulse-glow {
          0%,100% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
          50%      { transform: translate(-50%,-50%) scale(1.1); opacity: 0.7; }
        }
        @keyframes loading-bar {
          0%   { width: 0%; }
          40%  { width: 60%; }
          80%  { width: 85%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}
