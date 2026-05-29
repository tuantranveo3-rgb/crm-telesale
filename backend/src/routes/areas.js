const express = require('express');
const { getDb } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const areas = await db.all(`SELECT a.*, u.full_name as manager_name,
      (SELECT COUNT(*) FROM users us WHERE us.area_id = a.area_id) as sale_count
      FROM areas a LEFT JOIN users u ON a.manager_id = u.user_id ORDER BY a.area_name`);
    res.json(areas);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const area = await db.get(`SELECT a.*, u.full_name as manager_name FROM areas a LEFT JOIN users u ON a.manager_id = u.user_id WHERE a.area_id = ?`, [req.params.id]);
    if (!area) return res.status(404).json({ message: 'Không tìm thấy khu vực' });
    const sales = await db.all('SELECT user_id, full_name, email, role, status FROM users WHERE area_id = ?', [req.params.id]);
    res.json({ ...area, sales });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { area_name, province, district, manager_id } = req.body;
    if (!area_name) return res.status(400).json({ message: 'Tên khu vực là bắt buộc' });
    const db = await getDb();
    const result = await db.run('INSERT INTO areas (area_name, province, district, manager_id) VALUES (?,?,?,?)', [area_name, province || null, district || null, manager_id || null]);
    res.status(201).json({ message: 'Tạo khu vực thành công', area_id: result.lastID });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const { area_name, province, district, manager_id } = req.body;
    const db = await getDb();
    const area = await db.get('SELECT * FROM areas WHERE area_id = ?', [req.params.id]);
    if (!area) return res.status(404).json({ message: 'Không tìm thấy khu vực' });
    await db.run('UPDATE areas SET area_name=?, province=?, district=?, manager_id=? WHERE area_id=?',
      [area_name || area.area_name, province ?? area.province, district ?? area.district, manager_id ?? area.manager_id, req.params.id]);
    res.json({ message: 'Cập nhật khu vực thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', authenticate, authorize('Admin'), async (req, res) => {
  try {
    const db = await getDb();
    await db.run('DELETE FROM areas WHERE area_id = ?', [req.params.id]);
    res.json({ message: 'Xóa khu vực thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
