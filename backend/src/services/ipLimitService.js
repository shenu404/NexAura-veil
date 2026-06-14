/**
 * ipLimitService.js  — v2
 *
 * Strict single-IP enforcement per client config:
 *
 *  • Each client is allowed exactly 1 unique IP at a time
 *    (same device reconnecting = same IP = fine)
 *  • A 2nd *different* IP connects → client is BANNED for 1 hour
 *    (removeUser from all inbounds via xray API)
 *  • After 1 hour → auto unban (re-add to xray live)
 *  • Manual unban available via unbanClient()
 *  • IP stale window = 30 minutes (Veil IP enforcement standard)
 *
 * Xray access log line formats supported:
 *   2024/01/01 12:00:00 accepted tcp:1.2.3.4:56789 [tag] user@email.com
 *   2024/01/01 12:00:00 [Info] ... email: user@email.com from 1.2.3.4:56789
 */

const fs     = require('fs');
const { all, run, get } = require('../models/database')
const telegram = require('./telegramBot');
const xrayApi = require('./xrayApiService');
const logger  = require('../utils/logger');

// ─── tunables ─────────────────────────────────────────────────────────────────
const STALE_WINDOW_MS = 30 * 60 * 1000;   // 30 min — IP considered "gone"
const BAN_DURATION_MS = 60 * 60 * 1000;   // 1 hour ban
const LOG_POLL_MS     = 1_000;             // read log every 1s
const ENFORCE_TICK_MS = 5_000;             // enforce check every 5s

// ─── in-memory state ──────────────────────────────────────────────────────────
// { email → { ip: string, lastSeen: number } }   — the ONE allowed IP
const allowedIP = new Map();

// { email → { bannedAt: number, timer: Timeout } }
const banList   = new Map();

let logWatcher    = null;
let enforceTimer  = null;
let logBuffer     = '';

// ─── xray API helpers ─────────────────────────────────────────────────────────

async function removeFromAllInbounds(email) {
  try {
    const inbounds = await all(`
      SELECT i.tag FROM inbounds i
      JOIN client_inbounds ci ON ci.inbound_id = i.id
      JOIN clients c ON c.id = ci.client_id
      WHERE c.email = ? AND i.enabled = 1
    `, [email]);

    // Also check primary inbound_id
    const client = await get(`SELECT inbound_id FROM clients WHERE email = ?`, [email]);
    if (client) {
      const primary = await get(`SELECT tag FROM inbounds WHERE id = ?`, [client.inbound_id]);
      if (primary && !inbounds.find(i => i.tag === primary.tag)) inbounds.push(primary);
    }

    for (const ib of inbounds) {
      try { await xrayApi.removeUser(ib.tag, email); } catch {}
    }
  } catch (err) {
    logger.warn(`[IPLimit] removeFromAllInbounds(${email}): ${err.message}`);
  }
}

async function addToAllInbounds(email) {
  try {
    const client = await get(
      `SELECT * FROM clients WHERE email = ? AND enable = 1`, [email]
    );
    if (!client) return;

    const inbounds = await all(`
      SELECT i.* FROM inbounds i
      JOIN client_inbounds ci ON ci.inbound_id = i.id
      WHERE ci.client_id = ? AND i.enabled = 1
    `, [client.id]);

    if (!inbounds.find(i => i.id === client.inbound_id)) {
      const primary = await get(
        `SELECT * FROM inbounds WHERE id = ? AND enabled = 1`, [client.inbound_id]
      );
      if (primary) inbounds.push(primary);
    }

    for (const ib of inbounds) {
      try { await xrayApi.addUser(ib.tag, client); } catch {}
    }
  } catch (err) {
    logger.warn(`[IPLimit] addToAllInbounds(${email}): ${err.message}`);
  }
}

// ─── ban / unban ──────────────────────────────────────────────────────────────

