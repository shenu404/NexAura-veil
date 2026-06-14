const express  = require('express')
const { run, get } = require('../models/database')
const telegram = require('../services/telegramBot')
const auth     = require('../middleware/auth')

const router = express.Router()
router.use(auth)

// GET /api/telegram/status
router.get('/status', async (req, res) => {
  try {
    const token  = await get(`SELECT value FROM settings WHERE key='telegram_bot_token'`)
    const chat   = await get(`SELECT value FROM settings WHERE key='telegram_chat_id'`)
    const enabled= await get(`SELECT value FROM settings WHERE key='telegram_enabled'`)
    res.json({
      enabled:   enabled?.value === '1',
      has_token: !!token?.value,
      has_chat:  !!chat?.value,
      active:    telegram.isEnabled(),
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/telegram/settings — save token + chat_id
router.post('/settings', async (req, res) => {
  try {
    const { bot_token, chat_id, enabled } = req.body
    if (!bot_token || !chat_id) return res.status(400).json({ error: 'bot_token and chat_id required' })

    await run(`INSERT INTO settings (key,value) VALUES ('telegram_bot_token',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [bot_token])
    await run(`INSERT INTO settings (key,value) VALUES ('telegram_chat_id',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [chat_id])
    await run(`INSERT INTO settings (key,value) VALUES ('telegram_enabled',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [enabled ? '1' : '0'])

    telegram.setToken(bot_token)
    telegram.setChatId(chat_id)
    telegram.setEnabled(!!enabled)

    if (enabled) {
      await telegram.sendMessage('✅ <b>NexAura Veil</b> Telegram notifications enabled!')
    }

    res.json({ message: 'Telegram settings saved' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/telegram/test — send test message
router.post('/test', async (req, res) => {
  try {
    if (!telegram.isEnabled()) return res.status(400).json({ error: 'Telegram not configured' })
    await telegram.sendMessage('🧪 <b>NexAura Veil</b> — Test message\n\nTelegram bot is working correctly! ✅')
    res.json({ message: 'Test message sent' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// POST /api/telegram/report — send daily report now
router.post('/report', async (req, res) => {
  try {
    if (!telegram.isEnabled()) return res.status(400).json({ error: 'Telegram not configured' })
    await telegram.sendDailyReport()
    res.json({ message: 'Report sent' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
