const express = require('express');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const { customer_id, sale_id, call_result, call_method, call_status, date_from, date_to } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const conditions = [];
    const params = [];

    if (req.user.role === 'Sale' || req.user.role === 'Telesale') { conditions.push('cl.sale_id = ?'); params.push(req.user.user_id); }
    else if (req.user.role === 'Manager') {
      const sales = await db.all('SELECT user_id FROM users WHERE area_id = ?', [req.user.area_id]);
      const ids = sales.map(s => s.user_id);
      if (ids.length) { conditions.push(`cl.sale_id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
    }
    if (customer_id) { conditions.push('cl.customer_id = ?'); params.push(customer_id); }
    if (sale_id && req.user.role === 'Admin') { conditions.push('cl.sale_id = ?'); params.push(sale_id); }
    if (call_result) { conditions.push('cl.call_result = ?'); params.push(call_result); }
    if (call_method) { conditions.push('cl.call_method = ?'); params.push(call_method); }
    if (call_status) { conditions.push('cl.call_status = ?'); params.push(call_status); }
    if (date_from) { conditions.push('cl.call_date >= ?'); params.push(date_from); }
    if (date_to) { conditions.push('cl.call_date <= ?'); params.push(date_to); }

    const where = conditions.length ? conditions.join(' AND ') : '1=1';
    const offset = (page - 1) * limit;
    const countRow = await db.get(`SELECT COUNT(*) as count FROM call_logs cl WHERE ${where}`, params);
    const rows = await db.all(`SELECT cl.*, c.customer_name, c.phone, c.customer_code, u.full_name as sale_name
      FROM call_logs cl JOIN customers c ON cl.customer_id = c.customer_id JOIN users u ON cl.sale_id = u.user_id
      WHERE ${where} ORDER BY cl.call_date DESC, cl.call_time DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({ data: rows, pagination: { total: countRow.count, page, limit, totalPages: Math.ceil(countRow.count / limit) } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { customer_id, call_date, call_time, call_result, call_method, call_status, call_content, customer_need, interest_level, next_action, follow_up_date, status_after_call } = req.body;
    if (!customer_id || !call_date || !call_result) return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
    const db = await getDb();
    const customer = await db.get('SELECT * FROM customers WHERE customer_id = ?', [customer_id]);
    if (!customer) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    if ((req.user.role === 'Sale' || req.user.role === 'Telesale') && customer.assigned_sale_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Bạn không có quyền nhập cuộc gọi cho khách hàng này' });
    }
    const result = await db.run(
      'INSERT INTO call_logs (customer_id,sale_id,call_date,call_time,call_result,call_method,call_status,call_content,customer_need,interest_level,next_action,follow_up_date,status_after_call) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [customer_id, req.user.user_id, call_date, call_time || null, call_result, call_method || 'Gọi điện', call_status || 'Kết thúc', call_content || null, customer_need || null, interest_level || null, next_action || null, follow_up_date || null, status_after_call || null]
    );
    if (status_after_call) {
      await db.run('UPDATE customers SET status=?, updated_at=CURRENT_TIMESTAMP WHERE customer_id=?', [status_after_call, customer_id]);
    }
    if (follow_up_date && next_action && next_action !== 'Không xử lý tiếp') {
      const typeMap = { 'Gửi báo giá': 'Gửi báo giá', 'Gửi mẫu': 'Nhắn Zalo', 'Hẹn gặp': 'Gặp trực tiếp', 'Gọi lại': 'Gọi điện', 'Chốt đơn': 'Gọi điện' };
      await db.run("INSERT INTO follow_ups (customer_id,sale_id,follow_up_date,follow_up_type,content,status) VALUES (?,?,?,?,?,'Chưa xử lý')",
        [customer_id, req.user.user_id, follow_up_date, typeMap[next_action] || 'Gọi điện', call_content || `Follow-up từ cuộc gọi ngày ${call_date}`]);
    }
    res.status(201).json({ message: 'Nhập cuộc gọi thành công', call_id: result.lastID });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const log = await db.get('SELECT * FROM call_logs WHERE call_id = ?', [req.params.id]);
    if (!log) return res.status(404).json({ message: 'Không tìm thấy cuộc gọi' });
    if (log.sale_id !== req.user.user_id && req.user.role !== 'Admin') return res.status(403).json({ message: 'Không có quyền' });
    const { call_result, call_method, call_status, call_content, customer_need, interest_level, next_action, follow_up_date, status_after_call } = req.body;
    await db.run('UPDATE call_logs SET call_result=?,call_method=?,call_status=?,call_content=?,customer_need=?,interest_level=?,next_action=?,follow_up_date=?,status_after_call=? WHERE call_id=?',
      [call_result || log.call_result, call_method ?? log.call_method, call_status ?? log.call_status,
       call_content ?? log.call_content, customer_need ?? log.customer_need,
       interest_level ?? log.interest_level, next_action ?? log.next_action, follow_up_date ?? log.follow_up_date,
       status_after_call ?? log.status_after_call, req.params.id]);
    res.json({ message: 'Cập nhật thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const log = await db.get('SELECT * FROM call_logs WHERE call_id = ?', [req.params.id]);
    if (!log) return res.status(404).json({ message: 'Không tìm thấy cuộc gọi' });
    if (log.sale_id !== req.user.user_id && req.user.role !== 'Admin') return res.status(403).json({ message: 'Không có quyền' });
    await db.run('DELETE FROM call_logs WHERE call_id = ?', [req.params.id]);
    res.json({ message: 'Xóa thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
