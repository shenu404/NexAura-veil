const express = require('express')
const { execFile, exec } = require('child_process')
const path    = require('path')
const auth    = require('../middleware/auth')
const logger  = require('../utils/logger')

const router = express.Router()
router.use(auth)

const ROOT_DIR = path.join(__dirname, '../../..')

// ── GET /api/update/check ────────────────────────────────────────────────────
router.get('/check', async (req, res) => {
  try {
    exec(`cd ${ROOT_DIR} && git fetch origin && git log HEAD..origin/main --oneline 2>/dev/null`,
      (err, stdout) => {
        const commits = stdout.trim().split('\n').filter(Boolean)
        res.json({
          update_available: commits.length > 0,
          commits_behind:   commits.length,
          changes:          commits.slice(0, 10),
        })
      })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── POST /api/update/apply ───────────────────────────────────────────────────
router.post('/apply', async (req, res) => {
  try {
    res.json({ message: 'Update started — panel will restart in ~30s' })

    // Run update in background after response sent
    setTimeout(() => {
      const script = `
        cd ${ROOT_DIR} &&
        git pull origin main &&
        cd frontend && npm install --silent && npm run build &&
        cd ../backend && npm install --production --silent &&
        pm2 restart nexaura-veil
      `
      exec(script, (err, stdout, stderr) => {
        if (err) logger.error(`[Update] Failed: ${err.message}`)
        else     logger.info(`[Update] Completed successfully`)
      })
    }, 500)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ── GET /api/update/version ──────────────────────────────────────────────────
router.get('/version', (req, res) => {
  try {
    exec(`cd ${ROOT_DIR} && git log -1 --format="%H|%s|%ai" 2>/dev/null`, (err, stdout) => {
      const pkg = require('../../package.json')
      if (err || !stdout.trim()) {
        return res.json({ version: pkg.version, commit: 'unknown' })
      }
      const [hash, subject, date] = stdout.trim().split('|')
      res.json({
        version: pkg.version,
        commit:  hash?.slice(0, 7),
        message: subject,
        date,
      })
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router
