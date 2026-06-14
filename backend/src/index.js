require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const cors    = require('cors');
const { initDB } = require('./models/database');
const authRoutes    = require('./routes/auth');
const inboundRoutes = require('./routes/inbounds');
const clientRoutes  = require('./routes/clients');
const serverRoutes  = require('./routes/server');
const xrayRoutes    = require('./routes/xray');
const ipLimitRoutes  = require('./routes/iplimit')
const telegramRoutes = require('./routes/telegram')
const backupRoutes   = require('./routes/backup')
const updateRoutes   = require('./routes/update');
const ipLimitService = require('./services/ipLimitService');
const statsPoller    = require('./services/statsPoller')
const telegram       = require('./services/telegramBot');
const logger = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

// ── Client IP extraction (behind Nginx) ───────────────────────────────────────
app.use((req, _res, next) => {
  const raw = req.headers['x-real-ip'] ||
              req.headers['x-forwarded-for']?.split(',')[0] ||
              req.socket.remoteAddress;
  req.clientIP = raw?.replace('::ffff:', '') || '';
  next();
});

// ── Boot ──────────────────────────────────────────────────────────────────────
initDB().then(async () => {

  app.use('/api/auth',     authRoutes);
  app.use('/api/inbounds', inboundRoutes);
  app.use('/api/clients',  clientRoutes);
  app.use('/api/server',   serverRoutes);
  app.use('/api/xray',     xrayRoutes);
  app.use('/api/iplimit',  ipLimitRoutes);
  app.use('/api/telegram', telegramRoutes);
  app.use('/api/backup',   backupRoutes);
  app.use('/api/update',   updateRoutes);

  // FIX: sub routes registered under /sub (not duplicated under /api/xray)
  app.use('/sub', xrayRoutes);

  // Health check
  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', version: '1.0.0' })
  );

  // IP limit service — load existing bans, start log watcher, start enforcer
  const xrayLogPath = process.env.XRAY_ACCESS_LOG || '/var/log/xray/access.log';
  await ipLimitService.loadBansFromDB();
  ipLimitService.startLogWatcher(xrayLogPath);
  ipLimitService.startEnforcer();

  // Telegram bot
  await telegram.init()

  // Stats poller (removed duplicate trafficPoller — statsPoller is the one source of truth)
  statsPoller.start();

  app.listen(PORT, () =>
    logger.info(`NexAura Veil backend running on port ${PORT}`)
  );

}).catch(err => {
  console.error('Failed to initialize DB:', err);
  process.exit(1);
});

module.exports = app;
