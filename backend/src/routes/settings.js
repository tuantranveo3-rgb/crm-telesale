const express = require('express');
const { getDb } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET all lookups (grouped by category) — mọi user đọc được
router.get('/lookups', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const { category } = req.query;
    const rows = category
      ? await db.all('SELECT * FROM lookup_values WHERE category = ? AND is_active = 1 ORDER BY sort_order, value', [category])
      : await db.all('SELECT * FROM lookup_values WHERE is_active = 1 ORDER BY category, sort_order, value');

    // Group by category
    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push(r);
    });
    res.json({ data: rows, grouped });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET all (including inactive) — admin only
router.get('/lookups/all', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all('SELECT * FROM lookup_values ORDER BY category, sort_order, value');
    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.category]) grouped[r.category] = [];
      grouped[r.category].push(r);
    });
    res.json({ data: rows, grouped });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST — tạo mới
router.post('/lookups', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { category, parent_value, value, sort_order } = req.body;
    if (!category || !value) return res.status(400).json({ message: 'category và value là bắt buộc' });
    const db = await getDb();
    const exists = await db.get('SELECT id FROM lookup_values WHERE category = ? AND value = ? AND (parent_value = ? OR (parent_value IS NULL AND ? IS NULL))',
      [category, value, parent_value || null, parent_value || null]);
    if (exists) return res.status(400).json({ message: 'Giá trị đã tồn tại trong danh mục này' });
    const result = await db.run(
      'INSERT INTO lookup_values (category, parent_value, value, sort_order) VALUES (?, ?, ?, ?)',
      [category, parent_value || null, value, sort_order || 0]
    );
    res.status(201).json({ message: 'Thêm thành công', id: result.lastID });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT — cập nhật
router.put('/lookups/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const db = await getDb();
    const row = await db.get('SELECT * FROM lookup_values WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ message: 'Không tìm thấy' });
    const { value, parent_value, sort_order, is_active } = req.body;
    await db.run('UPDATE lookup_values SET value=?, parent_value=?, sort_order=?, is_active=? WHERE id=?',
      [value ?? row.value, parent_value !== undefined ? (parent_value || null) : row.parent_value,
       sort_order ?? row.sort_order, is_active !== undefined ? is_active : row.is_active, req.params.id]);
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE
router.delete('/lookups/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const db = await getDb();
    await db.run('DELETE FROM lookup_values WHERE id = ?', [req.params.id]);
    res.json({ message: 'Đã xóa' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
