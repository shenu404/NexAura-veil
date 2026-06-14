const express    = require('express');
const { all, get } = require('../models/database');
const auth       = require('../middleware/auth');
const xrayApi    = require('../services/xrayApiService');
const xrayService = require('../services/xrayService');
const { generateConfig, writeConfig } = require('../services/xrayConfig');
const logger     = require('../utils/logger');

const router = express.Router();

// ─── GET /api/xray/config ─────────────────────────────────────────────────────
router.get('/config', auth, async (req, res) => {
  try {
    res.json(await generateConfig());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/xray/status ─────────────────────────────────────────────────────
router.get('/status', auth, async (req, res) => {
  try {
    const proc      = xrayService.status();
    const apiOnline = await xrayApi.isApiReachable();
    res.json({
      ...proc,
      api_reachable:   apiOnline,
      api_addr:        process.env.XRAY_API_ADDR || '127.0.0.1:62789',
      live_management: apiOnline,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/xray/restart ───────────────────────────────────────────────────
router.post('/restart', auth, async (req, res) => {
  try {
    await writeConfig();
    await xrayService.restart();
    res.json({ message: 'Xray restarted', status: xrayService.status() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/xray/start ─────────────────────────────────────────────────────
router.post('/start', auth, async (req, res) => {
  try {
    await writeConfig();
    await xrayService.start();
    res.json({ message: 'Xray started', status: xrayService.status() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/xray/stop ──────────────────────────────────────────────────────
router.post('/stop', auth, async (req, res) => {
  try {
    xrayService.stop();
    res.json({ message: 'Xray stopped' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/xray/stats ──────────────────────────────────────────────────────
router.get('/stats', auth, async (req, res) => {
  try {
    const reset = req.query.reset === 'true';
    res.json(await xrayApi.queryStats(reset));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /sub/:token — subscription endpoint (no auth, token-gated) ──────────
// FIX 3: host strips port suffix added by reverse proxy headers
router.get('/sub/:token', async (req, res) => {
  try {
    const client = await get(
      `SELECT * FROM clients WHERE sub_token = ? AND enable = 1`,
      [req.params.token]
    );
    if (!client) return res.status(404).send('Not found');

    if (client.expiry_time > 0 && Date.now() > client.expiry_time) {
      return res.status(403).send('Subscription expired');
    }

    // All enabled inbounds for this client via join table
    let inbounds = await all(`
      SELECT i.*
      FROM inbounds i
      JOIN client_inbounds ci ON ci.inbound_id = i.id
      WHERE ci.client_id = ? AND i.enabled = 1
      ORDER BY i.id ASC
    `, [client.id]);

    // Fallback to primary inbound_id
    if (!inbounds.length && client.inbound_id) {
      const primary = await get(
        `SELECT * FROM inbounds WHERE id = ? AND enabled = 1`,
        [client.inbound_id]
      );
      if (primary) inbounds.push(primary);
    }

    if (!inbounds.length) return res.status(404).send('No active inbounds');

    // ── FIX 3: clean host — strip :PORT added by some reverse proxies ─────────
    const rawHost = req.headers['x-forwarded-host'] || req.headers.host || req.hostname;
    const host    = rawHost.replace(/:\d+$/, '');

    const links = [];

    for (const inbound of inbounds) {
      const link = buildLink(client, inbound, host);
      if (link) links.push(link);
    }

    if (!links.length) return res.status(404).send('No configs available');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Profile-Update-Interval', '12');
    res.setHeader('Subscription-Userinfo',
      `upload=${client.up || 0}; download=${client.down || 0}; total=${client.total_gb || 0}; expire=${Math.floor((client.expiry_time || 0) / 1000)}`
    );
    res.setHeader('Content-Disposition',
      `attachment; filename="${encodeURIComponent(client.email)}.txt"`
    );
    res.setHeader('Profile-Title', `base64:${Buffer.from(client.email).toString('base64')}`);

    res.send(Buffer.from(links.join('\n')).toString('base64'));
    logger.info(`[sub] Served ${links.length} config(s) for ${client.email}`);
  } catch (err) {
    logger.error(`[sub] ${err.message}`);
    res.status(500).send('Error');
  }
});

// ─── shared link builder ──────────────────────────────────────────────────────

function buildLink(client, inbound, host) {
  let ss = {};
  try { ss = JSON.parse(inbound.stream_settings || '{}'); } catch {}

  const network  = ss.network  || 'tcp';
  const security = ss.security || 'none';
  const p        = new URLSearchParams();
  p.set('type', network);

  if (network === 'ws') {
    const ws = ss.wsSettings || {};
    p.set('path', ws.path || '/');
    if (ws.headers?.Host) p.set('host', ws.headers.Host);
  }
  if (network === 'grpc') {
    const g = ss.grpcSettings || {};
    p.set('serviceName', g.serviceName || '');
    p.set('mode', g.multiMode ? 'multi' : 'gun');
  }
  if (network === 'h2' || network === 'http') {
    const h = ss.httpSettings || {};
    p.set('path', h.path || '/');
    if (h.host?.length) p.set('host', h.host[0]);
  }
  if (network === 'kcp' || network === 'mkcp') {
    const k = ss.kcpSettings || {};
    p.set('headerType', k.header?.type || 'none');
    if (k.seed) p.set('seed', k.seed);
  }

  p.set('security', security);

  if (security === 'tls') {
    const t = ss.tlsSettings || {};
    if (t.serverName)    p.set('sni', t.serverName);
    if (t.alpn?.length)  p.set('alpn', t.alpn.join(','));
    if (t.fingerprint)   p.set('fp', t.fingerprint);
    if (t.allowInsecure) p.set('allowInsecure', '1');
  }
  if (security === 'reality') {
    const r = ss.realitySettings || {};
    if (r.serverNames?.[0]) p.set('sni', r.serverNames[0]);
    if (r.fingerprint)      p.set('fp', r.fingerprint);
    if (r.publicKey)        p.set('pbk', r.publicKey);
    if (r.shortIds?.[0])    p.set('sid', r.shortIds[0]);
    if (r.spiderX)          p.set('spx', r.spiderX);
  }
  if (client.flow) p.set('flow', client.flow);

  const remark = encodeURIComponent(`${client.email} | ${inbound.tag}`);

  if (inbound.protocol === 'vless') {
    return `vless://${client.uuid}@${host}:${inbound.port}?${p.toString()}#${remark}`;
  }
  if (inbound.protocol === 'trojan') {
    return `trojan://${client.uuid}@${host}:${inbound.port}?${p.toString()}#${remark}`;
  }
  if (inbound.protocol === 'vmess') {
    const obj = {
      v: '2', ps: `${client.email} | ${inbound.tag}`,
      add: host, port: String(inbound.port),
      id: client.uuid, aid: '0', scy: 'auto',
      net: network, type: 'none',
      tls: security === 'tls' ? 'tls' : '',
    };
    if (network === 'ws') {
      const ws = ss.wsSettings || {};
      obj.path = ws.path || '/';
      obj.host = ws.headers?.Host || '';
    }
    if (security === 'tls') {
      obj.sni = ss.tlsSettings?.serverName || '';
      obj.fp  = ss.tlsSettings?.fingerprint || '';
    }
    return 'vmess://' + Buffer.from(JSON.stringify(obj)).toString('base64');
  }
  if (inbound.protocol === 'shadowsocks') {
    let settings = {};
    try { settings = JSON.parse(inbound.settings || '{}'); } catch {}
    const method   = settings.method   || 'chacha20-ietf-poly1305';
    const password = settings.password || client.uuid;
    const userinfo = Buffer.from(`${method}:${password}`).toString('base64');
    return `ss://${userinfo}@${host}:${inbound.port}#${remark}`;
  }
  return '';
}

module.exports = router;
