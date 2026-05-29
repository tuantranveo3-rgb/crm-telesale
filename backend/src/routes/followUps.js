const express = require('express');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function buildAccess(user, db) {
  if (user.role === 'Admin') return { where: '1=1', params: [] };
  if (user.role === 'Manager') {
    const sales = await db.all('SELECT user_id FROM users WHERE area_id = ?', [user.area_id]);
    const ids = sales.map(s => s.user_id);
    if (!ids.length) return { where: '1=0', params: [] };
    return { where: `f.sale_id IN (${ids.map(() => '?').join(',')})`, params: ids };
  }
  return { where: 'f.sale_id = ?', params: [user.user_id] };
}

router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const { status, sale_id, date_from, date_to, today_only, overdue } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const todayStr = new Date().toISOString().split('T')[0];

    // Auto-mark overdue
    await db.run(`UPDATE follow_ups SET status='Quá hạn' WHERE follow_up_date < ? AND status='Chưa xử lý'`, [todayStr]);

    const { where: accessWhere, params: accessParams } = await buildAccess(req.user, db);
    const conditions = [accessWhere];
    const params = [...accessParams];

    if (today_only === 'true') { conditions.push('f.follow_up_date = ?'); params.push(todayStr); }
    if (overdue === 'true') { conditions.push("f.follow_up_date < ? AND f.status = 'Quá hạn'"); params.push(todayStr); }
    if (status) { conditions.push('f.status = ?'); params.push(status); }
    if (sale_id && req.user.role === 'Admin') { conditions.push('f.sale_id = ?'); params.push(sale_id); }
    if (date_from) { conditions.push('f.follow_up_date >= ?'); params.push(date_from); }
    if (date_to) { conditions.push('f.follow_up_date <= ?'); params.push(date_to); }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * limit;
    const countRow = await db.get(`SELECT COUNT(*) as count FROM follow_ups f WHERE ${where}`, params);
    const rows = await db.all(`SELECT f.*, c.customer_name, c.phone, c.customer_code, u.full_name as sale_name
      FROM follow_ups f JOIN customers c ON f.customer_id = c.customer_id JOIN users u ON f.sale_id = u.user_id
      WHERE ${where} ORDER BY f.follow_up_date ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({ data: rows, pagination: { total: countRow.count, page, limit, totalPages: Math.ceil(countRow.count / limit) } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { customer_id, follow_up_date, follow_up_type, content } = req.body;
    if (!customer_id || !follow_up_date) return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    const db = await getDb();
    const result = await db.run("INSERT INTO follow_ups (customer_id,sale_id,follow_up_date,follow_up_type,content,status) VALUES (?,?,?,?,?,'Chưa xử lý')",
      [customer_id, req.user.user_id, follow_up_date, follow_up_type || 'Gọi điện', content || null]);
    res.status(201).json({ message: 'Tạo follow-up thành công', followup_id: result.lastID });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const fu = await db.get('SELECT * FROM follow_ups WHERE followup_id = ?', [req.params.id]);
    if (!fu) return res.status(404).json({ message: 'Không tìm thấy follow-up' });
    const { status, result_note, follow_up_date, follow_up_type, content } = req.body;
    await db.run('UPDATE follow_ups SET status=?,result_note=?,follow_up_date=?,follow_up_type=?,content=?,updated_at=CURRENT_TIMESTAMP WHERE followup_id=?',
      [status ?? fu.status, result_note ?? fu.result_note, follow_up_date ?? fu.follow_up_date,
       follow_up_type ?? fu.follow_up_type, content ?? fu.content, req.params.id]);
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    await db.run('DELETE FROM follow_ups WHERE followup_id = ?', [req.params.id]);
    res.json({ message: 'Xóa thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
