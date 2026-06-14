const express = require('express');
const { run, get, all } = require('../models/database');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/inbounds
router.get('/', async (req, res) => {
  try {
    const inbounds = await all(`SELECT * FROM inbounds ORDER BY id DESC`);
    const result = inbounds.map(i => ({
      ...i,
      settings:        JSON.parse(i.settings        || '{}'),
      stream_settings: JSON.parse(i.stream_settings || '{}'),
      sniffing:        JSON.parse(i.sniffing         || '{}'),
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inbounds/:id
router.get('/:id', async (req, res) => {
  try {
    const row = await get(`SELECT * FROM inbounds WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({
      ...row,
      settings:        JSON.parse(row.settings        || '{}'),
      stream_settings: JSON.parse(row.stream_settings || '{}'),
      sniffing:        JSON.parse(row.sniffing         || '{}'),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inbounds
router.post('/', async (req, res) => {
  try {
    const {
      remark, tag, protocol, port,
      listen = '0.0.0.0',
      settings = {}, stream_settings = {}, sniffing = {},
      enable = true, total = 0, expiry_time = 0,
    } = req.body;

    // Use remark as tag if tag not provided
    const inboundTag = tag || remark || `inbound-${port}`;
    if (!protocol || !port) return res.status(400).json({ error: 'protocol and port required' });

    const result = await run(
      `INSERT INTO inbounds (tag, protocol, port, listen, settings, stream_settings, sniffing, enabled)
       VALUES (?,?,?,?,?,?,?,?)`,
      [inboundTag, protocol, port, listen,
       JSON.stringify(settings), JSON.stringify(stream_settings), JSON.stringify(sniffing),
       enable ? 1 : 0]
    );
    const created = await get(`SELECT * FROM inbounds WHERE id = ?`, [result.lastID]);
    res.status(201).json({ ...created, remark: created.tag });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Tag/remark already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/inbounds/:id
router.put('/:id', async (req, res) => {
  try {
    const { remark, tag, protocol, port, listen, settings, stream_settings, sniffing, enable, enabled } = req.body;
    const inboundTag = tag || remark;
    const isEnabled = enable !== undefined ? enable : enabled;

    await run(
      `UPDATE inbounds SET tag=COALESCE(?,tag), protocol=COALESCE(?,protocol),
       port=COALESCE(?,port), listen=COALESCE(?,listen),
       settings=COALESCE(?,settings), stream_settings=COALESCE(?,stream_settings),
       sniffing=COALESCE(?,sniffing), enabled=COALESCE(?,enabled)
       WHERE id=?`,
      [inboundTag, protocol, port, listen,
       settings ? JSON.stringify(settings) : null,
       stream_settings ? JSON.stringify(stream_settings) : null,
       sniffing ? JSON.stringify(sniffing) : null,
       isEnabled !== undefined ? (isEnabled ? 1 : 0) : null,
       req.params.id]
    );
    const updated = await get(`SELECT * FROM inbounds WHERE id = ?`, [req.params.id]);
    res.json({ ...updated, remark: updated.tag });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/inbounds/:id
router.delete('/:id', async (req, res) => {
  try {
    await run(`DELETE FROM inbounds WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inbounds/:id/reset  (reset traffic)
router.post('/:id/reset', async (req, res) => {
  try {
    await run(`UPDATE inbounds SET up=0, down=0 WHERE id=?`, [req.params.id]);
    res.json({ message: 'Traffic reset' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
