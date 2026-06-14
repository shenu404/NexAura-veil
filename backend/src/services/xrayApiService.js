/**
 * xrayApiService.js
 * 
 * Communicates with xray-core's built-in API (port 62789, localhost only).
 * Requires xray config to have:
 *   "api": { "tag": "api", "services": ["HandlerService","StatsService","LoggerService"] }
 *   and an inbound: { "tag":"api","port":62789,"listen":"127.0.0.1","protocol":"dokodemo-door" }
 * 
 * xray 1.8.x+ exposes these via gRPC — but we call via the REST-like wrapper
 * using the xray CLI sub-commands (api addUser, api removeUser, api statsQuery).
 * This avoids a gRPC library dependency and works on all xray 1.8+ installs.
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('../utils/logger');

const execFileAsync = promisify(execFile);

const XRAY_BIN  = process.env.XRAY_PATH        || '/usr/local/bin/xray';
const API_ADDR  = process.env.XRAY_API_ADDR    || '127.0.0.1:62789';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Run an xray api sub-command.
 * xray api <cmd> --server=ADDR [args...]
 * Returns parsed JSON output or throws.
 */
async function xrayApi(cmd, args = []) {
  const fullArgs = ['api', cmd, `--server=${API_ADDR}`, ...args];
  try {
    const { stdout, stderr } = await execFileAsync(XRAY_BIN, fullArgs, { timeout: 8000 });
    if (stderr && stderr.trim()) logger.warn(`[xrayApi] ${cmd} stderr: ${stderr.trim()}`);
    try { return JSON.parse(stdout); } catch { return { raw: stdout }; }
  } catch (err) {
    const msg = err.stderr || err.message || String(err);
    throw new Error(`xray api ${cmd} failed: ${msg.trim()}`);
  }
}

// ─── user management ──────────────────────────────────────────────────────────

/**
 * Build the user object that xray api addUser expects.
 * Different for each protocol.
 */
function buildUserJson(protocol, client) {
  const base = { email: client.email };

  switch (protocol) {
    case 'vless':
      return JSON.stringify({
        ...base,
        id:   client.uuid,
        flow: client.flow || '',
        encryptionType: 'none',  // required field in VLESS
      });

    case 'vmess':
      return JSON.stringify({
        ...base,
        id:      client.uuid,
        alterId: 0,
        security:'auto',
      });

    case 'trojan':
      return JSON.stringify({
        ...base,
        password: client.uuid,
        flow:     client.flow || '',
      });

    case 'shadowsocks':
      return JSON.stringify({
        ...base,
        password: client.uuid,
        method:   'chacha20-ietf-poly1305',
      });

    default:
      throw new Error(`Unsupported protocol for live add: ${protocol}`);
  }
}

/**
 * Add a user to a running xray inbound without restart.
 * @param {string} inboundTag  — xray inbound tag (e.g. "vless-443")
 * @param {string} protocol    — vless | vmess | trojan | shadowsocks
 * @param {object} client      — { uuid, email, flow }
 */
async function addUser(inboundTag, protocol, client) {
  const userJson = buildUserJson(protocol, client);
  // xray api addUser --server=ADDR -inbound=TAG -user=JSON
  const result = await xrayApi('addUser', [
    `-inbound=${inboundTag}`,
    `-user=${userJson}`,
  ]);
  logger.info(`[xrayApi] addUser ${client.email} → ${inboundTag}`);
  return result;
}

/**
 * Remove a user from a running xray inbound without restart.
 * @param {string} inboundTag
 * @param {string} email  — must match exactly what was used when adding
 */
async function removeUser(inboundTag, email) {
  const result = await xrayApi('removeUser', [
    `-inbound=${inboundTag}`,
    `-email=${email}`,
  ]);
  logger.info(`[xrayApi] removeUser ${email} ← ${inboundTag}`);
  return result;
}

// ─── traffic stats ─────────────────────────────────────────────────────────────

/**
 * Query per-user traffic stats from xray.
 * Returns { email: { up, down } } map.
 * @param {boolean} reset  — reset counters after reading (delta mode — resets counters after each read)
 */
async function queryStats(reset = false) {
  try {
    const result = await xrayApi('statsQuery', [
      ...(reset ? ['-reset'] : []),
    ]);

    // xray returns: { stat: [ { name:"user>>>email>>>traffic>>>uplink", value:"12345" }, ... ] }
    const stats = {};
    const items = result?.stat || result?.Stat || [];

    for (const item of items) {
      const name  = item.name  || '';
      const value = parseInt(item.value || item.Value || 0, 10);

      // name format: "user>>>email@inbound>>>traffic>>>uplink"
      const parts = name.split('>>>');
      if (parts.length < 4) continue;

      const email     = parts[1];
      const direction = parts[3]; // uplink | downlink

      if (!stats[email]) stats[email] = { up: 0, down: 0 };
      if (direction === 'uplink')   stats[email].up   += value;
      if (direction === 'downlink') stats[email].down += value;
    }

    return stats;
  } catch (err) {
    logger.warn(`[xrayApi] queryStats failed: ${err.message}`);
    return {};
  }
}

/**
 * Check if xray API is reachable.
 */
async function isApiReachable() {
  try {
    await xrayApi('statsQuery', []);
    return true;
  } catch {
    return false;
  }
}


// ── Online client count from access log ──────────────────────────────────────
// Reads last N lines of access log, returns emails active in last 2 minutes

const fs   = require('fs')
const ONLINE_WINDOW_MS = 2 * 60 * 1000 // 2 minutes

function getOnlineClients() {
  const logPath = process.env.XRAY_ACCESS_LOG || '/var/log/xray/access.log'
  if (!fs.existsSync(logPath)) return {}

  const online = {}
  try {
    const content = fs.readFileSync(logPath, 'utf8')
    const lines   = content.split('\n').slice(-2000) // last 2000 lines
    const now     = Date.now()

    for (const line of lines) {
      // Parse timestamp: "2024/01/01 12:00:00 accepted ..."
      const tsMatch    = line.match(/^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2})/)
      const emailMatch = line.match(/email[:\s]+([\w.@+-]+)/i) ||
                         line.match(/accepted[^@]+([\w.+-]+@[\w.-]+)/)
      if (!tsMatch || !emailMatch) continue

      const ts    = new Date(tsMatch[1].replace(/\//g, '-').replace(' ', 'T') + 'Z').getTime()
      const email = emailMatch[1]
      if (now - ts <= ONLINE_WINDOW_MS) {
        online[email] = (online[email] || 0) + 1
      }
    }
  } catch {}
  return online
}

module.exports = {
  getOnlineClients, addUser, removeUser, queryStats, isApiReachable };
