const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { getDb } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { buildCustomerQuery, logAudit } = require('../utils/helpers');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Download template FIRST (before /:id)
router.get('/import/template', authenticate, async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Template');
    sheet.columns = [
      { header: 'Tên khách hàng *', key: 'customer_name', width: 25 },
      { header: 'Số điện thoại *', key: 'phone', width: 15 },
      { header: 'Zalo', key: 'zalo', width: 15 },
      { header: 'Địa chỉ', key: 'address', width: 30 },
      { header: 'Tỉnh/TP', key: 'province', width: 15 },
      { header: 'Quận/Huyện', key: 'district', width: 15 },
      { header: 'Phường/Xã', key: 'ward', width: 15 },
      { header: 'Loại KH (C1/C2/Tiệm nail/Spa/Salon/Đại lý/Khách lẻ)', key: 'customer_type', width: 35 },
      { header: 'Nguồn (DMS/Facebook/Zalo/Telesales/Giới thiệu/Đi thị trường/Khác)', key: 'source', width: 40 },
      { header: 'Tiềm năng (Cao/Trung bình/Thấp)', key: 'potential_level', width: 25 },
      { header: 'Ghi chú', key: 'note', width: 30 },
    ];
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.addRow({ customer_name: 'Tiệm Nail Mẫu', phone: '0912345678', customer_type: 'Tiệm nail', source: 'Telesales', potential_level: 'Cao' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=import_template.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Export Excel FIRST (before /:id)
router.get('/export/excel', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const { where, params } = await buildCustomerQuery(req.user);
    const rows = await db.all(`SELECT c.customer_code, c.customer_name, c.phone, c.zalo, c.address, c.province,
      c.district, c.ward, c.customer_type, c.source, c.potential_level, c.status, c.note, c.created_at,
      u.full_name as sale_name, a.area_name
      FROM customers c LEFT JOIN users u ON c.assigned_sale_id = u.user_id LEFT JOIN areas a ON c.area_id = a.area_id
      WHERE ${where} ORDER BY c.updated_at DESC`, params);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Khách hàng');
    sheet.columns = [
      { header: 'Mã KH', key: 'customer_code', width: 10 },
      { header: 'Tên khách hàng', key: 'customer_name', width: 25 },
      { header: 'Số điện thoại', key: 'phone', width: 15 },
      { header: 'Zalo', key: 'zalo', width: 15 },
      { header: 'Địa chỉ', key: 'address', width: 30 },
      { header: 'Tỉnh/TP', key: 'province', width: 15 },
      { header: 'Quận/Huyện', key: 'district', width: 15 },
      { header: 'Phường/Xã', key: 'ward', width: 15 },
      { header: 'Loại KH', key: 'customer_type', width: 12 },
      { header: 'Nguồn', key: 'source', width: 15 },
      { header: 'Tiềm năng', key: 'potential_level', width: 12 },
      { header: 'Trạng thái', key: 'status', width: 18 },
      { header: 'Sale phụ trách', key: 'sale_name', width: 20 },
      { header: 'Khu vực', key: 'area_name', width: 20 },
      { header: 'Ghi chú', key: 'note', width: 30 },
      { header: 'Ngày tạo', key: 'created_at', width: 18 },
    ];
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D9488' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    rows.forEach(row => sheet.addRow(row));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=customers.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const { search, sale_id, area_id, status, customer_type, potential_level } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { where: accessWhere, params: accessParams } = await buildCustomerQuery(req.user);

    const conditions = [accessWhere];
    const params = [...accessParams];

    if (search) { conditions.push('(c.customer_name LIKE ? OR c.phone LIKE ? OR c.address LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (sale_id && req.user.role !== 'Sale' && req.user.role !== 'Telesale') { conditions.push('c.assigned_sale_id = ?'); params.push(sale_id); }
    if (area_id) { conditions.push('c.area_id = ?'); params.push(area_id); }
    if (status) { conditions.push('c.status = ?'); params.push(status); }
    if (customer_type) { conditions.push('c.customer_type = ?'); params.push(customer_type); }
    if (potential_level) { conditions.push('c.potential_level = ?'); params.push(potential_level); }

    const where = conditions.join(' AND ');
    const offset = (page - 1) * limit;

    const countRow = await db.get(`SELECT COUNT(*) as count FROM customers c WHERE ${where}`, params);
    const rows = await db.all(`SELECT c.*, u.full_name as sale_name, a.area_name
      FROM customers c LEFT JOIN users u ON c.assigned_sale_id = u.user_id LEFT JOIN areas a ON c.area_id = a.area_id
      WHERE ${where} ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);

    res.json({ data: rows, pagination: { total: countRow.count, page, limit, totalPages: Math.ceil(countRow.count / limit) } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const customer = await db.get(`SELECT c.*, u.full_name as sale_name, a.area_name
      FROM customers c LEFT JOIN users u ON c.assigned_sale_id = u.user_id LEFT JOIN areas a ON c.area_id = a.area_id
      WHERE c.customer_id = ?`, [req.params.id]);
    if (!customer) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    if ((req.user.role === 'Sale' || req.user.role === 'Telesale') && customer.assigned_sale_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Bạn không có quyền xem khách hàng này' });
    }
    const calls = await db.all(`SELECT 'call' as type, call_id as id, call_date as date, call_time as time,
      call_result as title, call_content as content, created_at FROM call_logs WHERE customer_id = ? ORDER BY call_date DESC, call_time DESC LIMIT 20`, [req.params.id]);
    const followups = await db.all(`SELECT 'followup' as type, followup_id as id, follow_up_date as date, null as time,
      follow_up_type as title, content, status, created_at FROM follow_ups WHERE customer_id = ? ORDER BY follow_up_date DESC LIMIT 20`, [req.params.id]);
    const opps = await db.all(`SELECT 'opportunity' as type, opportunity_id as id, created_at as date, null as time,
      stage as title, note as content, estimated_value, created_at FROM opportunities WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10`, [req.params.id]);
    const timeline = [...calls, ...followups, ...opps].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ ...customer, timeline });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', authenticate, async (req, res) => {
  try {
    const { customer_name, phone, zalo, address, province, district, ward, customer_type, source, potential_level, status, assigned_sale_id, area_id, note } = req.body;
    if (!customer_name || !phone) return res.status(400).json({ message: 'Tên và số điện thoại là bắt buộc' });
    const db = await getDb();
    const phoneExists = await db.get('SELECT customer_id FROM customers WHERE phone = ?', [phone]);
    if (phoneExists) return res.status(400).json({ message: 'Số điện thoại đã tồn tại trong hệ thống' });
    const saleId = (req.user.role === 'Sale' || req.user.role === 'Telesale') ? req.user.user_id : (assigned_sale_id || req.user.user_id);
    const areaId = area_id || req.user.area_id;
    const countRow = await db.get('SELECT COUNT(*) as c FROM customers');
    const customer_code = `KH${String(countRow.c + 1).padStart(4, '0')}`;
    const result = await db.run(
      'INSERT INTO customers (customer_code,customer_name,phone,zalo,address,province,district,ward,customer_type,source,potential_level,status,assigned_sale_id,area_id,note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [customer_code, customer_name, phone, zalo || null, address || null, province || null, district || null, ward || null, customer_type || null, source || null, potential_level || null, status || 'Khách mới', saleId, areaId || null, note || null]
    );
    await logAudit(req.user.user_id, 'CREATE', 'customer', result.lastID, null, req.body);
    res.status(201).json({ message: 'Thêm khách hàng thành công', customer_id: result.lastID, customer_code });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', authenticate, async (req, res) => {
  try {
    const db = await getDb();
    const old = await db.get('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    if (!old) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    if ((req.user.role === 'Sale' || req.user.role === 'Telesale') && old.assigned_sale_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa khách hàng này' });
    }
    const { customer_name, phone, zalo, address, province, district, ward, customer_type, source, potential_level, status, assigned_sale_id, area_id, note } = req.body;
    if (phone && phone !== old.phone) {
      const exists = await db.get('SELECT customer_id FROM customers WHERE phone = ? AND customer_id != ?', [phone, req.params.id]);
      if (exists) return res.status(400).json({ message: 'Số điện thoại đã tồn tại' });
    }
    const newSaleId = (req.user.role === 'Admin' || req.user.role === 'Manager') ? (assigned_sale_id ?? old.assigned_sale_id) : old.assigned_sale_id;
    const newAreaId = req.user.role === 'Admin' ? (area_id ?? old.area_id) : old.area_id;
    await db.run(`UPDATE customers SET customer_name=?,phone=?,zalo=?,address=?,province=?,district=?,ward=?,customer_type=?,
      source=?,potential_level=?,status=?,assigned_sale_id=?,area_id=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE customer_id=?`,
      [customer_name || old.customer_name, phone || old.phone, zalo ?? old.zalo, address ?? old.address,
       province ?? old.province, district ?? old.district, ward ?? old.ward, customer_type ?? old.customer_type,
       source ?? old.source, potential_level ?? old.potential_level, status ?? old.status, newSaleId, newAreaId,
       note ?? old.note, req.params.id]);
    await logAudit(req.user.user_id, 'UPDATE', 'customer', req.params.id, old, req.body);
    res.json({ message: 'Cập nhật khách hàng thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', authenticate, authorize('Admin', 'Manager'), async (req, res) => {
  try {
    const db = await getDb();
    const old = await db.get('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
    if (!old) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    await db.run('DELETE FROM customers WHERE customer_id = ?', [req.params.id]);
    await logAudit(req.user.user_id, 'DELETE', 'customer', req.params.id, old, null);
    res.json({ message: 'Xóa khách hàng thành công' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Import Excel
router.post('/import/excel', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng upload file Excel' });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const sheet = workbook.worksheets[0];
    const db = await getDb();
    const results = { success: 0, errors: [] };
    const saleId = req.user.user_id;
    const areaId = req.user.area_id;
    const countRow = await db.get('SELECT COUNT(*) as c FROM customers');
    let counter = countRow.c + 1;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const [, customer_name, phone, zalo, address, province, district, ward, customer_type, source, potential_level, note] = row.values;
      if (!customer_name || !phone) { results.errors.push({ row: rowNumber, error: 'Thiếu tên hoặc SĐT' }); return; }
      const phoneStr = String(phone).trim();
      // Note: async inside eachRow won't work well, collect sync
      results._rows = results._rows || [];
      results._rows.push({ customer_name: String(customer_name).trim(), phone: phoneStr, zalo: zalo ? String(zalo).trim() : null, address: address ? String(address).trim() : null, province: province ? String(province).trim() : null, district: district ? String(district).trim() : null, ward: ward ? String(ward).trim() : null, customer_type: customer_type ? String(customer_type).trim() : null, source: source ? String(source).trim() : null, potential_level: potential_level ? String(potential_level).trim() : null, note: note ? String(note).trim() : null, rowNumber });
    });
    for (const row of (results._rows || [])) {
      const exists = await db.get('SELECT customer_id FROM customers WHERE phone = ?', [row.phone]);
      if (exists) { results.errors.push({ row: row.rowNumber, error: `SĐT ${row.phone} đã tồn tại` }); continue; }
      try {
        const customer_code = `KH${String(counter).padStart(4, '0')}`;
        await db.run('INSERT INTO customers (customer_code,customer_name,phone,zalo,address,province,district,ward,customer_type,source,potential_level,assigned_sale_id,area_id,note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [customer_code, row.customer_name, row.phone, row.zalo, row.address, row.province, row.district, row.ward, row.customer_type, row.source, row.potential_level, saleId, areaId, row.note]);
        counter++; results.success++;
      } catch (err) { results.errors.push({ row: row.rowNumber, error: err.message }); }
    }
    delete results._rows;
    res.json({ message: `Import hoàn tất: ${results.success} thành công, ${results.errors.length} lỗi`, ...results });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
