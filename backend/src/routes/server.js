const express = require('express');
const os      = require('os');
const { run, get, all } = require('../models/database');
const auth        = require('../middleware/auth');
const xrayService = require('../services/xrayService');
const xrayApi     = require('../services/xrayApiService');

const router = express.Router();
router.use(auth);

function buildStatus() {
  const load     = os.loadavg();
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  return {
    cpus:     os.cpus().length,
    load:     load[0].toFixed(2),
    memTotal: totalMem,
    memFree:  freeMem,
    memUsed:  totalMem - freeMem,
    uptime:   os.uptime(),
    xray:     xrayService.status(),
  };
}

// ─── GET /api/server/stats + /api/server/status ───────────────────────────────
async function statsHandler(req, res) {
  try {
    const inboundsRow = await get(`SELECT COUNT(*) as count FROM inbounds WHERE enabled=1`);
    const online = xrayApi.getOnlineClients();
    const clientsRow  = await get(`SELECT COUNT(*) as count FROM clients WHERE enable=1`);
    const traffic     = await get(`SELECT SUM(up) as up, SUM(down) as down FROM inbounds`);
    res.json({
      data: {
        inbounds: inboundsRow.count,
        clients:  clientsRow.count,
        traffic:  { up: traffic.up || 0, down: traffic.down || 0 },
        online:   Object.keys(online).length,
        system:   buildStatus(),
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

router.get('/stats',  statsHandler);
router.get('/status', statsHandler);

// ─── GET /api/server/settings ────────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  try {
    const rows = await all(`SELECT key, value FROM settings`);
    const obj  = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    res.json({ data: obj });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /api/server/settings ────────────────────────────────────────────────
router.put('/settings', async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await run(
        `INSERT INTO settings (key, value) VALUES (?,?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
        [key, value]
      );
    }
    res.json({ message: 'Settings updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Xray process control ─────────────────────────────────────────────────────
router.post('/xray/start', async (req, res) => {
  try { await xrayService.start(); res.json({ message: 'Xray started',   status: xrayService.status() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/xray/stop', async (req, res) => {
  try { xrayService.stop();        res.json({ message: 'Xray stopped',   status: xrayService.status() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});
router.post('/xray/restart', async (req, res) => {
  try { await xrayService.restart(); res.json({ message: 'Xray restarted', status: xrayService.status() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/server/traffic-history ─────────────────────────────────────────
router.get('/traffic-history', async (req, res) => {
  try {
    const rows = await all(
      `SELECT tag, up, down, recorded_at FROM traffic_logs ORDER BY recorded_at DESC LIMIT 168`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/server/user-stats ───────────────────────────────────────────────
// FIX: join via client_inbounds so multi-inbound clients show correct inbound
router.get('/user-stats', async (req, res) => {
  try {
    const rows = await all(`
      SELECT
        c.email,
        c.up, c.down, c.total_gb, c.enable,
        c.expiry_time,
        GROUP_CONCAT(i.tag, ', ')  AS inbounds,
        GROUP_CONCAT(i.protocol, ', ') AS protocols
      FROM clients c
      LEFT JOIN client_inbounds ci ON ci.client_id = c.id
      LEFT JOIN inbounds i ON i.id = ci.inbound_id
      GROUP BY c.id
      ORDER BY (c.up + c.down) DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/server/stats/poller ────────────────────────────────────────────
router.get('/stats/poller', async (req, res) => {
  try {
    const statsPoller = require('../services/statsPoller');
    res.json({ running: statsPoller.isRunning() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/server/online ───────────────────────────────────────────────────
router.get('/online', (req, res) => {
  try {
    const online = xrayApi.getOnlineClients()
    res.json({
      count:   Object.keys(online).length,
      clients: online,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

module.exports = router;
