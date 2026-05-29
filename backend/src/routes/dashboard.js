const express = require('express');
const { getDb } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const { month, year, sale_id, area_id } = req.query;
    const now = new Date();
    const m = String(month || now.getMonth() + 1).padStart(2, '0');
    const y = year || now.getFullYear();
    const todayStr = now.toISOString().split('T')[0];
    const monthStart = `${y}-${m}-01`;
    const daysInMonth = new Date(y, parseInt(m), 0).getDate();
    const monthEnd = `${y}-${m}-${String(daysInMonth).padStart(2, '0')}`;

    let saleIds = null;
    if (req.user.role === 'Sale' || req.user.role === 'Telesale') { saleIds = [req.user.user_id]; }
    else if (req.user.role === 'Manager') {
      const sales = await db.all('SELECT user_id FROM users WHERE area_id = ?', [req.user.area_id]);
      saleIds = sales.map(s => s.user_id);
    } else {
      if (sale_id) saleIds = [parseInt(sale_id)];
      else if (area_id) { const sales = await db.all('SELECT user_id FROM users WHERE area_id = ?', [area_id]); saleIds = sales.map(s => s.user_id); }
    }

    const saleFilter = saleIds?.length ? `AND assigned_sale_id IN (${saleIds.map(() => '?').join(',')})` : '';
    const callSaleFilter = saleIds?.length ? `AND sale_id IN (${saleIds.map(() => '?').join(',')})` : '';
    const sp = saleIds || [];

    const totalCustomers = (await db.get(`SELECT COUNT(*) as c FROM customers WHERE 1=1 ${saleFilter}`, sp)).c;
    const newCustomers = (await db.get(`SELECT COUNT(*) as c FROM customers WHERE created_at >= ? AND created_at <= ? ${saleFilter}`, [monthStart, monthEnd + ' 23:59:59', ...sp])).c;
    const callsToday = (await db.get(`SELECT COUNT(*) as c FROM call_logs WHERE call_date = ? ${callSaleFilter}`, [todayStr, ...sp])).c;
    const callsMonth = (await db.get(`SELECT COUNT(*) as c FROM call_logs WHERE call_date >= ? AND call_date <= ? ${callSaleFilter}`, [monthStart, monthEnd, ...sp])).c;
    const followToday = (await db.get(`SELECT COUNT(*) as c FROM follow_ups WHERE follow_up_date = ? AND status = 'Chưa xử lý' ${callSaleFilter}`, [todayStr, ...sp])).c;
    const followOverdue = (await db.get(`SELECT COUNT(*) as c FROM follow_ups WHERE follow_up_date < ? AND status IN ('Chưa xử lý','Quá hạn') ${callSaleFilter}`, [todayStr, ...sp])).c;

    const callStats = await db.all(`SELECT call_result, COUNT(*) as count FROM call_logs WHERE call_date >= ? AND call_date <= ? ${callSaleFilter} GROUP BY call_result`, [monthStart, monthEnd, ...sp]);
    const totalCalls = callStats.reduce((s, r) => s + r.count, 0);
    const answered = callStats.find(r => r.call_result === 'Nghe máy')?.count || 0;
    const interested = callStats.find(r => r.call_result === 'Quan tâm')?.count || 0;
    const closed = callStats.find(r => r.call_result === 'Chốt đơn')?.count || 0;

    const pipelineSaleFilter = saleIds?.length ? `AND o.sale_id IN (${saleIds.map(() => '?').join(',')})` : '';
    const pipelineStats = await db.all(`SELECT stage, COUNT(*) as count, SUM(estimated_value) as total_value FROM opportunities o WHERE 1=1 ${pipelineSaleFilter} GROUP BY stage`, sp);
    const topSalesCalls = await db.all(`SELECT u.full_name, COUNT(*) as call_count FROM call_logs cl JOIN users u ON cl.sale_id = u.user_id WHERE cl.call_date >= ? AND cl.call_date <= ? ${callSaleFilter} GROUP BY cl.sale_id ORDER BY call_count DESC LIMIT 5`, [monthStart, monthEnd, ...sp]);
    const topSalesConversion = await db.all(`SELECT u.full_name, COUNT(*) as converted FROM customers c JOIN users u ON c.assigned_sale_id = u.user_id WHERE c.status = 'Đã mua' ${saleFilter} GROUP BY c.assigned_sale_id ORDER BY converted DESC LIMIT 5`, sp);
    const customerByStatus = await db.all(`SELECT status, COUNT(*) as count FROM customers WHERE 1=1 ${saleFilter} GROUP BY status`, sp);

    res.json({
      summary: { totalCustomers, newCustomers, callsToday, callsMonth, followToday, followOverdue,
        answerRate: totalCalls ? Math.round((answered / totalCalls) * 100) : 0,
        interestRate: totalCalls ? Math.round((interested / totalCalls) * 100) : 0,
        closeRate: totalCalls ? Math.round((closed / totalCalls) * 100) : 0 },
      callStats, pipelineStats, topSalesCalls, topSalesConversion, customerByStatus,
      period: { month: parseInt(m), year: parseInt(y) },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