async function banClient(email, reason) {
  if (banList.has(email)) return; // already banned

  logger.warn(`[IPLimit] BANNING ${email} — ${reason}`);
  addLog('ban', email, reason);
  telegram.notifyBan(email, reason);

  // Remove from xray live (disconnect immediately)
  await removeFromAllInbounds(email);

  // Mark banned in DB (enable=0 + ban metadata in settings-style)
  await run(`UPDATE clients SET enable = 0 WHERE email = ?`, [email]);
  await run(`
    INSERT INTO ip_bans (email, reason, banned_at, unban_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET
      reason   = excluded.reason,
      banned_at = excluded.banned_at,
      unban_at  = excluded.unban_at,
      active   = 1
  `, [email, reason, Date.now(), Date.now() + BAN_DURATION_MS]);

  // Clear tracked IP so fresh state after unban
  allowedIP.delete(email);

  // Auto-unban timer
  const timer = setTimeout(() => unbanClient(email, true), BAN_DURATION_MS);
  banList.set(email, { bannedAt: Date.now(), timer });
}

async function unbanClient(email, auto = false) {
  const entry = banList.get(email);
  if (entry?.timer) clearTimeout(entry.timer);
  banList.delete(email);
  allowedIP.delete(email); // start fresh

  // Re-enable in DB
  await run(`UPDATE clients SET enable = 1 WHERE email = ?`, [email]);
  await run(`UPDATE ip_bans SET active = 0 WHERE email = ?`, [email]);

  // Re-add to xray live
  await addToAllInbounds(email);

  logger.info(`[IPLimit] UNBANNED ${email} (${auto ? 'auto' : 'manual'})`);
  addLog('unban', email, auto ? 'Auto unban after 1 hour' : 'Manual unban by admin');
  telegram.notifyUnban(email, auto);
}

function isClientBanned(email) {
  return banList.has(email);
}

// ─── IP tracking ──────────────────────────────────────────────────────────────

async function handleNewConnection(email, ip) {
  if (!email || !ip) return;
  if (isClientBanned(email)) return;

  const now     = Date.now();
  const current = allowedIP.get(email);

  if (!current) {
    // First time we see this client — allow this IP
    allowedIP.set(email, { ip, lastSeen: now });
    logger.debug(`[IPLimit] ${email} → first IP: ${ip}`);
    addLog('connect', email, ip);
    return;
  }

  if (current.ip === ip) {
    // Same IP reconnecting — refresh lastSeen
    current.lastSeen = now;
    return;
  }

  // Different IP!
  const stale = (now - current.lastSeen) > STALE_WINDOW_MS;
  if (stale) {
    // Old IP hasn't been seen for 30min → allow new IP (device changed network)
    logger.info(`[IPLimit] ${email} — old IP ${current.ip} stale, switching to ${ip}`);
    allowedIP.set(email, { ip, lastSeen: now });
    addLog('ip_switch', email, `${current.ip} → ${ip} (stale switch)`);
    return;
  }

  // Active different IP → BAN
  await banClient(email,
    `Multiple IPs: had ${current.ip} (${Math.round((now - current.lastSeen)/1000)}s ago), new ${ip}`
  );
}

// ─── log parsing ─────────────────────────────────────────────────────────────

function parseLogLine(line) {
  // Format 1: accepted tcp:1.2.3.4:56789 [tag] email@domain
  const m1 = line.match(/accepted\s+\w+:([\d.]+):\d+\s+\[([^\]]+)\]\s+(\S+@\S+)/);
  if (m1) return { ip: m1[1], tag: m1[2], email: m1[3] };

  // Format 2: ... from 1.2.3.4:56789 ... email: user@domain
  const ip2    = line.match(/from\s+([\d.]+):\d+/);
  const email2 = line.match(/email:\s*(\S+)/);
  if (ip2 && email2) return { ip: ip2[1], email: email2[1], tag: null };

  // Format 3: [email] tunneling ... from 1.2.3.4
  const ip3    = line.match(/from\s+([\d.a-f:]+):\d+/);
  const email3 = line.match(/\[(\S+@\S+)\]/);
  if (ip3 && email3) return { ip: ip3[1], email: email3[1], tag: null };

  return null;
}

// ─── log file watcher ────────────────────────────────────────────────────────

