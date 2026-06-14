import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, RotateCcw, Copy, ChevronDown, ChevronRight, Users, X, Loader2 } from 'lucide-react'
import api from '../lib/api'
import { formatBytes, formatExpiry, isExpired, protocolColor, copyToClipboard } from '../lib/utils'

const PROTOCOLS = ['vmess', 'vless', 'trojan', 'shadowsocks', 'socks', 'http']
const NETWORKS = ['tcp', 'kcp', 'ws', 'http', 'quic', 'grpc']
const SECURITIES = ['none', 'tls', 'reality']

function Modal({ title, onClose, children }) {
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
        width: '100%', maxWidth: '512px',
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


function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: '#9d7fc7', fontWeight: 500, display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  )
}

function InboundForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || {
    remark: '', protocol: 'vmess', port: '', enable: true,
    network: 'tcp', security: 'none', path: '', host: '',
    total: 0, expiry_time: 0,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.remark || !form.port) return setErr('Remark and port are required')
    setSaving(true); setErr('')
    try {
      await onSave(form)
      onClose()
    } catch (e) {
      setErr(e.response?.data?.msg || 'Error saving')
    }
    setSaving(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field label="Remark">
          <input className="nx-input" value={form.remark} onChange={e => set('remark', e.target.value)} placeholder="My Inbound" />
        </Field>
        <Field label="Port">
          <input className="nx-input" type="number" value={form.port} onChange={e => set('port', Number(e.target.value))} placeholder="10086" />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field label="Protocol">
          <select className="nx-input" value={form.protocol} onChange={e => set('protocol', e.target.value)}>
            {PROTOCOLS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Network">
          <select className="nx-input" value={form.network} onChange={e => set('network', e.target.value)}>
            {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field label="Security">
          <select className="nx-input" value={form.security} onChange={e => set('security', e.target.value)}>
            {SECURITIES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Path (WS/gRPC)">
          <input className="nx-input" value={form.path} onChange={e => set('path', e.target.value)} placeholder="/ws" />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <Field label="Total Traffic (GB, 0=unlimited)">
          <input className="nx-input" type="number" value={form.total} onChange={e => set('total', Number(e.target.value))} />
        </Field>
        <Field label="Expiry Date">
          <input className="nx-input" type="date"
            value={form.expiry_time ? new Date(form.expiry_time).toISOString().split('T')[0] : ''}
            onChange={e => set('expiry_time', e.target.value ? new Date(e.target.value).getTime() : 0)} />
        </Field>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          <input type="checkbox" checked={form.enable} onChange={e => set('enable', e.target.checked)}
            style={{ accentColor: '#8040ff', width: 15, height: 15 }} />
          <span style={{ fontSize: 13, color: '#9d7fc7' }}>Enable</span>
        </label>
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
        }}>
          Cancel
        </button>
        <button onClick={submit} disabled={saving} className="btn-glow" style={{
          flex: 1, padding: '10px', borderRadius: '8px', fontSize: 13,
          cursor: saving ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          color: 'white', border: 'none', opacity: saving ? 0.7 : 1,
        }}>
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving ? 'Saving...' : 'Save Inbound'}
        </button>
      </div>
    </div>
  )
}

