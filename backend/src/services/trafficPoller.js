/**
 * trafficPoller.js
 * 
 * Polls xray stats API every 30 seconds.
 * Stores delta (difference since last poll) per user into:
 *   - clients table (up/down columns — cumulative totals)
 *   - traffic_logs table (per-poll snapshots for charting)
 *   - client_traffic table (per-user detailed history)
 * 
 * This mirrors exactly how 3x-ui does it:
 *   value - lastValue = bytes used this interval
 */

const { run, get, all } = require('../models/database');
const xrayApi = require('./xrayApiService');
const logger = require('../utils/logger');

const POLL_INTERVAL_MS = 30 * 1000; // 30 seconds

let pollTimer = null;
let lastStats  = {};   // { email: { up, down } } — raw cumulative from xray
let isPolling  = false;

// ─── ensure client_traffic table exists ──────────────────────────────────────
async function ensureSchema() {
  await run(`CREATE TABLE IF NOT EXISTS client_traffic (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id   INTEGER NOT NULL,
    email       TEXT NOT NULL,
    up_delta    INTEGER DEFAULT 0,
    down_delta  INTEGER DEFAULT 0,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add index for fast per-client queries
  await run(`CREATE INDEX IF NOT EXISTS idx_ct_email ON client_traffic(email)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_ct_time  ON client_traffic(recorded_at)`);
}

// ─── single poll cycle ────────────────────────────────────────────────────────
async function poll() {
  if (isPolling) return;
  isPolling = true;

  try {
    // Pull current cumulative stats from xray (do NOT reset — we track deltas ourselves)
    const current = await xrayApi.queryStats(false);
    if (!current || Object.keys(current).length === 0) {
      isPolling = false;
      return;
    }

    const now = new Date().toISOString();
    const clients = await all(`SELECT id, email FROM clients WHERE enable = 1`);
    const clientMap = {};
    clients.forEach(c => { clientMap[c.email] = c.id; });

    let totalUpDelta   = 0;
    let totalDownDelta = 0;

    for (const [email, stats] of Object.entries(current)) {
      const prev    = lastStats[email] || { up: 0, down: 0 };
      const upDelta   = Math.max(0, (stats.up   || 0) - prev.up);
      const downDelta = Math.max(0, (stats.down || 0) - prev.down);

      // Skip if no new traffic
      if (upDelta === 0 && downDelta === 0) continue;

      totalUpDelta   += upDelta;
      totalDownDelta += downDelta;

      const clientId = clientMap[email];

      if (clientId) {
        // Update cumulative totals on client row
        await run(
          `UPDATE clients SET up = up + ?, down = down + ? WHERE id = ?`,
          [upDelta, downDelta, clientId]
        );

        // Insert per-poll record into client_traffic for history
        await run(
          `INSERT INTO client_traffic (client_id, email, up_delta, down_delta, recorded_at)
           VALUES (?, ?, ?, ?, ?)`,
          [clientId, email, upDelta, downDelta, now]
        );
      }

      // Update last known values
      lastStats[email] = { up: stats.up || 0, down: stats.down || 0 };
    }

    // Write aggregate snapshot to traffic_logs (for hourly chart)
    if (totalUpDelta > 0 || totalDownDelta > 0) {
      await run(
        `INSERT INTO traffic_logs (tag, up, down, recorded_at) VALUES (?, ?, ?, ?)`,
        ['__aggregate__', totalUpDelta, totalDownDelta, now]
      );

      // Also update inbounds table aggregate (for dashboard totals)
      // Get all inbound tags from xray stats and update per-inbound
      const inbounds = await all(`SELECT id, tag FROM inbounds`);
      for (const inbound of inbounds) {
        // Sum all client traffic for this inbound
        const inboundClients = await all(
          `SELECT email FROM clients WHERE inbound_id = ? AND enable = 1`,
          [inbound.id]
        );
        let ibUp = 0, ibDown = 0;
        for (const c of inboundClients) {
          const s = current[c.email];
          const prev = lastStats[c.email] || { up: 0, down: 0 };
          if (s) {
            ibUp   += Math.max(0, (s.up   || 0) - prev.up);
            ibDown += Math.max(0, (s.down || 0) - prev.down);
          }
        }
        if (ibUp > 0 || ibDown > 0) {
          await run(
            `UPDATE inbounds SET up = up + ?, down = down + ? WHERE id = ?`,
            [ibUp, ibDown, inbound.id]
          );
        }
      }

      logger.info(`[trafficPoller] ↑${fmtBytes(totalUpDelta)} ↓${fmtBytes(totalDownDelta)} (${Object.keys(current).length} users)`);
    }

  } catch (err) {
    // xray API offline — silent, will retry next interval
    if (!err.message.includes('failed')) {
      logger.warn(`[trafficPoller] poll error: ${err.message}`);
    }
  }

  isPolling = false;
}

function fmtBytes(b) {
  if (b < 1024) return `${b}B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)}KB`;
  return `${(b/1048576).toFixed(1)}MB`;
}

// ─── public API ───────────────────────────────────────────────────────────────

async function start() {
  await ensureSchema();
  if (pollTimer) return;

  // Initial poll immediately
  await poll();

  pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  logger.info(`[trafficPoller] Started — polling every ${POLL_INTERVAL_MS / 1000}s`);
}

function stop() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    logger.info('[trafficPoller] Stopped');
  }
}

function getLastStats() {
  return lastStats;
}

module.exports = { start, stop, getLastStats, poll };