function startLogWatcher(logPath) {
  if (!logPath || !fs.existsSync(logPath)) {
    logger.warn(`[IPLimit] Log file not found: ${logPath}`);
    return;
  }

  logger.info(`[IPLimit] Watching: ${logPath}`);
  let position = fs.statSync(logPath).size;

  logWatcher = setInterval(() => {
    try {
      const stat = fs.statSync(logPath);
      if (stat.size < position) position = 0; // rotated

      if (stat.size === position) return;

      const fd     = fs.openSync(logPath, 'r');
      const toRead = stat.size - position;
      const buf    = Buffer.alloc(toRead);
      fs.readSync(fd, buf, 0, toRead, position);
      fs.closeSync(fd);
      position = stat.size;

      const text  = logBuffer + buf.toString('utf8');
      const lines = text.split('\n');
      logBuffer   = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        const parsed = parseLogLine(line);
        if (parsed?.email && parsed?.ip) {
          handleNewConnection(parsed.email, parsed.ip);
        }
      }
    } catch {}
  }, LOG_POLL_MS);
}

// ─── enforce tick: load bans from DB on startup, stale prune ─────────────────

async function loadBansFromDB() {
  try {
    const rows = await all(
      `SELECT email, banned_at, unban_at FROM ip_bans WHERE active = 1`
    );
    const now = Date.now();
    for (const row of rows) {
      if (now >= row.unban_at) {
        // Already expired — unban immediately
        await unbanClient(row.email, true);
      } else {
        // Restore ban state in memory
        const remaining = row.unban_at - now;
        const timer     = setTimeout(() => unbanClient(row.email, true), remaining);
        banList.set(row.email, { bannedAt: row.banned_at, timer });
        logger.info(`[IPLimit] Restored ban: ${row.email} (${Math.round(remaining/60000)}min left)`);
      }
    }
  } catch {}
}

function startEnforcer() {
  enforceTimer = setInterval(() => {
    // Prune stale IPs from allowedIP map
    const now = Date.now();
    for (const [email, entry] of allowedIP.entries()) {
      if (now - entry.lastSeen > STALE_WINDOW_MS) {
        addLog('disconnect', email, `IP ${entry.ip} went stale (30min idle)`);
        allowedIP.delete(email);
        logger.debug(`[IPLimit] Pruned stale IP for ${email}`);
      }
    }
  }, ENFORCE_TICK_MS);
}

function stop() {
  if (logWatcher)   { clearInterval(logWatcher);   logWatcher   = null; }
  if (enforceTimer) { clearInterval(enforceTimer); enforceTimer = null; }
  for (const { timer } of banList.values()) clearTimeout(timer);
}

// ─── dashboard helpers ────────────────────────────────────────────────────────

async function getIPStats() {
  const stats = {};
  try {
    const clients = await all(`SELECT email, limit_ip FROM clients`);
    for (const c of clients) {
      const entry = allowedIP.get(c.email);
      stats[c.email] = {
        currentIP: entry?.ip   || null,
        lastSeen:  entry?.lastSeen || null,
        banned:    isClientBanned(c.email),
        banInfo:   banList.has(c.email)
          ? { bannedAt: banList.get(c.email).bannedAt }
          : null,
      };
    }
  } catch {}
  return stats;
}

async function getBanList() {
  try {
    return await all(
      `SELECT email, reason, banned_at, unban_at FROM ip_bans WHERE active = 1 ORDER BY banned_at DESC`
    );
  } catch { return []; }
}

module.exports = {
  startLogWatcher,
  startEnforcer,
  loadBansFromDB,
  stop,
  handleNewConnection,
  banClient,
  unbanClient,
  isClientBanned,
  getIPStats,
  getBanList,
  // legacy compat
  checkIPLimits: async () => [],
  getActiveIPCount: (email) => allowedIP.has(email) ? 1 : 0,
  getActiveIPs: (email) => allowedIP.has(email) ? [allowedIP.get(email).ip] : [],
  clearClientIPs: (email) => allowedIP.delete(email),
};

// ─── Event Log (in-memory ring buffer, max 500 entries) ───────────────────────
// Exported so routes can read it

const MAX_LOG = 500
const eventLog = []

function addLog(type, email, detail = '') {
  const entry = {
    id:        Date.now() + Math.random(),
    type,      // 'connect' | 'disconnect' | 'ban' | 'unban' | 'ip_switch'
    email,
    detail,
    ts: Date.now(),
  }
  eventLog.unshift(entry)
  if (eventLog.length > MAX_LOG) eventLog.pop()
}

function getLogs(limit = 100) {
  return eventLog.slice(0, limit)
}

module.exports.addLog  = addLog
module.exports.getLogs = getLogs
