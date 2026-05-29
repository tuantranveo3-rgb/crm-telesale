const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email và mật khẩu là bắt buộc' });
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }
    if (user.status !== 'Active') return res.status(403).json({ message: 'Tài khoản đã bị vô hiệu hóa' });
    const token = jwt.sign({ userId: user.user_id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    const { password_hash, ...userInfo } = user;
    res.json({ token, user: userInfo });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/me', authenticate, (req, res) => res.json({ user: req.user }));

router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE user_id = ?', [req.user.user_id]);
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ message: 'Mật khẩu hiện tại không đúng' });
    }
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }
    await db.run('UPDATE users SET password_hash = ? WHERE user_id = ?', [bcrypt.hashSync(newPassword, 10), req.user.user_id]);
    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
