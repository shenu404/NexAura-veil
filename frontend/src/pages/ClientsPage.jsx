import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Pencil, Trash2, RotateCcw, Link, Copy, X, Loader2, QrCode } from 'lucide-react'
import api from '../lib/api'
import { formatBytes, formatExpiry, isExpired, isExpiringSoon, protocolColor, copyToClipboard } from '../lib/utils'

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50,
      background: 'rgba(10,6,18,0.85)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '20px',
      paddingTop: '80px',
    }}>
      <div className="glass-card fade-in" style={{
        width: '100%', maxWidth: wide ? '672px' : '448px',
        maxHeight: 'calc(100vh - 40px)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 0 40px rgba(128,64,255,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid rgba(128,64,255,0.15)', position: 'sticky', top: 0, background: 'rgba(26,16,48,0.98)', zIndex: 1 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#c4b5ff', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b5a8a' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>{children}</div>
      </div>
    </div>
  )
}


function ClientForm({ inbounds, initial, onSave, onClose }) {
  // For edit: initial.inbound_ids may be set; otherwise derive from inbound_id
  const initialIds = initial?.inbound_ids?.length
    ? initial.inbound_ids
    : initial?.inbound_id ? [initial.inbound_id] : (inbounds[0] ? [inbounds[0].id] : [])

  const [form, setForm] = useState(initial || {
    email: '', flow: '', enable: true,
    total: 0, expiry_time: 0, tg_id: '', limit_ip: 0,
  })
  const [selectedIds, setSelectedIds] = useState(initialIds)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleInbound = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const submit = async () => {
    if (!form.email) return setErr('Email is required')
    if (!selectedIds.length) return setErr('Select at least one inbound')
    setSaving(true); setErr('')
    try {
      await onSave({
        ...form,
        inbound_id:  selectedIds[0],
        inbound_ids: selectedIds,
        total: form.total * 1024 * 1024 * 1024,
      })
      onClose()
    } catch (e) { setErr(e.response?.data?.error || e.response?.data?.msg || 'Error saving') }
    setSaving(false)
  }

  return (
    <div className="space-y-4">

      {/* ── Inbound multi-select ── */}
      <div>
        <label style={{ fontSize: 12, color: '#9d7fc7', fontWeight: 500, display: 'block', marginBottom: 8 }}>
          Inbounds
          <span style={{ color: '#6b5a8a', fontWeight: 400, marginLeft: 6 }}>
            ({selectedIds.length} selected — sub URL returns all)
          </span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {inbounds.map(ib => {
            const selected = selectedIds.includes(ib.id)
            return (
              <div
                key={ib.id}
                onClick={() => toggleInbound(ib.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${selected ? 'rgba(128,64,255,0.5)' : 'rgba(128,64,255,0.15)'}`,
                  background: selected ? 'rgba(128,64,255,0.1)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.15s',
                }}>
                <div style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  border: `2px solid ${selected ? '#8040ff' : 'rgba(128,64,255,0.3)'}`,
                  background: selected ? '#8040ff' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <span style={{ color: 'white', fontSize: 10, lineHeight: 1 }}>✓</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: selected ? '#c4b5fd' : '#9d7fc7', fontWeight: selected ? 500 : 400 }}>
                    {ib.tag || ib.remark}
                  </span>
                  <span style={{
                    marginLeft: 8, fontSize: 10, padding: '1px 6px', borderRadius: 4,
                    background: 'rgba(128,64,255,0.12)', color: '#8040ff',
                  }}>
                    {ib.protocol}:{ib.port}
                  </span>
                </div>
                {selectedIds[0] === ib.id && (
                  <span style={{ fontSize: 10, color: '#6b5a8a' }}>primary</span>
                )}
              </div>
            )
          })}
          {inbounds.length === 0 && (
            <div style={{ color: '#6b5a8a', fontSize: 12, padding: '8px 0' }}>
              No inbounds available — create one first
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={{ fontSize: 12, color: '#9d7fc7', fontWeight: 500, display: 'block', marginBottom: 5 }}>Email / Name</label>
          <input className="nx-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="user@example.com" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#9d7fc7', fontWeight: 500, display: 'block', marginBottom: 5 }}>Flow</label>
          <select className="nx-input" value={form.flow} onChange={e => set('flow', e.target.value)}>
            <option value="">None</option>
            <option value="xtls-rprx-vision">xtls-rprx-vision</option>
            <option value="xtls-rprx-direct">xtls-rprx-direct</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={{ fontSize: 12, color: '#9d7fc7', fontWeight: 500, display: 'block', marginBottom: 5 }}>Total Traffic (GB)</label>
          <input className="nx-input" type="number" value={form.total} onChange={e => set('total', Number(e.target.value))} placeholder="0 = unlimited" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#9d7fc7', fontWeight: 500, display: 'block', marginBottom: 5 }}>Expiry Date</label>
          <input className="nx-input" type="date"
            value={form.expiry_time ? new Date(form.expiry_time).toISOString().split('T')[0] : ''}
            onChange={e => set('expiry_time', e.target.value ? new Date(e.target.value).getTime() : 0)} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ fontSize: 12, color: '#9d7fc7', fontWeight: 500, display: 'block', marginBottom: 5 }}>
            IP Limit <span style={{ color: '#6b5a8a', fontWeight: 400 }}>(0 = unlimited)</span>
          </label>
          <input className="nx-input" type="number" min="0" value={form.limit_ip}
            onChange={e => set('limit_ip', Number(e.target.value))} placeholder="0" />
        </div>
        <div>
          <label style={{ fontSize: 12, color: '#9d7fc7', fontWeight: 500, display: 'block', marginBottom: 5 }}>Telegram ID (optional)</label>
          <input className="nx-input" value={form.tg_id || ''} onChange={e => set('tg_id', e.target.value)} placeholder="@username or chat_id" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="en" checked={form.enable} onChange={e => set('enable', e.target.checked)}
          style={{ accentColor: '#8040ff', width: 15, height: 15 }} />
        <label htmlFor="en" style={{ fontSize: 13, color: '#9d7fc7', cursor: 'pointer' }}>Enable client</label>
      </div>

      {err && (
        <div className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>{err}</div>
      )}

      <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
        <button onClick={onClose} style={{
          flex: 1, padding: '10px', borderRadius: '8px', fontSize: 13, cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(128,64,255,0.2)',
          color: '#9d7fc7',
        }}>Cancel</button>
        <button onClick={submit} disabled={saving} className="btn-glow" style={{
          flex: 1, padding: '10px', borderRadius: '8px', fontSize: 13,
          cursor: saving ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          color: 'white', border: 'none', opacity: saving ? 0.7 : 1,
        }}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving...' : 'Save Client'}
        </button>
      </div>
    </div>
  )
}

function QRCanvas({ text }) {
  const canvasRef = useCallback(node => {
    if (!node || !text) return
    // Simple QR using google chart API rendered as image
    // We draw the link as a canvas QR via a tiny inline generator
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const ctx = node.getContext('2d')
      ctx.drawImage(img, 0, 0, 200, 200)
    }
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(text)}`
  }, [text])
  return <canvas ref={canvasRef} width={200} height={200} style={{ borderRadius: 8, display: 'block' }} />
}

function ShareModal({ clientId, onClose }) {
  const [link, setLink]       = useState(null)
  const [subUrl, setSubUrl]   = useState(null)
  const [allLinks, setAllLinks] = useState([])
  const [copied, setCopied]   = useState('')
  const [tab, setTab]         = useState('link')
  const [resetting, setResetting] = useState(false)

  const fetchLinks = () => {
    api.get(`/clients/${clientId}/sub-link`)
      .then(r => {
        setLink(r.data.data || r.data)
        setSubUrl(r.data.sub_url || null)
        setAllLinks(r.data.links || [])
      })
      .catch(() => setLink('ERROR: Could not generate link'))
  }

  useEffect(() => { fetchLinks() }, [clientId])

  const handleCopy = (text, key) => {
    if (!text) return
    copyToClipboard(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const handleResetToken = async () => {
    if (!confirm('Regenerate subscription token? Old URL will stop working.')) return
    setResetting(true)
    try {
      await api.post(`/clients/${clientId}/reset-token`)
      fetchLinks()
    } catch {}
    setResetting(false)
  }

  const tabStyle = active => ({
    padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer', border: 'none',
    background: active ? 'rgba(128,64,255,0.25)' : 'transparent',
    color: active ? '#c4b5fd' : '#6b5a8a',
    fontWeight: active ? 600 : 400,
    transition: 'all 0.15s',
  })

  const CopyBox = ({ value, copyKey, label }) => (
    <div>
      {label && <p style={{ fontSize: 12, color: '#9d7fc7', marginBottom: 6 }}>{label}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="flex-1 nx-input" style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
          wordBreak: 'break-all', height: 'auto', minHeight: 36, padding: '8px 12px',
        }}>
          {value ?? <span style={{ color: '#6b5a8a' }}>Generating...</span>}
        </div>
        <button onClick={() => handleCopy(value, copyKey)} style={{
          background: copied === copyKey ? 'rgba(34,197,94,0.15)' : 'rgba(128,64,255,0.15)',
          border: `1px solid ${copied === copyKey ? 'rgba(34,197,94,0.4)' : 'rgba(128,64,255,0.3)'}`,
          color: copied === copyKey ? '#4ade80' : '#a78bfa',
          borderRadius: 8, padding: '8px 10px', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
        }}>
          {copied === copyKey ? '✓' : <Copy size={14} />}
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 4 }}>
        <button style={tabStyle(tab === 'link')} onClick={() => setTab('link')}>🔗 Link</button>
        <button style={tabStyle(tab === 'sub')}  onClick={() => setTab('sub')}>📋 Sub URL</button>
        <button style={tabStyle(tab === 'qr')}   onClick={() => setTab('qr')}>📱 QR</button>
      </div>

      {/* ── Link tab ── */}
      {tab === 'link' && (
        <div className="space-y-3">
          {allLinks.length > 1 ? (
            // Multi-inbound: show each link separately
            <div className="space-y-3">
              <p style={{ fontSize: 11, color: '#6b5a8a' }}>
                {allLinks.length} inbounds — each config below, or use <strong style={{ color: '#a78bfa' }}>Sub URL</strong> tab for one auto-updating link.
              </p>
              {allLinks.map((l, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background: 'rgba(128,64,255,0.15)', color: '#a78bfa' }}>
                      {l.inbound}
                    </span>
                    <span style={{ fontSize: 10, color: '#6b5a8a' }}>{l.protocol}</span>
                  </div>
                  <CopyBox value={l.link} copyKey={`link-${i}`} />
                </div>
              ))}
            </div>
          ) : (
            <CopyBox value={link} copyKey="link" label="Config Link" />
          )}
          <p style={{ fontSize: 11, color: '#6b5a8a' }}>
            Import into v2rayN, Clash, Shadowrocket, NekoBox.
          </p>
        </div>
      )}

      {/* ── Sub URL tab ── */}
      {tab === 'sub' && (
        <div className="space-y-3">
          <CopyBox value={subUrl} copyKey="sub" label="Subscription URL" />
          <div style={{
            background: 'rgba(128,64,255,0.07)', border: '1px solid rgba(128,64,255,0.15)',
            borderRadius: 8, padding: '10px 14px', fontSize: 11, color: '#9d7fc7', lineHeight: 1.7,
          }}>
            <div style={{ fontWeight: 600, color: '#c4b5fd', marginBottom: 4 }}>✦ What is this?</div>
            <div>• Persistent URL — stays the same even if configs change</div>
            <div>• Add once to your client — it auto-updates when server changes</div>
            <div>• Works with: <span style={{ color: '#a78bfa' }}>v2rayN · Clash · NekoBox · Hiddify · Shadowrocket</span></div>
            <div style={{ marginTop: 6, color: '#6b5a8a' }}>
              Shows traffic info: used / limit / expiry in supported clients
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleResetToken}
              disabled={resetting}
              style={{
                fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171', opacity: resetting ? 0.5 : 1,
              }}>
              {resetting ? 'Regenerating...' : '⟳ Regenerate Token'}
            </button>
          </div>
        </div>
      )}

      {/* ── QR tab ── */}
      {tab === 'qr' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
            {['link', 'sub'].map(k => (
              <button key={k} onClick={() => {}} style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 5, cursor: 'default',
                background: 'rgba(128,64,255,0.1)', border: '1px solid rgba(128,64,255,0.2)', color: '#9d7fc7',
              }}>
                QR → {k === 'link' ? 'Config' : 'Sub URL'}
              </button>
            ))}
          </div>
          {/* Sub URL QR — more useful (persistent) */}
          <div>
            <p style={{ fontSize: 11, color: '#6b5a8a', textAlign: 'center', marginBottom: 6 }}>Subscription URL QR</p>
            {subUrl
              ? <QRCanvas text={subUrl} />
              : <div style={{ width: 200, height: 200, background: 'rgba(255,255,255,0.05)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b5a8a', fontSize: 12 }}>Generating...</div>
            }
          </div>
          <p style={{ fontSize: 11, color: '#6b5a8a', textAlign: 'center' }}>
            Scan with v2rayN, Shadowrocket, Clash, NekoBox
          </p>
        </div>
      )}
    </div>
  )
}

