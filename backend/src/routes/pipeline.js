const express = require('express');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const STAGES = ['Lead mới', 'Đã liên hệ', 'Quan tâm', 'Gửi báo giá', 'Đang đàm phán', 'Chốt đơn', 'Mất cơ hội'];

router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const { sale_id, area_id, stage } = req.query;
    const conditions = [];
    const params = [];

    if (req.user.role === 'Sale' || req.user.role === 'Telesale') { conditions.push('o.sale_id = ?'); params.push(req.user.user_id); }
    else if (req.user.role === 'Manager') {
      const sales = await db.all('SELECT user_id FROM users WHERE area_id = ?', [req.user.area_id]);
      const ids = sales.map(s => s.user_id);
      if (ids.length) { conditions.push(`o.sale_id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
      else conditions.push('1=0');
    }
    if (sale_id && req.user.role === 'Admin') { conditions.push('o.sale_id = ?'); params.push(sale_id); }
    if (area_id && req.user.role === 'Admin') { conditions.push('c.area_id = ?'); params.push(area_id); }
    if (stage) { conditions.push('o.stage = ?'); params.push(stage); }

    const where = conditions.length ? conditions.join(' AND ') : '1=1';
    const rows = await db.all(`SELECT o.*, c.customer_name, c.phone, c.customer_code, c.customer_type, u.full_name as sale_name, a.area_name
      FROM opportunities o JOIN customers c ON o.customer_id = c.customer_id JOIN users u ON o.sale_id = u.user_id
      LEFT JOIN areas a ON c.area_id = a.area_id WHERE ${where} ORDER BY o.estimated_value DESC`, params);

    const pipeline = {};
    STAGES.forEach(s => { pipeline[s] = { items: [], total: 0, count: 0 }; });
    rows.forEach(row => {
      if (pipeline[row.stage]) { pipeline[row.stage].items.push(row); pipeline[row.stage].total += row.estimated_value || 0; pipeline[row.stage].count++; }
    });
    res.json({ pipeline, stages: STAGES, totalValue: rows.reduce((s, r) => s + (r.estimated_value || 0), 0) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { customer_id, stage, estimated_value, expected_close_date, probability, note } = req.body;
    if (!customer_id) return res.status(400).json({ message: 'Khách hàng là bắt buộc' });
    const db = await getDb();
    const result = await db.run('INSERT INTO opportunities (customer_id,sale_id,stage,estimated_value,expected_close_date,probability,note) VALUES (?,?,?,?,?,?,?)',
      [customer_id, req.user.user_id, stage || 'Lead mới', estimated_value || 0, expected_close_date || null, probability || 0, note || null]);
    res.status(201).json({ message: 'Tạo cơ hội thành công', opportunity_id: result.lastID });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const opp = await db.get('SELECT * FROM opportunities WHERE opportunity_id = ?', [req.params.id]);
    if (!opp) return res.status(404).json({ message: 'Không tìm thấy' });
    const { stage, estimated_value, expected_close_date, probability, note } = req.body;
    await db.run('UPDATE opportunities SET stage=?,estimated_value=?,expected_close_date=?,probability=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE opportunity_id=?',
      [stage ?? opp.stage, estimated_value ?? opp.estimated_value, expected_close_date ?? opp.expected_close_date, probability ?? opp.probability, note ?? opp.note, req.params.id]);
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    await db.run('DELETE FROM opportunities WHERE opportunity_id = ?', [req.params.id]);
    res.json({ message: 'Xóa thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
