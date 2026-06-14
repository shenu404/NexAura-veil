export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

export function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function formatExpiry(ts) {
  if (!ts || ts === 0) return 'Never'
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function isExpired(ts) {
  if (!ts || ts === 0) return false
  return Date.now() > ts
}

export function isExpiringSoon(ts, days = 3) {
  if (!ts || ts === 0) return false
  return !isExpired(ts) && (ts - Date.now()) < days * 86400 * 1000
}

export function protocolColor(protocol) {
  const map = {
    vmess: 'badge-blue',
    vless: 'badge-purple',
    trojan: 'badge-amber',
    shadowsocks: 'badge-green',
    socks: 'badge-red',
    http: 'badge-red',
  }
  return map[protocol?.toLowerCase()] || 'badge-purple'
}

export function copyToClipboard(text) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  })
}
