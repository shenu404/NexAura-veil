const express  = require('express')
const telegram = require('../services/telegramBot');
const { run, get, all } = require('../models/database');
const auth = require('../middleware/auth');
const crypto = require('crypto');
const xrayApi = require('../services/xrayApiService');
const logger = require('../utils/logger');

const router = express.Router();
router.use(auth);

function genUUID()  { return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'); }
function genToken() { return crypto.randomBytes(16).toString('hex'); }
function genSubId() { return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'); }

// ─── Sub-link builder ─────────────────────────────────────────────────────────
function buildSubLink(client, inbound, host) {
  const { protocol, port } = inbound;
  const { uuid, flow = '', email } = client;

  let ss = {};
  try { ss = JSON.parse(inbound.stream_settings || '{}'); } catch {}

  const network  = ss.network  || 'tcp';
  const security = ss.security || 'none';
  const p = new URLSearchParams();
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
  if (flow) p.set('flow', flow);

  const remark = encodeURIComponent(`${email} | ${inbound.tag || inbound.remark || ''}`);
  const qs     = p.toString();

  if (protocol === 'vless')  return `vless://${uuid}@${host}:${port}?${qs}#${remark}`;
  if (protocol === 'trojan') return `trojan://${uuid}@${host}:${port}?${qs}#${remark}`;
  if (protocol === 'vmess') {
    const obj = {
      v: '2', ps: `${email} | ${inbound.tag || ''}`,
      add: host.split(':')[0], port: String(port),
      id: uuid, aid: '0', scy: 'auto', net: network, type: 'none',
      tls: security === 'tls' ? 'tls' : '',
    };
    if (network === 'ws') {
      const ws = ss.wsSettings || {};
      obj.path = ws.path || '/'; obj.host = ws.headers?.Host || '';
    }
    if (security === 'tls') {
      obj.sni = ss.tlsSettings?.serverName || '';
      obj.fp  = ss.tlsSettings?.fingerprint || '';
    }
    return 'vmess://' + Buffer.from(JSON.stringify(obj)).toString('base64');
  }
  if (protocol === 'shadowsocks') {
    let settings = {};
    try { settings = JSON.parse(inbound.settings || '{}'); } catch {}
    const method   = settings.method   || 'chacha20-ietf-poly1305';
    const password = settings.password || uuid;
    const userinfo = Buffer.from(`${method}:${password}`).toString('base64');
    return `ss://${userinfo}@${host}:${port}#${remark}`;
  }
  return '';
}

// ─── Helper: get all inbounds for a client ────────────────────────────────────
async function getClientInbounds(clientId) {
  return all(`
    SELECT i.*
    FROM inbounds i
    JOIN client_inbounds ci ON ci.inbound_id = i.id
    WHERE ci.client_id = ? AND i.enabled = 1
    ORDER BY i.id ASC
  `, [clientId]);
}

// ─── Helper: sync client to xray (add to all its inbounds) ───────────────────
async function xraySyncClient(client, inbounds, action = 'add') {
  let liveCount = 0;
  for (const inbound of inbounds) {
    try {
      if (action === 'add') {
        await xrayApi.addUser(inbound.tag, inbound.protocol, {
          uuid: client.uuid, email: client.email, flow: client.flow || '',
        });
      } else {
        await xrayApi.removeUser(inbound.tag, client.email);
      }
      liveCount++;
    } catch (err) {
      logger.warn(`[clients] xray ${action} failed on ${inbound.tag}: ${err.message}`);
    }
  }
  return liveCount;
}

// ─── GET /api/clients ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { inbound_id } = req.query;

    // Fetch clients with their PRIMARY inbound (for display)
    // Also fetch all inbound tags as a comma-separated list
    const sql = inbound_id
      ? `SELECT c.*,
           i.tag as inbound_remark, i.protocol, i.port,
           (SELECT GROUP_CONCAT(ib.tag, ', ')
            FROM client_inbounds ci2
            JOIN inbounds ib ON ib.id = ci2.inbound_id
            WHERE ci2.client_id = c.id) as all_inbounds
         FROM clients c
         LEFT JOIN inbounds i ON i.id = c.inbound_id
         WHERE c.inbound_id = ? OR EXISTS (
           SELECT 1 FROM client_inbounds ci WHERE ci.client_id = c.id AND ci.inbound_id = ?
         )
         ORDER BY c.id DESC`
      : `SELECT c.*,
           i.tag as inbound_remark, i.protocol, i.port,
           (SELECT GROUP_CONCAT(ib.tag, ', ')
            FROM client_inbounds ci2
            JOIN inbounds ib ON ib.id = ci2.inbound_id
            WHERE ci2.client_id = c.id) as all_inbounds
         FROM clients c
         LEFT JOIN inbounds i ON i.id = c.inbound_id
         ORDER BY c.id DESC`;

    const rows = await all(sql, inbound_id ? [inbound_id, inbound_id] : []);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/clients ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      inbound_id,           // primary inbound (required for backward compat)
      inbound_ids,          // array of ALL inbounds (multi-inbound)
      email,
      flow = '', limit_ip = 0,
      total = 0, total_gb,
      expiry_time = 0, enable = true,
    } = req.body;

    if (!email) return res.status(400).json({ error: 'email is required' });

    // Support both single inbound_id and multi inbound_ids[]
    const primaryId = inbound_id || (inbound_ids && inbound_ids[0]);
    if (!primaryId)  return res.status(400).json({ error: 'at least one inbound required' });

    const allInboundIds = inbound_ids?.length ? inbound_ids : [primaryId];

    // Validate all inbounds exist
    const inbounds = [];
    for (const ibId of allInboundIds) {
      const ib = await get(`SELECT * FROM inbounds WHERE id = ?`, [ibId]);
      if (!ib) return res.status(404).json({ error: `Inbound ${ibId} not found` });
      inbounds.push(ib);
    }

    const uuid       = genUUID();
    const sub_token  = genToken();
    const sub_id     = genSubId();
    const totalBytes = total || (total_gb ? total_gb * 1024 * 1024 * 1024 : 0);

    // 1. Insert client with primary inbound
    const result = await run(
      `INSERT INTO clients
         (inbound_id, email, uuid, flow, limit_ip, total_gb, expiry_time, enable, sub_token, sub_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [primaryId, email, uuid, flow, limit_ip, totalBytes, expiry_time, enable ? 1 : 0, sub_token, sub_id]
    );
    const clientId = result.lastID;

    // 2. Insert all client_inbounds links
    for (const ibId of allInboundIds) {
      await run(
        `INSERT OR IGNORE INTO client_inbounds (client_id, inbound_id) VALUES (?,?)`,
        [clientId, ibId]
      );
    }

    const created = await get(`SELECT * FROM clients WHERE id = ?`, [clientId]);

    // 3. Live add to xray on all inbounds
    let liveCount = 0;
    if (enable) {
      liveCount = await xraySyncClient(created, inbounds, 'add');
    }

    logger.info(`[clients] Created ${email} on ${inbounds.length} inbound(s), xray live: ${liveCount}/${inbounds.length}`);
    res.status(201).json({
      ...created,
      inbound_ids: allInboundIds,
      xray_live: liveCount === inbounds.length,
      xray_live_count: liveCount,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /api/clients/:id ─────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { email, flow, limit_ip, total, total_gb, expiry_time, enable, inbound_ids } = req.body;
    const totalBytes = total !== undefined ? total : (total_gb ? total_gb * 1024 * 1024 * 1024 : undefined);

    const existing = await get(`SELECT * FROM clients WHERE id = ?`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Client not found' });

    // Update main client row
    await run(
      `UPDATE clients SET
        email=COALESCE(?,email), flow=COALESCE(?,flow),
        limit_ip=COALESCE(?,limit_ip), total_gb=COALESCE(?,total_gb),
        expiry_time=COALESCE(?,expiry_time), enable=COALESCE(?,enable)
       WHERE id=?`,
      [email, flow, limit_ip,
       totalBytes !== undefined ? totalBytes : null,
       expiry_time, enable !== undefined ? (enable ? 1 : 0) : null,
       req.params.id]
    );

    // Update client_inbounds if new list provided
    if (inbound_ids && Array.isArray(inbound_ids) && inbound_ids.length > 0) {
      // Remove old links, add new ones
      await run(`DELETE FROM client_inbounds WHERE client_id = ?`, [req.params.id]);
      for (const ibId of inbound_ids) {
        await run(
          `INSERT OR IGNORE INTO client_inbounds (client_id, inbound_id) VALUES (?,?)`,
          [req.params.id, ibId]
        );
      }
      // Update primary inbound_id too
      await run(`UPDATE clients SET inbound_id = ? WHERE id = ?`, [inbound_ids[0], req.params.id]);
    }

    const updated   = await get(`SELECT * FROM clients WHERE id = ?`, [req.params.id]);
    const newInbounds = await getClientInbounds(req.params.id);

    // Live xray: remove old email, re-add with updated details
    try {
      const oldInbounds = await all(`SELECT i.* FROM inbounds i WHERE i.id = ?`, [existing.inbound_id]);
      for (const ib of newInbounds) {
        try { await xrayApi.removeUser(ib.tag, existing.email); } catch {}
        if (updated.enable) {
          try {
            await xrayApi.addUser(ib.tag, ib.protocol, {
              uuid: updated.uuid, email: updated.email, flow: updated.flow || '',
            });
          } catch {}
        }
      }
      res.json({ ...updated, inbound_ids: newInbounds.map(i => i.id), xray_live: true });
    } catch (xErr) {
      logger.warn(`[clients] xray update failed: ${xErr.message}`);
      res.json({ ...updated, inbound_ids: newInbounds.map(i => i.id), xray_live: false });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE /api/clients/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const existing  = await get(`SELECT * FROM clients WHERE id = ?`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const inbounds = await getClientInbounds(req.params.id);

    // Delete client (cascades to client_inbounds)
    await run(`DELETE FROM clients WHERE id = ?`, [req.params.id]);

    // Live remove from all xray inbounds
    let liveCount = await xraySyncClient(existing, inbounds, 'remove');

    res.json({
      message: 'Deleted',
      xray_live: liveCount > 0,
      xray_live_count: liveCount,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/clients/:id/reset ─────────────────────────────────────────────
router.post('/:id/reset', async (req, res) => {
  try {
    await run(`UPDATE clients SET up=0, down=0 WHERE id=?`, [req.params.id]);
    res.json({ message: 'Traffic reset' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/clients/:id/inbounds — list all inbounds for a client ───────────
router.get('/:id/inbounds', async (req, res) => {
  try {
    const inbounds = await getClientInbounds(req.params.id);
    res.json(inbounds);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/clients/:id/sub-link ───────────────────────────────────────────
router.get('/:id/sub-link', async (req, res) => {
  try {
    const client  = await get(`SELECT * FROM clients WHERE id = ?`, [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Not found' });

    const inbounds = await getClientInbounds(req.params.id);
    if (!inbounds.length) {
      // Fallback: use primary inbound
      const ib = await get(`SELECT * FROM inbounds WHERE id = ?`, [client.inbound_id]);
      if (!ib) return res.status(404).json({ error: 'No inbounds found' });
      inbounds.push(ib);
    }

    const host   = req.headers.host || req.hostname;
    const proto  = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const subUrl = client.sub_token ? `${proto}://${host}/sub/${client.sub_token}` : null;

    // Return first link for the "Config Link" tab
    const firstLink = buildSubLink(client, inbounds[0], host);

    // Return all links for multi-inbound preview
    const allLinks = inbounds.map(ib => ({
      inbound: ib.tag,
      protocol: ib.protocol,
      link: buildSubLink(client, ib, host),
    }));

    res.json({
      data:      firstLink,
      sub_url:   subUrl,
      sub_token: client.sub_token,
      sub_id:    client.sub_id,
      links:     allLinks,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/clients/:id/reset-token ───────────────────────────────────────
router.post('/:id/reset-token', async (req, res) => {
  try {
    const newToken = genToken();
    await run(`UPDATE clients SET sub_token = ? WHERE id = ?`, [newToken, req.params.id]);
    res.json({ sub_token: newToken });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