export default function InboundsPage() {
  const [inbounds, setInbounds] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'create' | {edit: ib}
  const [expanded, setExpanded] = useState({})
  const [toast, setToast] = useState('')

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const load = useCallback(async () => {
    const { data } = await api.get('/inbounds')
    setInbounds(Array.isArray(data) ? data : (data.data || []))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const create = async form => {
    const streamSettings = { network: form.network, security: form.security }
    if (form.network === 'ws') streamSettings.wsSettings = { path: form.path, headers: { Host: form.host } }
    await api.post('/inbounds', {
      remark: form.remark, protocol: form.protocol, port: Number(form.port),
      stream_settings: streamSettings, enable: form.enable,
      total: form.total * 1024 * 1024 * 1024, expiry_time: form.expiry_time,
    })
    showToast('Inbound created'); load()
  }

  const update = async (id, form) => {
    await api.put(`/inbounds/${id}`, { remark: form.remark, enable: form.enable })
    showToast('Inbound updated'); load()
  }

  const del = async id => {
    if (!confirm('Delete this inbound and all its clients?')) return
    await api.delete(`/inbounds/${id}`)
    showToast('Deleted'); load()
  }

  const resetTraffic = async id => {
    await api.post(`/inbounds/${id}/reset`)
    showToast('Traffic reset'); load()
  }

  const toggleExpand = id => setExpanded(p => ({ ...p, [id]: !p[id] }))

  if (loading) return <div className="flex items-center justify-center h-64"><div style={{ color: '#8040ff' }} className="animate-pulse">Loading...</div></div>

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-lg fade-in"
          style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', fontSize: 13 }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#c4b5ff', letterSpacing: '-0.02em' }}>Inbounds</h1>
          <p style={{ fontSize: 13, color: '#6b5a8a', marginTop: 2 }}>{inbounds.length} inbound{inbounds.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal('create')} className="btn-glow px-4 py-2 rounded-lg flex items-center gap-2"
          style={{ color: 'white', border: 'none', cursor: 'pointer', fontSize: 13 }}>
          <Plus size={15} /> Add Inbound
        </button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <table className="nx-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}></th>
              <th>Remark</th><th>Protocol</th><th>Port</th>
              <th>Traffic ↑ / ↓</th><th>Clients</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {inbounds.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: '#3d2860', padding: '32px 0', fontSize: 13 }}>
                No inbounds. Click "Add Inbound" to create one.
              </td></tr>
            )}
            {inbounds.map(ib => (
              <>
                <tr key={ib.id} style={{ cursor: 'pointer' }}>
                  <td onClick={() => toggleExpand(ib.id)}>
                    {expanded[ib.id] ? <ChevronDown size={14} style={{ color: '#8040ff' }} /> : <ChevronRight size={14} style={{ color: '#6b5a8a' }} />}
                  </td>
                  <td style={{ color: '#e2d9f3', fontWeight: 500 }}>{ib.remark}</td>
                  <td><span className={`badge ${protocolColor(ib.protocol)}`}>{ib.protocol}</span></td>
                  <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#a78bfa' }}>{ib.port}</td>
                  <td style={{ fontSize: 12 }}>
                    <span style={{ color: '#22c55e' }}>↑{formatBytes(ib.up)}</span>
                    <span style={{ color: '#3d2860', margin: '0 4px' }}>/</span>
                    <span style={{ color: '#8040ff' }}>↓{formatBytes(ib.down)}</span>
                    {ib.total > 0 && <span style={{ color: '#6b5a8a', marginLeft: 4 }}>/ {formatBytes(ib.total)}</span>}
                  </td>
                  <td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#9d7fc7', fontSize: 12 }}>
                      <Users size={12} /> {ib.client_count}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${ib.enable ? 'badge-green' : 'badge-red'}`}>
                      {ib.enable ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button title="Edit" onClick={() => setModal({ edit: ib })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8040ff', padding: '4px 6px', borderRadius: 6 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(128,64,255,0.12)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <Pencil size={14} />
                      </button>
                      <button title="Reset traffic" onClick={() => resetTraffic(ib.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', padding: '4px 6px', borderRadius: 6 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <RotateCcw size={14} />
                      </button>
                      <button title="Delete" onClick={() => del(ib.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '4px 6px', borderRadius: 6 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                {expanded[ib.id] && (
                  <tr key={`${ib.id}-exp`}>
                    <td colSpan={8} style={{ padding: '0 14px 12px 42px' }}>
                      <div className="rounded-lg p-3" style={{ background: 'rgba(128,64,255,0.06)', border: '1px solid rgba(128,64,255,0.1)', fontSize: 12 }}>
                        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                          <div>
                            <span style={{ color: '#6b5a8a' }}>Tag:</span>
                            <span style={{ color: '#c4b5ff', marginLeft: 6, fontFamily: 'JetBrains Mono, monospace' }}>{ib.tag}</span>
                          </div>
                          <div>
                            <span style={{ color: '#6b5a8a' }}>Network:</span>
                            <span style={{ color: '#c4b5ff', marginLeft: 6 }}>{ib.stream_settings?.network || 'tcp'}</span>
                          </div>
                          <div>
                            <span style={{ color: '#6b5a8a' }}>Security:</span>
                            <span style={{ color: '#c4b5ff', marginLeft: 6 }}>{ib.stream_settings?.security || 'none'}</span>
                          </div>
                          <div>
                            <span style={{ color: '#6b5a8a' }}>Expiry:</span>
                            <span style={{ color: ib.expiry_time && isExpired(ib.expiry_time) ? '#f87171' : '#c4b5ff', marginLeft: 6 }}>
                              {formatExpiry(ib.expiry_time)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      {modal === 'create' && (
        <Modal title="Add Inbound" onClose={() => setModal(null)}>
          <InboundForm onSave={create} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.edit && (
        <Modal title="Edit Inbound" onClose={() => setModal(null)}>
          <InboundForm
            initial={{ ...modal.edit, network: modal.edit.stream_settings?.network || 'tcp', security: modal.edit.stream_settings?.security || 'none' }}
            onSave={form => update(modal.edit.id, form)}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}
