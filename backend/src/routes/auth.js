const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, run } = require('../models/database');
const auth = require('../middleware/auth');

const router = express.Router();
const SECRET = () => process.env.JWT_SECRET || 'nexaura-secret';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing credentials' });

    const user = await get(`SELECT * FROM users WHERE username = ?`, [username]);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET(), { expiresIn: '24h' });
    res.json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/logout
router.post('/logout', auth, (req, res) => {
  res.json({ message: 'Logged out' });
});

// POST /api/auth/change-password  (original)
// PUT  /api/auth/password          (frontend uses this)
async function changePasswordHandler(req, res) {
  try {
    const { oldPassword, newPassword, new1 } = req.body;
    const newPass = newPassword || new1;
    const user = await get(`SELECT * FROM users WHERE id = ?`, [req.user.id]);

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });
    if (!newPass || newPass.length < 6) return res.status(400).json({ error: 'New password too short' });

    const hash = await bcrypt.hash(newPass, 10);
    await run(`UPDATE users SET password = ? WHERE id = ?`, [hash, req.user.id]);
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

router.post('/change-password', auth, changePasswordHandler);
router.put('/password', auth, changePasswordHandler);

module.exports = router;
