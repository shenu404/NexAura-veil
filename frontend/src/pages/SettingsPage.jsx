import { useState, useEffect } from 'react'
import { Save, RotateCcw, Eye, EyeOff, Loader2, Zap, AlertTriangle, Send, Download, Upload, RefreshCw, Trash2, GitMerge, CheckCircle, Settings, Shield } from 'lucide-react'
import api from '../lib/api'

function Section({ title, children }) {
  return (
    <div className="glass-card p-5 space-y-4">
      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#c4b5ff', paddingBottom: 12, borderBottom: '1px solid rgba(128,64,255,0.12)' }}>
        {title}
      </h2>
      {children}


    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: '#9d7fc7', fontWeight: 500, display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: '#4a3570', marginTop: 4 }}>{hint}</p>}


    </div>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({})
  const [pwForm, setPwForm] = useState({ old: '', new1: '', new2: '' })
  const [showPw, setShowPw] = useState(false)
  const [toast, setToast] = useState({ msg: '', ok: true })
  const [saving, setSaving] = useState(false)
  const [restarting, setRestarting] = useState(false)

  const showMsg = (msg, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast({ msg: '', ok: true }), 3000)
  }

  useEffect(() => {
    api.get('/server/settings').then(r => setSettings(r.data.data || r.data)).catch(() => {})
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    try {
      await api.put('/server/settings', settings)
      showMsg('Settings saved')
    } catch { showMsg('Error saving settings', false) }
    setSaving(false)
  }

  const restartXray = async () => {
    setRestarting(true)
    try {
      await api.post('/server/xray/restart')
      showMsg('Xray restarted')
    } catch (e) { showMsg(e.response?.data?.msg || 'Restart failed', false) }
    setRestarting(false)
  }

  const changePw = async () => {
    if (!pwForm.old || !pwForm.new1) return showMsg('Fill all password fields', false)
    if (pwForm.new1 !== pwForm.new2) return showMsg('New passwords do not match', false)
    if (pwForm.new1.length < 6) return showMsg('Password too short (min 6)', false)
    try {
      await api.put('/auth/password', { oldPassword: pwForm.old, newPassword: pwForm.new1 })
      setPwForm({ old: '', new1: '', new2: '' })
      showMsg('Password changed')
    } catch (e) { showMsg(e.response?.data?.msg || 'Error changing password', false) }
  }

  const set = (k, v) => setSettings(s => ({ ...s, [k]: v }))

  return (
    <div className="space-y-6 max-w-2xl">
      {toast.msg && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg fade-in"
          style={{
            background: toast.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: toast.ok ? '#4ade80' : '#f87171', fontSize: 13
          }}>
          {toast.msg}
        </div>
      )}

      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#c4b5ff', letterSpacing: '-0.02em' }}>Settings</h1>
        <p style={{ fontSize: 13, color: '#6b5a8a', marginTop: 2 }}>Panel & Xray configuration</p>
      </div>

      {/* Xray Settings */}
      <Section title="Xray Configuration">
        <Field label="Xray Binary Path" hint="Path to the xray executable on your server">
          <input className="nx-input" value={settings.xray_path || ''} onChange={e => set('xray_path', e.target.value)}
            placeholder="/usr/local/bin/xray" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} />
        </Field>
        <Field label="Xray Config Path" hint="Path to write the generated xray config.json">
          <input className="nx-input" value={settings.xray_config_path || ''} onChange={e => set('xray_config_path', e.target.value)}
            placeholder="/etc/xray/config.json" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="TLS Certificate File">
            <input className="nx-input" value={settings.cert_file || ''} onChange={e => set('cert_file', e.target.value)}
              placeholder="/etc/ssl/cert.pem" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} />
          </Field>
          <Field label="TLS Key File">
            <input className="nx-input" value={settings.key_file || ''} onChange={e => set('key_file', e.target.value)}
              placeholder="/etc/ssl/key.pem" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} />
          </Field>
        </div>
        <Field label="Subscription Path" hint="URL path for client subscription links">
          <input className="nx-input" value={settings.sub_path || ''} onChange={e => set('sub_path', e.target.value)} placeholder="/sub" />
        </Field>

        <div className="flex gap-3 pt-2">
          <button onClick={saveSettings} disabled={saving}
            className="btn-glow flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{ color: 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13 }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button onClick={restartXray} disabled={restarting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
              color: '#fbbf24', cursor: restarting ? 'not-allowed' : 'pointer', fontSize: 13
            }}>
            {restarting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {restarting ? 'Restarting...' : 'Restart Xray'}
          </button>
        </div>

        <div className="flex items-start gap-2 p-3 rounded-lg"
          style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
          <AlertTriangle size={14} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 11, color: '#92672a' }}>
            Make sure the backend process has permission to write to the config path and execute xray.
            Run the backend as root or with appropriate sudo rules.
          </p>
        </div>
      </Section>

      {/* Change Password */}
      <Section title="Change Admin Password">
        <Field label="Current Password">
          <div className="relative">
            <input className="nx-input" type={showPw ? 'text' : 'password'}
              value={pwForm.old} onChange={e => setPwForm(f => ({ ...f, old: e.target.value }))}
              placeholder="Current password" style={{ paddingRight: 40 }} />
            <button type="button" onClick={() => setShowPw(!showPw)}
              style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#6b5a8a' }}>
              {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="New Password">
            <input className="nx-input" type={showPw ? 'text' : 'password'}
              value={pwForm.new1} onChange={e => setPwForm(f => ({ ...f, new1: e.target.value }))}
              placeholder="New password" />
          </Field>
          <Field label="Confirm New Password">
            <input className="nx-input" type={showPw ? 'text' : 'password'}
              value={pwForm.new2} onChange={e => setPwForm(f => ({ ...f, new2: e.target.value }))}
              placeholder="Confirm password" />
          </Field>
        </div>
        <button onClick={changePw} className="btn-glow flex items-center gap-2 px-4 py-2 rounded-lg"
          style={{ color: 'white', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          <Save size={14} /> Change Password
        </button>
      </Section>

      {/* Telegram Bot */}
      <TelegramSection />

      {/* Backup & Restore */}
      <BackupSection />

      {/* Panel Update */}
      <UpdateSection />

    </div>
  )
}

// ─── Telegram Section ─────────────────────────────────────────────────────────
function TelegramSection() {
  const [form, setForm]       = useState({ bot_token: '', chat_id: '', enabled: false })
  const [status, setStatus]   = useState(null)
  const [saving, setSaving]   = useState(false)
  const [testing, setTesting] = useState(false)
  const [toast, setToast]     = useState(null)

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  useEffect(() => {
    api.get('/telegram/status').then(r => setStatus(r.data)).catch(() => {})
  }, [])

  const save = async () => {
    if (!form.bot_token || !form.chat_id) return showToast('Bot token and Chat ID required', false)
    setSaving(true)
    try {
      await api.post('/telegram/settings', form)
      showToast('Telegram settings saved')
      const r = await api.get('/telegram/status'); setStatus(r.data)
    } catch (e) { showToast(e.response?.data?.error || 'Save failed', false) }
    setSaving(false)
  }

  const test = async () => {
    setTesting(true)
    try { await api.post('/telegram/test'); showToast('Test message sent!') }
    catch (e) { showToast(e.response?.data?.error || 'Test failed', false) }
    setTesting(false)
  }

  const report = async () => {
    try { await api.post('/telegram/report'); showToast('Daily report sent!') }
    catch (e) { showToast(e.response?.data?.error || 'Failed', false) }
  }

  return (
    <Section title="Telegram Bot">
      {toast && (
        <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 8, fontSize: 12,
          background: toast.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: toast.ok ? '#22c55e' : '#ef4444' }}>
          {toast.msg}
        </div>
      )}

      {/* Status badge */}
      {status && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px',
          borderRadius: 8, background: status.active ? 'rgba(34,197,94,0.08)' : 'rgba(128,64,255,0.06)',
          border: `1px solid ${status.active ? 'rgba(34,197,94,0.2)' : 'rgba(128,64,255,0.15)'}` }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: status.active ? '#22c55e' : '#6b5a8a',
            boxShadow: status.active ? '0 0 6px #22c55e' : 'none' }} />
          <span style={{ fontSize: 12, color: status.active ? '#22c55e' : '#6b5a8a' }}>
            {status.active ? 'Bot active' : 'Bot not configured'}
          </span>
        </div>
      )}

      <Field label="Bot Token">
        <input className="nx-input" placeholder="1234567890:AAF..."
          value={form.bot_token} onChange={e => setForm(f => ({ ...f, bot_token: e.target.value }))} />
      </Field>
      <Field label="Chat ID">
        <input className="nx-input" placeholder="-1001234567890"
          value={form.chat_id} onChange={e => setForm(f => ({ ...f, chat_id: e.target.value }))} />
      </Field>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#9d7fc7' }}>
          <input type="checkbox" checked={form.enabled} onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
            style={{ accentColor: '#8040ff', width: 14, height: 14 }} />
          Enable Telegram notifications
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={save} disabled={saving}
          className="btn-glow flex items-center gap-2 px-4 py-2 rounded-lg"
          style={{ color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, opacity: saving ? 0.6 : 1 }}>
          <Save size={13} /> {saving ? 'Saving...' : 'Save'}
        </button>
        {status?.active && (
          <>
            <button onClick={test} disabled={testing}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
                background: 'rgba(128,64,255,0.1)', border: '1px solid rgba(128,64,255,0.3)',
                color: '#9d64ff', fontSize: 13, cursor: 'pointer', opacity: testing ? 0.6 : 1 }}>
              <Send size={13} /> {testing ? 'Sending...' : 'Test'}
            </button>
            <button onClick={report}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
                background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                color: '#22c55e', fontSize: 13, cursor: 'pointer' }}>
              <Send size={13} /> Send Report
            </button>
          </>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#4a3a6a', lineHeight: 1.6 }}>
        💡 Get token from <span style={{ color: '#8040ff' }}>@BotFather</span> · Get Chat ID from <span style={{ color: '#8040ff' }}>@userinfobot</span>
      </div>
    </Section>
  )
}

