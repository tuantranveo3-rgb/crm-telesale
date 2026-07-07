const { getDb } = require('../config/database');

async function buildCustomerQuery(user) {
  const db = await getDb();
  if (user.role === 'Admin') return { where: '1=1', params: [] };
  if (user.role === 'Manager') {
    const sales = await db.all('SELECT user_id FROM users WHERE area_id = ?', [user.area_id]);
    const ids = sales.map(s => s.user_id);
    if (!ids.length) return { where: '1=0', params: [] };
    return { where: `c.assigned_sale_id IN (${ids.map(() => '?').join(',')})`, params: ids };
  }
  // Sale/Telesale can view all customers
  return { where: '1=1', params: [] };
}

async function logAudit(userId, action, entityType, entityId, oldData, newData) {
  const db = await getDb();
  await db.run(
    'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data) VALUES (?,?,?,?,?,?)',
    [userId, action, entityType, entityId, oldData ? JSON.stringify(oldData) : null, newData ? JSON.stringify(newData) : null]
  );
}

module.exports = { buildCustomerQuery, logAudit };
