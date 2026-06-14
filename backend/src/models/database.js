const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/nexaura.db');

let db;

function getDB() {
  if (!db) {
    // Ensure the data directory exists (it's gitignored, so it won't exist
    // right after a fresh `git clone` on a new server)
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) console.error('DB open error:', err);
    });
    db.run('PRAGMA journal_mode=WAL');
    db.run('PRAGMA foreign_keys=ON');
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDB().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDB() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS inbounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT UNIQUE NOT NULL,
    protocol TEXT NOT NULL,
    port INTEGER NOT NULL,
    listen TEXT DEFAULT '0.0.0.0',
    settings TEXT DEFAULT '{}',
    stream_settings TEXT DEFAULT '{}',
    sniffing TEXT DEFAULT '{}',
    enabled INTEGER DEFAULT 1,
    up INTEGER DEFAULT 0,
    down INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inbound_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    uuid TEXT,
    password TEXT,
    flow TEXT DEFAULT '',
    limit_ip INTEGER DEFAULT 0,
    total_gb INTEGER DEFAULT 0,
    expiry_time INTEGER DEFAULT 0,
    enable INTEGER DEFAULT 1,
    up INTEGER DEFAULT 0,
    down INTEGER DEFAULT 0,
    sub_token TEXT UNIQUE,
    sub_id TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(inbound_id) REFERENCES inbounds(id) ON DELETE CASCADE
  )`);

  // client_inbounds: many-to-many — one client on multiple inbounds
  await run(`CREATE TABLE IF NOT EXISTS client_inbounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    inbound_id INTEGER NOT NULL,
    FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY(inbound_id) REFERENCES inbounds(id) ON DELETE CASCADE,
    UNIQUE(client_id, inbound_id)
  )`);

  // Migration: add sub_token column to existing installs
  // NOTE: SQLite does NOT support UNIQUE in ALTER TABLE ADD COLUMN.
  //       We add the column first, then create the index separately.
  try {
    await run(`ALTER TABLE clients ADD COLUMN sub_token TEXT`);
    console.log('Migration: added sub_token column to clients');
  } catch (e) {
    if (!e.message.includes('duplicate column name')) {
      console.warn('Migration sub_token warning:', e.message);
    }
  }

  // Migration: add sub_id column
  try {
    await run(`ALTER TABLE clients ADD COLUMN sub_id TEXT`);
    console.log('Migration: added sub_id column to clients');
  } catch (e) {
    if (!e.message.includes('duplicate column name')) {
      console.warn('Migration sub_id warning:', e.message);
    }
  }

  // Ensure unique indexes exist (safe to run on every startup)
  try {
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_sub_token ON clients (sub_token) WHERE sub_token IS NOT NULL`);
  } catch (e) { /* ignore */ }
  try {
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_sub_id ON clients (sub_id) WHERE sub_id IS NOT NULL`);
  } catch (e) { /* ignore */ }

  // Migration: backfill sub_token + sub_id for existing clients
  const cryptoModule = require('crypto');
  const clientsWithoutToken = await all(`SELECT id FROM clients WHERE sub_token IS NULL OR sub_id IS NULL`);
  for (const c of clientsWithoutToken) {
    const token  = cryptoModule.randomBytes(16).toString('hex');
    const sub_id = cryptoModule.randomUUID ? cryptoModule.randomUUID() : cryptoModule.randomBytes(16).toString('hex');
    await run(
      `UPDATE clients SET
        sub_token = COALESCE(sub_token, ?),
        sub_id    = COALESCE(sub_id, ?)
       WHERE id = ?`,
      [token, sub_id, c.id]
    );
  }
  if (clientsWithoutToken.length > 0) {
    console.log(`Migration: backfilled tokens for ${clientsWithoutToken.length} client(s)`);
  }

  // Migration: backfill client_inbounds from existing clients.inbound_id
  const existingLinks = await get(`SELECT COUNT(*) as cnt FROM client_inbounds`);
  if (existingLinks.cnt === 0) {
    const allClients = await all(`SELECT id, inbound_id FROM clients WHERE inbound_id IS NOT NULL`);
    for (const c of allClients) {
      await run(
        `INSERT OR IGNORE INTO client_inbounds (client_id, inbound_id) VALUES (?,?)`,
        [c.id, c.inbound_id]
      );
    }
    if (allClients.length > 0) {
      console.log(`Migration: backfilled client_inbounds for ${allClients.length} client(s)`);
    }
  }

  await run(`CREATE TABLE IF NOT EXISTS traffic_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT NOT NULL,
    up INTEGER DEFAULT 0,
    down INTEGER DEFAULT 0,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);


  // ip_bans: tracks banned clients (IP limit violations)
  await run(`CREATE TABLE IF NOT EXISTS ip_bans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    reason TEXT,
    banned_at INTEGER NOT NULL,
    unban_at INTEGER NOT NULL,
    active INTEGER DEFAULT 1,
    UNIQUE(email)
  )`);

  // Index for fast active ban lookups
  try {
    await run(`CREATE INDEX IF NOT EXISTS idx_ip_bans_active ON ip_bans (active, email)`);
  } catch {}

  // Default settings
  const defaults = [
    ['xray_path', '/usr/local/bin/xray'],
    ['xray_config_path', '/etc/xray/config.json'],
    ['sub_path', '/sub'],
    ['tls_cert', ''],
    ['tls_key', ''],
  ];
  for (const [key, value] of defaults) {
    await run(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`, [key, value]);
  }

  // Default admin user
  const existing = await get(`SELECT id FROM users WHERE username = 'admin'`);
  if (!existing) {
    const hash = await bcrypt.hash('admin123', 10);
    await run(`INSERT INTO users (username, password) VALUES ('admin', ?)`, [hash]);
    console.log('Default admin created: admin / admin123');
  }

  console.log('Database initialized');
}

module.exports = { initDB, run, get, all, getDB };
