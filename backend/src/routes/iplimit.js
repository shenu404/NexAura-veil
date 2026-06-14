const express = require('express');
const auth    = require('../middleware/auth');
const svc     = require('../services/ipLimitService');

const router = express.Router();
router.use(auth);

// GET /api/iplimit/stats — all client IP stats
router.get('/stats', async (req, res) => {
  try { res.json(await svc.getIPStats()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/iplimit/bans — active ban list
router.get('/bans', async (req, res) => {
  try { res.json(await svc.getBanList()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/iplimit/unban/:email — manual unban
router.post('/unban/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    await svc.unbanClient(email, false);
    res.json({ message: `${email} unbanned` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/iplimit/reset/:email — clear tracked IP (not a ban)
router.post('/reset/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email);
    svc.clearClientIPs(email);
    res.json({ message: `IP cleared for ${email}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/iplimit/ban/:email — manual ban by admin
router.post('/ban/:email', async (req, res) => {
  try {
    const email  = decodeURIComponent(req.params.email)
    const reason = req.body?.reason || 'Manual ban by admin'
    // Check client exists
    const { get } = require('../models/database')
    const client  = await get('SELECT id FROM clients WHERE email = ?', [email])
    if (!client) return res.status(404).json({ error: 'Client not found' })
    if (svc.isClientBanned(email)) return res.status(400).json({ error: 'Already banned' })
    await svc.banClient(email, reason)
    res.json({ message: `${email} banned`, reason })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/iplimit/logs?limit=100 — event log
router.get('/logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100'), 500)
    res.json(svc.getLogs(limit))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// GET /api/iplimit/ping/:email — latest known IP + status
router.get('/ping/:email', async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email)
    const stats = await svc.getIPStats()
    const info  = stats[email]
    if (!info) return res.status(404).json({ error: 'Client not found' })
    res.json({
      email,
      currentIP: info.currentIP,
      lastSeen:  info.lastSeen,
      banned:    info.banned,
      banInfo:   info.banInfo,
      online:    !!(info.currentIP && !info.banned),
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router;
