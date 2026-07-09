const express = require('express');
const ExcelJS = require('exceljs');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function buildSaleFilter(req, db, alias = 'cl') {
  const { sale_id } = req.query;
  if (req.user.role === 'Sale' || req.user.role === 'Telesale') return { where: `${alias}.sale_id = ?`, params: [req.user.user_id] };
  if (req.user.role === 'Manager') {
    const sales = await db.all('SELECT user_id FROM users WHERE area_id = ?', [req.user.area_id]);
    const ids = sales.map(s => s.user_id);
    if (!ids.length) return { where: '1=0', params: [] };
    return { where: `${alias}.sale_id IN (${ids.map(() => '?').join(',')})`, params: ids };
  }
  if (sale_id) return { where: `${alias}.sale_id = ?`, params: [sale_id] };
  return { where: '1=1', params: [] };
}

// ── Tổng quan ──────────────────────────────────────────────
router.get('/overview', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const now = new Date();
    const from = req.query.date_from || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = req.query.date_to || now.toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    const { where, params } = await buildSaleFilter(req, db, 'cl');

    const [totalCalls, newCustomers, followupOverdue, followupToday, closedDeals] = await Promise.all([
      db.get(`SELECT COUNT(*) as c FROM call_logs cl WHERE cl.call_date >= ? AND cl.call_date <= ? AND ${where}`, [from, to, ...params]),
      db.get(`SELECT COUNT(*) as c FROM customers c WHERE c.created_at >= ? AND c.created_at <= ?`, [from, to + 'T23:59:59']),
      db.get(`SELECT COUNT(*) as c FROM follow_ups f WHERE f.status IN ('Quá hạn','Chưa xử lý') AND f.follow_up_date < ?`, [today]),
      db.get(`SELECT COUNT(*) as c FROM follow_ups f WHERE f.follow_up_date = ?`, [today]),
      db.get(`SELECT COUNT(*) as c FROM call_logs cl WHERE cl.call_result = 'Chốt đơn' AND cl.call_date >= ? AND cl.call_date <= ? AND ${where}`, [from, to, ...params]),
    ]);

    // Calls by day
    const byDay = await db.all(`SELECT cl.call_date as date, COUNT(*) as total,
      SUM(CASE WHEN cl.call_result='Chốt đơn' THEN 1 ELSE 0 END) as closed,
      SUM(CASE WHEN cl.call_result='Quan tâm' THEN 1 ELSE 0 END) as interested
      FROM call_logs cl WHERE cl.call_date >= ? AND cl.call_date <= ? AND ${where}
      GROUP BY cl.call_date ORDER BY cl.call_date`, [from, to, ...params]);

    // Calls by result
    const byResult = await db.all(`SELECT cl.call_result as name, COUNT(*) as value
      FROM call_logs cl WHERE cl.call_date >= ? AND cl.call_date <= ? AND ${where}
      GROUP BY cl.call_result ORDER BY value DESC`, [from, to, ...params]);

    // Calls by method
    const byMethod = await db.all(`SELECT COALESCE(cl.call_method,'Gọi điện') as name, COUNT(*) as value
      FROM call_logs cl WHERE cl.call_date >= ? AND cl.call_date <= ? AND ${where}
      GROUP BY cl.call_method ORDER BY value DESC`, [from, to, ...params]);

    res.json({
      kpis: {
        totalCalls: totalCalls.c,
        newCustomers: newCustomers.c,
        followupOverdue: followupOverdue.c,
        followupToday: followupToday.c,
        closedDeals: closedDeals.c,
      },
      byDay, byResult, byMethod,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Chi tiết cuộc gọi (bảng đầy đủ) ──────────────────────
router.get('/call-details', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const { date_from, date_to, call_result, call_method, call_status, customer_id } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const now = new Date();
    const from = date_from || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = date_to || now.toISOString().split('T')[0];
    const { where: saleWhere, params: saleParams } = await buildSaleFilter(req, db, 'cl');

    const conditions = [`cl.call_date >= ?`, `cl.call_date <= ?`, saleWhere];
    const params = [from, to, ...saleParams];
    if (call_result) { conditions.push('cl.call_result = ?'); params.push(call_result); }
    if (call_method) { conditions.push('cl.call_method = ?'); params.push(call_method); }
    if (call_status) { conditions.push('cl.call_status = ?'); params.push(call_status); }
    if (customer_id) { conditions.push('cl.customer_id = ?'); params.push(customer_id); }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    const [countRow, rows] = await Promise.all([
      db.get(`SELECT COUNT(*) as count FROM call_logs cl WHERE ${where}`, params),
      db.all(`SELECT cl.call_id, cl.call_date, cl.call_time, cl.call_result, cl.call_method, cl.call_status,
        cl.call_content, cl.next_action, cl.follow_up_date, cl.status_after_call,
        c.customer_name, c.phone, c.customer_code,
        u.full_name as sale_name
        FROM call_logs cl
        JOIN customers c ON cl.customer_id = c.customer_id
        JOIN users u ON cl.sale_id = u.user_id
        WHERE ${where} ORDER BY cl.call_date DESC, cl.call_time DESC LIMIT ? OFFSET ?`, [...params, limit, offset]),
    ]);

    res.json({ data: rows, pagination: { total: countRow.count, page, limit, totalPages: Math.ceil(countRow.count / limit) } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Hiệu suất từng Sale ────────────────────────────────────
router.get('/sale-performance', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const now = new Date();
    const from = req.query.date_from || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = req.query.date_to || now.toISOString().split('T')[0];
    const { where: saleWhere, params: saleParams } = await buildSaleFilter(req, db, 'cl');

    const rows = await db.all(`
      SELECT
        u.user_id, u.full_name as sale_name, a.area_name,
        COUNT(cl.call_id) as total_calls,
        COUNT(DISTINCT cl.customer_id) as unique_customers,
        SUM(CASE WHEN cl.call_result='Nghe máy' OR cl.call_result='Quan tâm' OR cl.call_result='Chốt đơn' OR cl.call_result='Hẹn gọi lại' THEN 1 ELSE 0 END) as answered,
        SUM(CASE WHEN cl.call_result='Quan tâm' THEN 1 ELSE 0 END) as interested,
        SUM(CASE WHEN cl.call_result='Chốt đơn' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN cl.call_result='Không nghe' THEN 1 ELSE 0 END) as no_answer,
        SUM(CASE WHEN cl.call_result='Từ chối' THEN 1 ELSE 0 END) as rejected
      FROM users u
      LEFT JOIN call_logs cl ON cl.sale_id = u.user_id AND cl.call_date >= ? AND cl.call_date <= ?
      LEFT JOIN areas a ON u.area_id = a.area_id
      WHERE (u.role = 'Sale' OR u.role = 'Telesale') AND u.status = 'Active'
        AND (${saleWhere.replace('cl.sale_id', 'u.user_id')})
      GROUP BY u.user_id ORDER BY total_calls DESC
    `, [from, to, ...saleParams]);

    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Cuộc gọi theo KH (số lần gọi mỗi KH) ─────────────────
router.get('/calls-by-customer', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const now = new Date();
    const from = req.query.date_from || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = req.query.date_to || now.toISOString().split('T')[0];
    const { where: saleWhere, params: saleParams } = await buildSaleFilter(req, db, 'cl');
    const search = req.query.search || '';

    const conditions = [`cl.call_date >= ?`, `cl.call_date <= ?`, saleWhere];
    const params = [from, to, ...saleParams];
    if (search) { conditions.push('(c.customer_name LIKE ? OR c.phone LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }

    const rows = await db.all(`
      SELECT c.customer_id, c.customer_code, c.customer_name, c.phone, c.status as customer_status,
        u.full_name as sale_name,
        COUNT(cl.call_id) as call_count,
        MAX(cl.call_date) as last_call_date,
        MAX(cl.call_result) as last_result,
        SUM(CASE WHEN cl.call_result='Chốt đơn' THEN 1 ELSE 0 END) as closed_count,
        SUM(CASE WHEN cl.call_result='Quan tâm' THEN 1 ELSE 0 END) as interested_count
      FROM call_logs cl
      JOIN customers c ON cl.customer_id = c.customer_id
      LEFT JOIN users u ON cl.sale_id = u.user_id
      WHERE ${conditions.join(' AND ')}
      GROUP BY cl.customer_id ORDER BY call_count DESC LIMIT 200
    `, params);

    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Follow-up (tất cả trạng thái) ─────────────────────────
router.get('/followups', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const today = new Date().toISOString().split('T')[0];
    const conditions = ['1=1'];
    const params = [];

    if (req.user.role === 'Sale' || req.user.role === 'Telesale') { conditions.push('f.sale_id = ?'); params.push(req.user.user_id); }
    else if (req.user.role === 'Manager') {
      const sales = await db.all('SELECT user_id FROM users WHERE area_id = ?', [req.user.area_id]);
      const ids = sales.map(s => s.user_id);
      if (ids.length) { conditions.push(`f.sale_id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
    } else if (req.query.sale_id) { conditions.push('f.sale_id = ?'); params.push(req.query.sale_id); }

    const rows = await db.all(`
      SELECT f.followup_id, f.follow_up_date, f.follow_up_type, f.content, f.status, f.result_note,
        c.customer_name, c.phone, c.customer_id,
        u.full_name as sale_name,
        CASE
          WHEN f.follow_up_date < ? AND f.status != 'Đã xử lý' THEN 'overdue'
          WHEN f.follow_up_date = ? THEN 'today'
          WHEN f.follow_up_date > ? THEN 'upcoming'
          ELSE 'done'
        END as urgency
      FROM follow_ups f
      JOIN customers c ON f.customer_id = c.customer_id
      JOIN users u ON f.sale_id = u.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY f.follow_up_date ASC LIMIT 500
    `, [...params, today, today, today]);

    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Pipeline ───────────────────────────────────────────────
router.get('/pipeline', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all(`SELECT o.stage, COUNT(*) as count, SUM(o.estimated_value) as total_value, AVG(o.probability) as avg_probability, u.full_name as sale_name
      FROM opportunities o JOIN users u ON o.sale_id = u.user_id
      GROUP BY o.stage, o.sale_id ORDER BY o.stage, total_value DESC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Báo cáo cũ (customers) ────────────────────────────────
router.get('/customers', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const { sale_id, area_id, status } = req.query;
    const conditions = ['1=1'];
    const params = [];
    if (req.user.role === 'Sale' || req.user.role === 'Telesale') { conditions.push('c.assigned_sale_id = ?'); params.push(req.user.user_id); }
    else if (req.user.role === 'Manager') {
      const sales = await db.all('SELECT user_id FROM users WHERE area_id = ?', [req.user.area_id]);
      const ids = sales.map(s => s.user_id);
      if (ids.length) { conditions.push(`c.assigned_sale_id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
    } else {
      if (sale_id) { conditions.push('c.assigned_sale_id = ?'); params.push(sale_id); }
      if (area_id) { conditions.push('c.area_id = ?'); params.push(area_id); }
    }
    if (status) { conditions.push('c.status = ?'); params.push(status); }
    const rows = await db.all(`SELECT u.full_name as sale_name, a.area_name, c.status, COUNT(*) as total,
      SUM(CASE WHEN c.status = 'Đã mua' THEN 1 ELSE 0 END) as converted
      FROM customers c LEFT JOIN users u ON c.assigned_sale_id = u.user_id LEFT JOIN areas a ON c.area_id = a.area_id
      WHERE ${conditions.join(' AND ')} GROUP BY c.assigned_sale_id, c.status ORDER BY u.full_name`, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Export Excel ───────────────────────────────────────────
router.get('/export/:type', authenticate, async (req, res) => {
  try {
    const { type } = req.params;
    const db = await getDb();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo cáo');
    const { where: saleWhere, params: saleParams } = await buildSaleFilter(req, db, 'cl');
    const now = new Date();
    const from = req.query.date_from || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = req.query.date_to || now.toISOString().split('T')[0];

    if (type === 'call-details') {
      sheet.columns = [
        { header: 'Ngày', key: 'call_date', width: 12 },
        { header: 'Giờ', key: 'call_time', width: 8 },
        { header: 'Khách hàng', key: 'customer_name', width: 25 },
        { header: 'SĐT', key: 'phone', width: 14 },
        { header: 'Sale', key: 'sale_name', width: 20 },
        { header: 'Hình thức', key: 'call_method', width: 15 },
        { header: 'Kết quả', key: 'call_result', width: 15 },
        { header: 'Trạng thái', key: 'call_status', width: 15 },
        { header: 'Nội dung', key: 'call_content', width: 40 },
        { header: 'Hành động tiếp', key: 'next_action', width: 18 },
        { header: 'Follow-up ngày', key: 'follow_up_date', width: 14 },
      ];
      const rows = await db.all(`SELECT cl.call_date, cl.call_time, c.customer_name, c.phone, u.full_name as sale_name,
        cl.call_method, cl.call_result, cl.call_status, cl.call_content, cl.next_action, cl.follow_up_date
        FROM call_logs cl JOIN customers c ON cl.customer_id = c.customer_id JOIN users u ON cl.sale_id = u.user_id
        WHERE cl.call_date >= ? AND cl.call_date <= ? AND ${saleWhere}
        ORDER BY cl.call_date DESC, cl.call_time DESC`, [from, to, ...saleParams]);
      rows.forEach(r => sheet.addRow(r));
    } else if (type === 'sale-performance') {
      sheet.columns = [
        { header: 'Sale', key: 'sale_name', width: 20 },
        { header: 'Khu vực', key: 'area_name', width: 18 },
        { header: 'Tổng gọi', key: 'total_calls', width: 12 },
        { header: 'KH tiếp cận', key: 'unique_customers', width: 14 },
        { header: 'Nghe máy', key: 'answered', width: 12 },
        { header: 'Quan tâm', key: 'interested', width: 12 },
        { header: 'Chốt đơn', key: 'closed', width: 12 },
        { header: 'Không nghe', key: 'no_answer', width: 13 },
        { header: 'Từ chối', key: 'rejected', width: 12 },
      ];
      const rows = await db.all(`SELECT u.full_name as sale_name, a.area_name,
        COUNT(cl.call_id) as total_calls, COUNT(DISTINCT cl.customer_id) as unique_customers,
        SUM(CASE WHEN cl.call_result IN ('Nghe máy','Quan tâm','Chốt đơn','Hẹn gọi lại') THEN 1 ELSE 0 END) as answered,
        SUM(CASE WHEN cl.call_result='Quan tâm' THEN 1 ELSE 0 END) as interested,
        SUM(CASE WHEN cl.call_result='Chốt đơn' THEN 1 ELSE 0 END) as closed,
        SUM(CASE WHEN cl.call_result='Không nghe' THEN 1 ELSE 0 END) as no_answer,
        SUM(CASE WHEN cl.call_result='Từ chối' THEN 1 ELSE 0 END) as rejected
        FROM users u
        LEFT JOIN call_logs cl ON cl.sale_id = u.user_id AND cl.call_date >= ? AND cl.call_date <= ?
        LEFT JOIN areas a ON u.area_id = a.area_id
        WHERE (u.role='Sale' OR u.role='Telesale') AND u.status='Active'
        GROUP BY u.user_id ORDER BY total_calls DESC`, [from, to]);
      rows.forEach(r => sheet.addRow(r));
    } else {
      sheet.columns = [{ header: 'Sale', key: 'sale_name', width: 20 }, { header: 'Kết quả gọi', key: 'call_result', width: 15 }, { header: 'Số cuộc', key: 'count', width: 10 }];
      const rows = await db.all(`SELECT u.full_name as sale_name, cl.call_result, COUNT(*) as count FROM call_logs cl JOIN users u ON cl.sale_id = u.user_id WHERE ${saleWhere} GROUP BY cl.sale_id, cl.call_result ORDER BY u.full_name`, saleParams);
      rows.forEach(r => sheet.addRow(r));
    }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=report_${type}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