export default function ClientsPage() {
  const [clients, setClients] = useState([])
  const [ipStats, setIpStats] = useState({})
  const [inbounds, setInbounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState('')
  const [toast, setToast] = useState('')

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    const [c, ib, ipStats] = await Promise.all([
        api.get('/clients'), api.get('/inbounds'),
        api.get('/iplimit/stats').catch(() => ({ data: {} }))
      ])
    setClients(Array.isArray(c.data) ? c.data : (c.data.data || []))
    setInbounds(Array.isArray(ib.data) ? ib.data : (ib.data.data || []))
    setIpStats(ipStats.data || {})
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async form => {
    // form.total already bytes-converted inside ClientForm submit
    const r = await api.post('/clients', form)
    const live = r.data?.xray_live
    const count = r.data?.xray_live_count
    showToast(
      live === true  ? `✓ Client added · Live on ${count} inbound(s)` :
      live === false ? '✓ Client added · Will apply on xray restart' :
      'Client added'
    )
    load()
  }

  const update = async (id, form) => {
    const r = await api.put(`/clients/${id}`, form)
    const live = r.data?.xray_live
    showToast(
      live === true  ? '✓ Updated · Applied live' :
      live === false ? '✓ Updated · Will apply on restart' :
      'Client updated'
    )
    load()
  }

  const del = async id => {
    if (!confirm('Delete this client?')) return
    const r = await api.delete(`/clients/${id}`)
    const live = r.data?.xray_live
    showToast(
      live === true  ? '✓ Deleted · Removed live' :
      live === false ? '✓ Deleted · Will apply on restart' :
      'Deleted'
    )
    load()
  }

  // Open edit modal — fetch current inbound_ids from server
  const openEdit = async (client) => {
    try {
      const r = await api.get(`/clients/${client.id}/inbounds`)
      const ids = Array.isArray(r.data) ? r.data.map(i => i.id) : [client.inbound_id]
      setModal({ edit: { ...client, inbound_ids: ids } })
    } catch {
      setModal({ edit: { ...client, inbound_ids: [client.inbound_id] } })
    }
  }

  const resetTraffic = async id => {
    await api.post(`/clients/${id}/reset`)
    showToast('Traffic reset'); load()
  }

  const filtered = filter
    ? clients.filter(c => c.email.toLowerCase().includes(filter.toLowerCase()) || c.inbound_remark?.toLowerCase().includes(filter.toLowerCase()))
    : clients

  if (loading) return <div className="flex items-center justify-center h-64"><div style={{ color: '#8040ff' }} className="animate-pulse">Loading...</div></div>

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg fade-in"
          style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: 13 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#c4b5ff', letterSpacing: '-0.02em' }}>Clients</h1>
          <p style={{ fontSize: 13, color: '#6b5a8a', marginTop: 2 }}>{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <input className="nx-input" style={{ width: 220 }} placeholder="Search clients..."
            value={filter} onChange={e => setFilter(e.target.value)} />
          <button onClick={() => setModal('create')} className="btn-glow px-4 py-2 rounded-lg flex items-center gap-2"
            style={{ color: 'white', border: 'none', cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
            <Plus size={15} /> Add Client
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="nx-table">
          <thead>
            <tr>
              <th>Email</th><th>Inbound</th><th>Traffic ↑/↓</th>
              <th>IP Limit</th><th>Expiry</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#3d2860', padding: '32px 0', fontSize: 13 }}>
                {clients.length === 0 ? 'No clients yet.' : 'No results for "' + filter + '"'}
              </td></tr>
            )}
            {filtered.map(c => {
              const expired = isExpired(c.expiry_time)
              const expiringSoon = isExpiringSoon(c.expiry_time)
              return (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 500, color: '#e2d9f3' }}>{c.email}</div>
                    {c.uuid && <div style={{ fontSize: 10, color: '#6b5a8a', fontFamily: 'JetBrains Mono, monospace' }}>
                      {c.uuid.slice(0, 18)}...
                    </div>}
                  </td>
                  <td>
                    {/* Multi-inbound badges */}
                    {c.all_inbounds
                      ? c.all_inbounds.split(', ').map((tag, i) => (
                          <span key={i} style={{
                            display: 'inline-block', marginRight: 4, marginBottom: 2,
                            fontSize: 10, padding: '1px 6px', borderRadius: 4,
                            background: 'rgba(128,64,255,0.12)', color: '#a78bfa',
                          }}>{tag}</span>
                        ))
                      : <span style={{ fontSize: 12, color: '#c4b5ff' }}>{c.inbound_remark}</span>
                    }
                    <div style={{ marginTop: 3 }}>
                      <span className={`badge ${protocolColor(c.protocol)}`}>{c.protocol}:{c.port}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <span style={{ color: '#22c55e' }}>↑{formatBytes(c.up)}</span>
                    <span style={{ color: '#3d2860', margin: '0 4px' }}>/</span>
                    <span style={{ color: '#8040ff' }}>↓{formatBytes(c.down)}</span>
                    {c.total > 0 && <div style={{ color: '#6b5a8a', fontSize: 10, marginTop: 2 }}>limit: {formatBytes(c.total)}</div>}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    <span style={{ color: expired ? '#f87171' : expiringSoon ? '#fbbf24' : '#9d7fc7' }}>
                      {formatExpiry(c.expiry_time)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${c.enable ? 'badge-green' : 'badge-red'}`}>
                      {c.enable ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button title="Share link" onClick={() => setModal({ share: c.id })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '4px 6px', borderRadius: 6 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <Link size={14} />
                      </button>
                      <button title="Edit" onClick={() => openEdit(c)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8040ff', padding: '4px 6px', borderRadius: 6 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(128,64,255,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <Pencil size={14} />
                      </button>
                      <button title="Reset traffic" onClick={() => resetTraffic(c.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: '4px 6px', borderRadius: 6 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <RotateCcw size={14} />
                      </button>
                      <button title="Delete" onClick={() => del(c.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '4px 6px', borderRadius: 6 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {modal === 'create' && (
        <Modal title="Add Client" onClose={() => setModal(null)}>
          <ClientForm inbounds={inbounds} onSave={create} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.edit && (
        <Modal title="Edit Client" onClose={() => setModal(null)}>
          <ClientForm inbounds={inbounds} initial={modal.edit} onSave={form => update(modal.edit.id, form)} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.share && (
        <Modal title="Share / Subscription Link" onClose={() => setModal(null)}>
          <ShareModal clientId={modal.share} onClose={() => setModal(null)} />
        </Modal>
      )}
    </div>
  )
}
