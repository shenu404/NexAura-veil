/**
 * statsPoller.js
 *
 * Polls xray stats API every 30s → writes delta per user → DB.
 *
 * Fixes vs original:
 *  1. BUG FIX — inbound totals now use client_inbounds join,
 *               so multi-inbound clients count toward correct inbounds.
 *  2. trafficPoller.js is superseded by this file — removed duplicate.
 *  3. Expiry enforcement: auto-disable clients past expiry_time.
 */

const { run, get, all } = require('../models/database')
const telegram = require('./telegramBot');
const xrayApi  = require('./xrayApiService');
const logger   = require('../utils/logger');

const POLL_INTERVAL_MS = 30 * 1000;

let _timer   = null;
let _running = false;

// ─── expiry check (runs each poll cycle) ─────────────────────────────────────

async function enforceExpiry() {
  try {
    const now     = Date.now();
    const expired = await all(`
      SELECT id, email FROM clients
      WHERE enable = 1 AND expiry_time > 0 AND expiry_time < ?
    `, [now]);

    for (const c of expired) {
      await run(`UPDATE clients SET enable = 0 WHERE id = ?`, [c.id]);
      // Live-remove from all inbounds
      const inbounds = await all(`
        SELECT i.tag FROM inbounds i
        JOIN client_inbounds ci ON ci.inbound_id = i.id
        WHERE ci.client_id = ?
      `, [c.id]);
      for (const ib of inbounds) {
        try { await xrayApi.removeUser(ib.tag, c.email); } catch {}
      }
      logger.info(`[statsPoller] Expired + disabled: ${c.email}`);
      telegram.notifyExpired(c.email);
    }
  } catch (err) {
    logger.warn(`[statsPoller] Expiry check failed: ${err.message}`);
  }
}

// ─── traffic limit check ──────────────────────────────────────────────────────

async function enforceTrafficLimits() {
  try {
    // total_gb is stored as bytes (0 = unlimited)
    const overLimit = await all(`
      SELECT id, email FROM clients
      WHERE enable = 1 AND total_gb > 0 AND (up + down) >= total_gb
    `);

    for (const c of overLimit) {
      await run(`UPDATE clients SET enable = 0 WHERE id = ?`, [c.id]);
      const inbounds = await all(`
        SELECT i.tag FROM inbounds i
        JOIN client_inbounds ci ON ci.inbound_id = i.id
        WHERE ci.client_id = ?
      `, [c.id]);
      for (const ib of inbounds) {
        try { await xrayApi.removeUser(ib.tag, c.email); } catch {}
      }
      logger.info(`[statsPoller] Traffic limit hit + disabled: ${c.email}`);
      telegram.notifyTrafficLimit(c.email, c.up + c.down, c.total_gb);
    }
  } catch (err) {
    logger.warn(`[statsPoller] Traffic limit check failed: ${err.message}`);
  }
}

// ─── main poll ────────────────────────────────────────────────────────────────

async function poll() {
  if (_running) return;
  _running = true;

  try {
    // reset=true → xray returns bytes since last query then resets counters
    const stats  = await xrayApi.queryStats(true);
    const emails = Object.keys(stats);

    if (emails.length > 0) {
      for (const email of emails) {
        const { up, down } = stats[email];
        if (up === 0 && down === 0) continue;

        // Update client cumulative totals
        await run(
          `UPDATE clients SET up = up + ?, down = down + ? WHERE email = ? AND enable = 1`,
          [up, down, email]
        );

        // Hourly traffic_logs upsert
        const hourLabel = new Date().toISOString().slice(0, 13) + ':00:00.000Z';
        const existing  = await get(
          `SELECT id FROM traffic_logs WHERE tag = ? AND recorded_at = ?`,
          [email, hourLabel]
        );
        if (existing) {
          await run(
            `UPDATE traffic_logs SET up = up + ?, down = down + ? WHERE id = ?`,
            [up, down, existing.id]
          );
        } else {
          await run(
            `INSERT INTO traffic_logs (tag, up, down, recorded_at) VALUES (?,?,?,?)`,
            [email, up, down, hourLabel]
          );
        }
      }

      // ── FIX 1: update inbound totals via client_inbounds join ──────────────
      // Sum traffic from ALL clients linked to each inbound (multi-inbound aware)
      await run(`
        UPDATE inbounds SET
          up   = (
            SELECT COALESCE(SUM(c.up), 0)
            FROM clients c
            JOIN client_inbounds ci ON ci.client_id = c.id
            WHERE ci.inbound_id = inbounds.id
          ),
          down = (
            SELECT COALESCE(SUM(c.down), 0)
            FROM clients c
            JOIN client_inbounds ci ON ci.client_id = c.id
            WHERE ci.inbound_id = inbounds.id
          )
      `);

      logger.debug(`[statsPoller] Updated stats for ${emails.length} user(s)`);
    }

    // Run expiry + traffic limit checks every cycle
    await enforceExpiry();
    await enforceTrafficLimits();

  } catch (err) {
    if (err.message?.includes('failed') || err.message?.includes('ENOENT')) {
      logger.warn(`[statsPoller] xray API unreachable — retrying in ${POLL_INTERVAL_MS / 1000}s`);
    } else {
      logger.error(`[statsPoller] Error: ${err.message}`);
    }
  }

  _running = false;
}

function start() {
  if (_timer) return;
  logger.info(`[statsPoller] Starting — polling every ${POLL_INTERVAL_MS / 1000}s`);
  _timer = setInterval(poll, POLL_INTERVAL_MS);
  poll(); // immediate first run
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  logger.info('[statsPoller] Stopped');
}

function isRunning() { return _timer !== null; }

module.exports = { start, stop, poll, isRunning };
