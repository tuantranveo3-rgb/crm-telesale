const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const db = await getDb();
    let users;
    if (req.user.role === 'Manager') {
      users = await db.all(`SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.area_id, u.status, u.created_at, a.area_name
        FROM users u LEFT JOIN areas a ON u.area_id = a.area_id WHERE u.area_id = ?`, [req.user.area_id]);
    } else {
      users = await db.all(`SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.area_id, u.status, u.created_at, a.area_name
        FROM users u LEFT JOIN areas a ON u.area_id = a.area_id ORDER BY u.created_at DESC`);
    }
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', authenticate, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.get(`SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.area_id, u.status, u.created_at, a.area_name
      FROM users u LEFT JOIN areas a ON u.area_id = a.area_id WHERE u.user_id = ?`, [req.params.id]);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { full_name, email, phone, password, role, area_id } = req.body;
    if (!full_name || !email || !password || !role) return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    const db = await getDb();
    const exists = await db.get('SELECT user_id FROM users WHERE email = ?', [email]);
    if (exists) return res.status(400).json({ message: 'Email đã tồn tại' });
    const result = await db.run(
      'INSERT INTO users (full_name, email, phone, password_hash, role, area_id) VALUES (?,?,?,?,?,?)',
      [full_name, email, phone || null, bcrypt.hashSync(password, 10), role, area_id || null]
    );
    res.status(201).json({ message: 'Tạo người dùng thành công', user_id: result.lastID });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { full_name, email, phone, role, area_id, status, password } = req.body;
    const db = await getDb();
    const user = await db.get('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    if (email && email !== user.email) {
      const exists = await db.get('SELECT user_id FROM users WHERE email = ? AND user_id != ?', [email, req.params.id]);
      if (exists) return res.status(400).json({ message: 'Email đã tồn tại' });
    }
    const newHash = password ? bcrypt.hashSync(password, 10) : user.password_hash;
    await db.run(
      'UPDATE users SET full_name=?, email=?, phone=?, password_hash=?, role=?, area_id=?, status=? WHERE user_id=?',
      [full_name || user.full_name, email || user.email, phone ?? user.phone, newHash, role || user.role, area_id ?? user.area_id, status || user.status, req.params.id]
    );
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.user_id) return res.status(400).json({ message: 'Không thể xóa tài khoản của chính mình' });
    const db = await getDb();
    await db.run('UPDATE users SET status = ? WHERE user_id = ?', ['Inactive', req.params.id]);
    res.json({ message: 'Đã vô hiệu hóa người dùng' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