// ─── Backup Section ───────────────────────────────────────────────────────────
function BackupSection() {
  const [backups,   setBackups]   = useState([])
  const [creating,  setCreating]  = useState(false)
  const [restoring, setRestoring] = useState(null)
  const [toast,     setToast]     = useState(null)

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 3000) }

  const load = async () => {
    try { const r = await api.get('/backup/list'); setBackups(r.data) } catch {}
  }

  useEffect(() => { load() }, [])

  const create = async () => {
    setCreating(true)
    try { await api.post('/backup/create'); showToast('Backup created'); await load() }
    catch (e) { showToast(e.response?.data?.error || 'Failed', false) }
    setCreating(false)
  }

  const restore = async (filename) => {
    if (!window.confirm(`Restore from ${filename}? Current data will be overwritten.`)) return
    setRestoring(filename)
    try {
      const r = await api.post('/backup/restore', { filename })
      showToast(`Restored: ${r.data.inbounds} inbounds, ${r.data.clients} clients`)
    } catch (e) { showToast(e.response?.data?.error || 'Restore failed', false) }
    setRestoring(null)
  }

  const del = async (filename) => {
    if (!window.confirm(`Delete backup ${filename}?`)) return
    try { await api.delete(`/backup/${filename}`); showToast('Deleted'); await load() }
    catch (e) { showToast('Delete failed', false) }
  }

  const download = (filename) => {
    window.open(`/api/backup/download/${filename}`, '_blank')
  }

  const uploadRestore = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      if (!window.confirm('Restore from uploaded file? Current data will be overwritten.')) return
      setRestoring('upload')
      try {
        const r = await api.post('/backup/restore', { data: ev.target.result })
        showToast(`Restored: ${r.data.inbounds} inbounds, ${r.data.clients} clients`)
      } catch (e) { showToast(e.response?.data?.error || 'Restore failed', false) }
      setRestoring(null)
    }
    reader.readAsText(file)
  }

  const fmtSize = (b) => b < 1024 ? `${b}B` : `${(b/1024).toFixed(1)}KB`

  return (
    <Section title="Backup & Restore">
      {toast && (
        <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 8, fontSize: 12,
          background: toast.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: toast.ok ? '#22c55e' : '#ef4444' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={create} disabled={creating}
          className="btn-glow flex items-center gap-2 px-4 py-2 rounded-lg"
          style={{ color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, opacity: creating ? 0.6 : 1 }}>
          <Download size={13} /> {creating ? 'Creating...' : 'Create Backup'}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
          color: '#22c55e', fontSize: 13, cursor: 'pointer' }}>
          <Upload size={13} /> Upload & Restore
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={uploadRestore} />
        </label>
      </div>

      {backups.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', color: '#4a3a6a', fontSize: 13 }}>
          No backups yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {backups.map(b => (
            <div key={b.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(128,64,255,0.05)', border: '1px solid rgba(128,64,255,0.12)' }}>
              <div>
                <div style={{ fontSize: 12, color: '#c4b5ff', fontFamily: 'JetBrains Mono, monospace' }}>{b.name}</div>
                <div style={{ fontSize: 11, color: '#4a3a6a', marginTop: 2 }}>
                  {new Date(b.created_at).toLocaleString()} · {fmtSize(b.size)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => download(b.name)} title="Download"
                  style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(128,64,255,0.1)',
                    border: '1px solid rgba(128,64,255,0.2)', color: '#9d64ff', cursor: 'pointer' }}>
                  <Download size={12} />
                </button>
                <button onClick={() => restore(b.name)} disabled={!!restoring} title="Restore"
                  style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e', cursor: 'pointer',
                    opacity: restoring === b.name ? 0.5 : 1 }}>
                  <Upload size={12} />
                </button>
                <button onClick={() => del(b.name)} title="Delete"
                  style={{ padding: '5px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', cursor: 'pointer' }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ─── Update Section ───────────────────────────────────────────────────────────
function UpdateSection() {
  const [version,   setVersion]   = useState(null)
  const [check,     setCheck]     = useState(null)
  const [checking,  setChecking]  = useState(false)
  const [updating,  setUpdating]  = useState(false)
  const [toast,     setToast]     = useState(null)

  const showToast = (msg, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000) }

  useEffect(() => {
    api.get('/update/version').then(r => setVersion(r.data)).catch(() => {})
  }, [])

  const checkUpdate = async () => {
    setChecking(true); setCheck(null)
    try { const r = await api.get('/update/check'); setCheck(r.data) }
    catch { showToast('Could not check for updates', false) }
    setChecking(false)
  }

  const applyUpdate = async () => {
    if (!window.confirm('Apply update? Panel will restart in ~30 seconds.')) return
    setUpdating(true)
    try {
      await api.post('/update/apply')
      showToast('Update started — panel restarting in ~30s...')
      setTimeout(() => window.location.reload(), 35000)
    } catch (e) { showToast(e.response?.data?.error || 'Update failed', false) }
    setUpdating(false)
  }

  return (
    <Section title="Panel Update">
      {toast && (
        <div style={{ marginBottom: 12, padding: '8px 14px', borderRadius: 8, fontSize: 12,
          background: toast.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${toast.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: toast.ok ? '#22c55e' : '#ef4444' }}>
          {toast.msg}
        </div>
      )}

      {version && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14,
          background: 'rgba(128,64,255,0.06)', border: '1px solid rgba(128,64,255,0.15)',
          fontSize: 12, color: '#9d7fc7' }}>
          <div>Version: <span style={{ color: '#c4b5ff', fontFamily: 'monospace' }}>v{version.version}</span></div>
          {version.commit !== 'unknown' && (
            <div style={{ marginTop: 4 }}>
              Commit: <span style={{ color: '#8040ff', fontFamily: 'monospace' }}>{version.commit}</span>
              {version.message && <span style={{ color: '#6b5a8a' }}> — {version.message}</span>}
            </div>
          )}
        </div>
      )}

      {check && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 14,
          background: check.update_available ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)',
          border: `1px solid ${check.update_available ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.2)'}`,
          fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6,
            color: check.update_available ? '#f59e0b' : '#22c55e' }}>
            <CheckCircle size={13} />
            {check.update_available
              ? `${check.commits_behind} update(s) available`
              : 'Already up to date'}
          </div>
          {check.changes?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {check.changes.map((ch, i) => (
                <div key={i} style={{ color: '#6b5a8a', fontFamily: 'monospace', fontSize: 11, marginTop: 3 }}>
                  • {ch}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={checkUpdate} disabled={checking}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8,
            background: 'rgba(128,64,255,0.1)', border: '1px solid rgba(128,64,255,0.3)',
            color: '#9d64ff', fontSize: 13, cursor: 'pointer', opacity: checking ? 0.6 : 1 }}>
          <RefreshCw size={13} style={checking ? { animation: 'spin 1s linear infinite' } : {}} />
          {checking ? 'Checking...' : 'Check for Updates'}
        </button>
        {check?.update_available && (
          <button onClick={applyUpdate} disabled={updating}
            className="btn-glow flex items-center gap-2 px-4 py-2 rounded-lg"
            style={{ color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, opacity: updating ? 0.6 : 1 }}>
            <GitMerge size={13} /> {updating ? 'Updating...' : 'Apply Update'}
          </button>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Section>
  )
}
