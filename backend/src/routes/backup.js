const express = require('express')
const fs      = require('fs')
const path    = require('path')
const auth    = require('../middleware/auth')
const { all, run, get } = require('../models/database')
const logger  = require('../utils/logger')

const router = express.Router()
router.use(auth)

const DB_PATH     = process.env.DB_PATH || './data/nexaura.db'
const BACKUP_DIR  = path.join(path.dirname(DB_PATH), 'backups')

// ── GET /api/backup/list ──────────────────────────────────────────────────────
router.get('/list', (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json([])
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f))
        return { name: f, size: stat.size, created_at: stat.mtime.toISOString() }
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    res.json(files)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── POST /api/backup/create ───────────────────────────────────────────────────
router.post('/create', async (req, res) => {
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })

    const inbounds = await all(`SELECT * FROM inbounds`)
    const clients  = await all(`SELECT * FROM clients`)
    const ci       = await all(`SELECT * FROM client_inbounds`)
    const settings = await all(`SELECT * FROM settings`)

    const backup = {
      version:    '1.1.0',
      created_at: new Date().toISOString(),
      inbounds, clients, client_inbounds: ci, settings,
    }

    const filename = `veil-backup-${Date.now()}.json`
    const filepath = path.join(BACKUP_DIR, filename)
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2))

    logger.info(`[Backup] Created: ${filename}`)
    res.json({ message: 'Backup created', filename, size: fs.statSync(filepath).size })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── GET /api/backup/download/:filename ───────────────────────────────────────
router.get('/download/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename)
    const filepath = path.join(BACKUP_DIR, filename)
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Backup not found' })
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/json')
    res.sendFile(path.resolve(filepath))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── POST /api/backup/restore ──────────────────────────────────────────────────
router.post('/restore', async (req, res) => {
  try {
    const { filename, data } = req.body

    let backup
    if (data) {
      // Restore from uploaded JSON body
      backup = typeof data === 'string' ? JSON.parse(data) : data
    } else if (filename) {
      const filepath = path.join(BACKUP_DIR, path.basename(filename))
      if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Backup not found' })
      backup = JSON.parse(fs.readFileSync(filepath, 'utf8'))
    } else {
      return res.status(400).json({ error: 'Provide filename or data' })
    }

    if (!backup.inbounds || !backup.clients) {
      return res.status(400).json({ error: 'Invalid backup format' })
    }

    // Clear existing data
    await run(`DELETE FROM client_inbounds`)
    await run(`DELETE FROM clients`)
    await run(`DELETE FROM inbounds`)

    // Restore inbounds
    for (const ib of backup.inbounds) {
      await run(`INSERT OR REPLACE INTO inbounds VALUES (${Object.keys(ib).map(() => '?').join(',')})`,
        Object.values(ib))
    }

    // Restore clients
    for (const cl of backup.clients) {
      await run(`INSERT OR REPLACE INTO clients VALUES (${Object.keys(cl).map(() => '?').join(',')})`,
        Object.values(cl))
    }

    // Restore client_inbounds
    for (const ci of (backup.client_inbounds || [])) {
      await run(`INSERT OR IGNORE INTO client_inbounds (client_id, inbound_id) VALUES (?,?)`,
        [ci.client_id, ci.inbound_id])
    }

    // Restore settings (skip sensitive)
    for (const s of (backup.settings || [])) {
      if (s.key === 'admin_password') continue // don't overwrite password
      await run(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        [s.key, s.value])
    }

    logger.info(`[Backup] Restored: ${backup.inbounds.length} inbounds, ${backup.clients.length} clients`)
    res.json({
      message:  'Restore successful — restart Xray to apply',
      inbounds: backup.inbounds.length,
      clients:  backup.clients.length,
    })
  } catch (e) {
    logger.error(`[Backup] Restore failed: ${e.message}`)
    res.status(500).json({ error: e.message })
  }
})

// ── DELETE /api/backup/:filename ──────────────────────────────────────────────
router.delete('/:filename', (req, res) => {
  try {
    const filepath = path.join(BACKUP_DIR, path.basename(req.params.filename))
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Not found' })
    fs.unlinkSync(filepath)
    res.json({ message: 'Backup deleted' })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
