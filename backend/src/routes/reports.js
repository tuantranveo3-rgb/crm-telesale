const express = require('express');
const ExcelJS = require('exceljs');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

async function buildSaleFilter(req, db) {
  const { sale_id } = req.query;
  if (req.user.role === 'Sale' || req.user.role === 'Telesale') return { where: 'cl.sale_id = ?', params: [req.user.user_id] };
  if (req.user.role === 'Manager') {
    const sales = await db.all('SELECT user_id FROM users WHERE area_id = ?', [req.user.area_id]);
    const ids = sales.map(s => s.user_id);
    if (!ids.length) return { where: '1=0', params: [] };
    return { where: `cl.sale_id IN (${ids.map(() => '?').join(',')})`, params: ids };
  }
  if (sale_id) return { where: 'cl.sale_id = ?', params: [sale_id] };
  return { where: '1=1', params: [] };
}

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

router.get('/calls', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const { date_from, date_to } = req.query;
    const now = new Date();
    const from = date_from || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const to = date_to || now.toISOString().split('T')[0];
    const { where, params } = await buildSaleFilter(req, db);
    const rows = await db.all(`SELECT u.full_name as sale_name, cl.call_result, COUNT(*) as count
      FROM call_logs cl JOIN users u ON cl.sale_id = u.user_id
      WHERE cl.call_date >= ? AND cl.call_date <= ? AND ${where}
      GROUP BY cl.sale_id, cl.call_result ORDER BY u.full_name, count DESC`, [from, to, ...params]);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/followups', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all(`SELECT f.*, c.customer_name, c.phone, u.full_name as sale_name
      FROM follow_ups f JOIN customers c ON f.customer_id = c.customer_id JOIN users u ON f.sale_id = u.user_id
      WHERE f.status IN ('Quá hạn','Chưa xử lý') AND f.follow_up_date < date('now')
      ORDER BY f.follow_up_date ASC LIMIT 200`);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/pipeline', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const rows = await db.all(`SELECT o.stage, COUNT(*) as count, SUM(o.estimated_value) as total_value, AVG(o.probability) as avg_probability, u.full_name as sale_name
      FROM opportunities o JOIN users u ON o.sale_id = u.user_id
      GROUP BY o.stage, o.sale_id ORDER BY o.stage, total_value DESC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/export/:type', authenticate, async (req, res) => {
  try {
    const { type } = req.params;
    const db = await getDb();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Báo cáo');
    if (type === 'calls') {
      sheet.columns = [{ header: 'Sale', key: 'sale_name', width: 20 }, { header: 'Kết quả gọi', key: 'call_result', width: 15 }, { header: 'Số cuộc', key: 'count', width: 10 }];
      const rows = await db.all(`SELECT u.full_name as sale_name, cl.call_result, COUNT(*) as count FROM call_logs cl JOIN users u ON cl.sale_id = u.user_id GROUP BY cl.sale_id, cl.call_result ORDER BY u.full_name`);
      rows.forEach(r => sheet.addRow(r));
    } else {
      sheet.columns = [{ header: 'Sale', key: 'sale_name', width: 20 }, { header: 'Khu vực', key: 'area_name', width: 20 }, { header: 'Trạng thái', key: 'status', width: 18 }, { header: 'Tổng KH', key: 'total', width: 10 }, { header: 'Đã mua', key: 'converted', width: 12 }];
      const rows = await db.all(`SELECT u.full_name as sale_name, a.area_name, c.status, COUNT(*) as total, SUM(CASE WHEN c.status='Đã mua' THEN 1 ELSE 0 END) as converted
        FROM customers c LEFT JOIN users u ON c.assigned_sale_id = u.user_id LEFT JOIN areas a ON c.area_id = a.area_id GROUP BY c.assigned_sale_id, c.status ORDER BY u.full_name`);
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
