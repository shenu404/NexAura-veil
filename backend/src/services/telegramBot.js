/**
 * telegramBot.js — NexAura Veil Telegram Notifications
 *
 * Notifications sent:
 *  • Client banned (IP violation)
 *  • Client unbanned (auto / manual)
 *  • Client expired
 *  • Client traffic limit hit
 *  • Xray process down
 *  • New client added
 *  • Daily traffic report
 */

const https  = require('https')
const { all, get } = require('../models/database')
const logger = require('../utils/logger')

let BOT_TOKEN   = null
let CHAT_ID     = null
let _dailyTimer = null
let _enabled    = false

// ── Send message ──────────────────────────────────────────────────────────────

function sendMessage(text, parseMode = 'HTML') {
  if (!_enabled || !BOT_TOKEN || !CHAT_ID) return Promise.resolve(null)

  return new Promise((resolve) => {
    const body = JSON.stringify({
      chat_id:    CHAT_ID,
      text,
      parse_mode: parseMode,
      disable_web_page_preview: true,
    })

    const req = https.request({
      hostname: 'api.telegram.org',
      path:     `/bot${BOT_TOKEN}/sendMessage`,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = ''
      res.on('data', d => { data += d })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (!json.ok) logger.warn(`[Telegram] API error: ${json.description}`)
        } catch {}
        resolve(null)
      })
    })

    req.on('error', err => {
      logger.warn(`[Telegram] Send failed: ${err.message}`)
      resolve(null)
    })

    req.write(body)
    req.end()
  })
}

// ── Notification helpers ──────────────────────────────────────────────────────

function fmt(bytes) {
  if (!bytes) return '0 B'
  const units = ['B','KB','MB','GB','TB']
  let i = 0; let v = bytes
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(2)} ${units[i]}`
}

function ts() {
  return new Date().toLocaleString('en-GB', { hour12: false })
}

// ── Public notification functions ─────────────────────────────────────────────

async function notifyBan(email, reason) {
  await sendMessage(
`🚫 <b>Client Banned</b>

👤 <code>${email}</code>
📋 Reason: ${reason}
🕐 Time: ${ts()}

<i>Auto-unban in 1 hour</i>`
  )
}

async function notifyUnban(email, auto = true) {
  await sendMessage(
`✅ <b>Client Unbanned</b>

👤 <code>${email}</code>
🔓 Method: ${auto ? 'Auto (1hr timer)' : 'Manual by admin'}
🕐 Time: ${ts()}`
  )
}

async function notifyExpired(email) {
  await sendMessage(
`⏰ <b>Client Expired</b>

👤 <code>${email}</code>
🕐 Time: ${ts()}
📌 Client has been disabled automatically.`
  )
}

async function notifyTrafficLimit(email, used, limit) {
  await sendMessage(
`📊 <b>Traffic Limit Reached</b>

👤 <code>${email}</code>
📈 Used: ${fmt(used)} / ${fmt(limit)}
🕐 Time: ${ts()}
📌 Client has been disabled automatically.`
  )
}

async function notifyXrayDown() {
  await sendMessage(
`⚠️ <b>Xray Process Down!</b>

🔴 Xray core has stopped unexpectedly.
🕐 Time: ${ts()}

<i>Check: pm2 logs nexaura-veil</i>`
  )
}

async function notifyNewClient(email, inboundTag) {
  await sendMessage(
`➕ <b>New Client Added</b>

👤 <code>${email}</code>
📡 Inbound: <code>${inboundTag}</code>
🕐 Time: ${ts()}`
  )
}

async function sendDailyReport() {
  try {
    const clients  = await all(`SELECT email, up, down, total_gb, enable, expiry_time FROM clients`)
    const active   = clients.filter(c => c.enable)
    const disabled = clients.filter(c => !c.enable)
    const totalUp  = clients.reduce((s, c) => s + (c.up || 0), 0)
    const totalDn  = clients.reduce((s, c) => s + (c.down || 0), 0)

    // Expiring within 3 days
    const soon = clients.filter(c => {
      if (!c.expiry_time || c.expiry_time === 0) return false
      const days = (c.expiry_time - Date.now()) / 86400000
      return days > 0 && days <= 3
    })

    let expiringText = ''
    if (soon.length) {
      expiringText = '\n\n⚠️ <b>Expiring Soon (≤3 days):</b>\n'
      expiringText += soon.map(c => {
        const days = ((c.expiry_time - Date.now()) / 86400000).toFixed(1)
        return `  • <code>${c.email}</code> — ${days}d left`
      }).join('\n')
    }

    await sendMessage(
`📊 <b>Daily Traffic Report</b>

👥 Clients: ${active.length} active / ${disabled.length} disabled
⬆️ Total Upload:   ${fmt(totalUp)}
⬇️ Total Download: ${fmt(totalDn)}
📦 Combined:       ${fmt(totalUp + totalDn)}${expiringText}

🕐 ${ts()} · NexAura Veil`
    )
  } catch (err) {
    logger.warn(`[Telegram] Daily report failed: ${err.message}`)
  }
}

// ── Daily report scheduler ─────────────────────────────────────────────────────

function scheduleDailyReport(hourUTC = 8) {
  if (_dailyTimer) clearTimeout(_dailyTimer)
  const now  = new Date()
  const next = new Date()
  next.setUTCHours(hourUTC, 0, 0, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  const delay = next - now
  _dailyTimer = setTimeout(() => {
    sendDailyReport()
    setInterval(sendDailyReport, 24 * 60 * 60 * 1000)
  }, delay)
  logger.info(`[Telegram] Daily report scheduled — next: ${next.toUTCString()}`)
}

// ── Init ───────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const tokenRow = await get(`SELECT value FROM settings WHERE key='telegram_bot_token'`)
    const chatRow  = await get(`SELECT value FROM settings WHERE key='telegram_chat_id'`)
    const enableRow= await get(`SELECT value FROM settings WHERE key='telegram_enabled'`)

    BOT_TOKEN = tokenRow?.value || process.env.TELEGRAM_BOT_TOKEN || null
    CHAT_ID   = chatRow?.value  || process.env.TELEGRAM_CHAT_ID   || null
    _enabled  = (enableRow?.value === '1') || (!!BOT_TOKEN && !!CHAT_ID)

    if (_enabled) {
      logger.info(`[Telegram] Bot enabled → chat ${CHAT_ID}`)
      scheduleDailyReport(8)
      await sendMessage('🛡️ <b>NexAura Veil</b> started successfully!')
    } else {
      logger.info('[Telegram] Bot disabled (no token/chat_id configured)')
    }
  } catch (err) {
    logger.warn(`[Telegram] Init failed: ${err.message}`)
  }
}

function isEnabled()    { return _enabled }
function setEnabled(v)  { _enabled = v }
function setToken(t)    { BOT_TOKEN = t }
function setChatId(id)  { CHAT_ID = id }

module.exports = {
  init,
  sendMessage,
  notifyBan,
  notifyUnban,
  notifyExpired,
  notifyTrafficLimit,
  notifyXrayDown,
  notifyNewClient,
  sendDailyReport,
  isEnabled,
  setEnabled,
  setToken,
  setChatId,
}
