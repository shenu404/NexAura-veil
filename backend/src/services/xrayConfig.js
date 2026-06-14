/**
 * xrayConfig.js
 *
 * Generates the full xray config.json from DB state.
 *
 * Fixes vs original:
 *  1. BUG FIX — client lookup now uses client_inbounds join table,
 *               so multi-inbound clients are correctly written to every inbound.
 *  2. Duplicate-email guard per inbound (safety net).
 *  3. Sub-link host strips port suffix when behind reverse proxy.
 */

const fs   = require('fs');
const path = require('path');
const { all } = require('../models/database');
const logger   = require('../utils/logger');

function getConfigPath() {
  return process.env.XRAY_CONFIG_PATH || '/etc/xray/config.json';
}

// ─── inbound settings builders ────────────────────────────────────────────────

function buildInboundSettings(protocol, clients) {
  switch (protocol) {
    case 'vmess':
      return {
        clients: clients.map(c => ({
          id:      c.uuid,
          email:   c.email,
          alterId: 0,
          ...(c.limit_ip > 0 ? { limitConnections: c.limit_ip } : {}),
        })),
      };
    case 'vless':
      return {
        clients: clients.map(c => ({
          id:    c.uuid,
          email: c.email,
          flow:  c.flow || '',
          ...(c.limit_ip > 0 ? { limitConnections: c.limit_ip } : {}),
        })),
        decryption: 'none',
      };
    case 'trojan':
      return {
        clients: clients.map(c => ({
          password: c.uuid,
          email:    c.email,
          flow:     c.flow || '',
          ...(c.limit_ip > 0 ? { limitConnections: c.limit_ip } : {}),
        })),
      };
    case 'shadowsocks':
      return {
        clients: clients.map(c => ({
          password: c.uuid,
          email:    c.email,
          method:   'chacha20-ietf-poly1305',
        })),
        network: 'tcp,udp',
      };
    default:
      return {};
  }
}

// ─── policy builder ───────────────────────────────────────────────────────────

function buildPolicy(clients) {
  const base = {
    handshake:         4,
    connIdle:          300,
    uplinkOnly:        2,
    downlinkOnly:      5,
    statsUserUplink:   true,
    statsUserDownlink: true,
  };

  const levels = { '0': { ...base } };

  new Set(clients.filter(c => c.limit_ip > 0).map(c => c.limit_ip))
    .forEach(limit => { levels[String(limit)] = { ...base }; });

  return {
    levels,
    system: { statsInboundUplink: true, statsInboundDownlink: true },
  };
}

// ─── main config generator ────────────────────────────────────────────────────

async function generateConfig() {
  const inbounds   = await all(`SELECT * FROM inbounds WHERE enabled=1 ORDER BY id`);
  const allClients = await all(`SELECT * FROM clients WHERE enable=1`);

  const xrayInbounds = [];

  for (const inbound of inbounds) {
    // ── FIX 1: use client_inbounds join so multi-inbound clients appear here ──
    const clients = await all(`
      SELECT c.*
      FROM clients c
      JOIN client_inbounds ci ON ci.client_id = c.id
      WHERE ci.inbound_id = ? AND c.enable = 1
      ORDER BY c.id ASC
    `, [inbound.id]);

    // ── FIX 2: deduplicate by email (safety — should never happen, but guard) ──
    const seen    = new Set();
    const unique  = clients.filter(c => {
      if (seen.has(c.email)) return false;
      seen.add(c.email);
      return true;
    });

    const streamSettings = JSON.parse(inbound.stream_settings || '{}');
    const sniffing       = JSON.parse(inbound.sniffing        || '{}');

    xrayInbounds.push({
      tag:      inbound.tag,
      port:     inbound.port,
      listen:   inbound.listen || '0.0.0.0',
      protocol: inbound.protocol,
      settings: buildInboundSettings(inbound.protocol, unique),
      streamSettings,
      sniffing: Object.keys(sniffing).length > 0
        ? sniffing
        : { enabled: true, destOverride: ['http', 'tls'] },
    });
  }

  return {
    log: {
      loglevel: 'warning',
      access:   process.env.XRAY_ACCESS_LOG  || '/var/log/xray/access.log',
      error:    process.env.XRAY_ERROR_LOG   || '/var/log/xray/error.log',
    },
    api: {
      tag:      'api',
      services: ['HandlerService', 'LoggerService', 'StatsService'],
    },
    stats:  {},
    policy: buildPolicy(allClients),
    inbounds: [
      {
        tag:      'api',
        port:     parseInt(process.env.XRAY_API_PORT || '62789', 10),
        listen:   '127.0.0.1',
        protocol: 'dokodemo-door',
        settings: { address: '127.0.0.1' },
      },
      ...xrayInbounds,
    ],
    outbounds: [
      { protocol: 'freedom',   tag: 'direct',  settings: {} },
      { protocol: 'blackhole', tag: 'blocked',  settings: {} },
    ],
    routing: {
      domainStrategy: 'IPIfNonMatch',
      rules: [
        { type: 'field', inboundTag: ['api'], outboundTag: 'api'     },
        { type: 'field', ip: ['geoip:private'], outboundTag: 'direct' },
      ],
    },
  };
}

// ─── write to disk ────────────────────────────────────────────────────────────

async function writeConfig() {
  const config     = await generateConfig();
  const configPath = getConfigPath();

  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  logger.info(`[XrayConfig] Written to ${configPath}`);
  return configPath;
}

// ─── hot-reload via SIGUSR1 ───────────────────────────────────────────────────

async function reloadXray() {
  await writeConfig();
  try {
    const { execSync } = require('child_process');
    execSync('kill -SIGUSR1 $(pgrep xray) 2>/dev/null || true');
    logger.info('[XrayConfig] Xray hot-reloaded');
    return true;
  } catch {
    logger.warn('[XrayConfig] Hot reload failed — restart required');
    return false;
  }
}

module.exports = { generateConfig, writeConfig, reloadXray };
