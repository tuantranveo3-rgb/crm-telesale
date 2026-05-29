require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getDb } = require('../src/config/database');

async function seed() {
  const db = await getDb();

  // Run migration
  const { getDb: _getDb } = require('../src/config/database');
  const _db = await _getDb();
  await _db.exec(`
    CREATE TABLE IF NOT EXISTS areas (area_id INTEGER PRIMARY KEY AUTOINCREMENT, area_name TEXT NOT NULL, province TEXT, district TEXT, manager_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT, password_hash TEXT NOT NULL, role TEXT NOT NULL, area_id INTEGER REFERENCES areas(area_id), status TEXT DEFAULT 'Active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS customers (customer_id INTEGER PRIMARY KEY AUTOINCREMENT, customer_code TEXT UNIQUE, customer_name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, zalo TEXT, address TEXT, province TEXT, district TEXT, ward TEXT, customer_type TEXT, source TEXT, potential_level TEXT, status TEXT DEFAULT 'Khách mới', assigned_sale_id INTEGER REFERENCES users(user_id), area_id INTEGER REFERENCES areas(area_id), note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS call_logs (call_id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE, sale_id INTEGER NOT NULL REFERENCES users(user_id), call_date DATE NOT NULL, call_time TIME, call_result TEXT, call_content TEXT, customer_need TEXT, interest_level TEXT, next_action TEXT, follow_up_date DATE, status_after_call TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS follow_ups (followup_id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE, sale_id INTEGER NOT NULL REFERENCES users(user_id), follow_up_date DATE NOT NULL, follow_up_type TEXT, content TEXT, status TEXT DEFAULT 'Chưa xử lý', result_note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS opportunities (opportunity_id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE, sale_id INTEGER NOT NULL REFERENCES users(user_id), stage TEXT DEFAULT 'Lead mới', estimated_value REAL DEFAULT 0, expected_close_date DATE, probability INTEGER DEFAULT 0, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS audit_logs (audit_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(user_id), action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER, old_data TEXT, new_data TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `);
  console.log('✅ Migration completed successfully');

  // Clear tables
  await db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM opportunities;
    DELETE FROM follow_ups;
    DELETE FROM call_logs;
    DELETE FROM customers;
    DELETE FROM users;
    DELETE FROM areas;
  `);

  const hash = bcrypt.hashSync('123456', 10);

  // Areas
  const a1 = await db.run('INSERT INTO areas (area_name, province, district) VALUES (?,?,?)', ['Khu vực HCM', 'TP. Hồ Chí Minh', 'Quận 1, 3, 5']);
  const a2 = await db.run('INSERT INTO areas (area_name, province, district) VALUES (?,?,?)', ['Khu vực Hà Nội', 'Hà Nội', 'Hoàn Kiếm, Ba Đình']);
  const a3 = await db.run('INSERT INTO areas (area_name, province, district) VALUES (?,?,?)', ['Khu vực Miền Trung', 'Đà Nẵng', 'Hải Châu, Thanh Khê']);

  // Users
  const admin = await db.run('INSERT INTO users (full_name, email, phone, password_hash, role, area_id, status) VALUES (?,?,?,?,?,?,?)', ['Admin Hệ Thống', 'admin@crm.com', '0900000001', hash, 'Admin', null, 'Active']);
  const mgr1  = await db.run('INSERT INTO users (full_name, email, phone, password_hash, role, area_id, status) VALUES (?,?,?,?,?,?,?)', ['Nguyễn Văn Manager', 'manager1@crm.com', '0900000002', hash, 'Manager', a1.lastID, 'Active']);
  const mgr2  = await db.run('INSERT INTO users (full_name, email, phone, password_hash, role, area_id, status) VALUES (?,?,?,?,?,?,?)', ['Trần Thị Manager', 'manager2@crm.com', '0900000003', hash, 'Manager', a2.lastID, 'Active']);
  const s1    = await db.run('INSERT INTO users (full_name, email, phone, password_hash, role, area_id, status) VALUES (?,?,?,?,?,?,?)', ['Lê Văn Sale', 'sale1@crm.com', '0901000001', hash, 'Sale', a1.lastID, 'Active']);
  const s2    = await db.run('INSERT INTO users (full_name, email, phone, password_hash, role, area_id, status) VALUES (?,?,?,?,?,?,?)', ['Phạm Thị Lan', 'sale2@crm.com', '0901000002', hash, 'Sale', a1.lastID, 'Active']);
  const s3    = await db.run('INSERT INTO users (full_name, email, phone, password_hash, role, area_id, status) VALUES (?,?,?,?,?,?,?)', ['Hoàng Minh Tuấn', 'sale3@crm.com', '0901000003', hash, 'Telesale', a2.lastID, 'Active']);
  const s4    = await db.run('INSERT INTO users (full_name, email, phone, password_hash, role, area_id, status) VALUES (?,?,?,?,?,?,?)', ['Nguyễn Thị Hoa', 'sale4@crm.com', '0901000004', hash, 'Telesale', a3.lastID, 'Active']);

  await db.run('UPDATE areas SET manager_id = ? WHERE area_id = ?', [mgr1.lastID, a1.lastID]);
  await db.run('UPDATE areas SET manager_id = ? WHERE area_id = ?', [mgr2.lastID, a2.lastID]);

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const customers = [
    ['KH001', 'Tiệm Nail Thanh Hương', '0912345001', '0912345001', '123 Nguyễn Trãi', 'TP. Hồ Chí Minh', 'Quận 1', 'Phường Bến Nghé', 'Tiệm nail', 'Telesales', 'Cao', 'Đang chăm sóc', s1.lastID, a1.lastID, 'Khách quan tâm gel'],
    ['KH002', 'Spa Lan Anh', '0912345002', '0912345002', '45 Lê Lợi', 'TP. Hồ Chí Minh', 'Quận 1', 'Phường Bến Thành', 'Spa', 'Facebook', 'Cao', 'Đã mua', s1.lastID, a1.lastID, 'Mua thường xuyên'],
    ['KH003', 'Salon Tóc Minh', '0912345003', null, '78 Trần Hưng Đạo', 'TP. Hồ Chí Minh', 'Quận 5', 'Phường 1', 'Salon', 'Đi thị trường', 'Trung bình', 'Đã liên hệ', s2.lastID, a1.lastID, null],
    ['KH004', 'Đại Lý Mỹ Phẩm Hùng', '0912345004', '0912345004', '234 Hai Bà Trưng', 'Hà Nội', 'Hoàn Kiếm', 'Phường Trần Hưng Đạo', 'Đại lý', 'DMS', 'Cao', 'Đang chăm sóc', s3.lastID, a2.lastID, 'Đại lý lớn tại HN'],
    ['KH005', 'Tiệm Nail Bảo Trân', '0912345005', '0912345005', '56 Kim Mã', 'Hà Nội', 'Ba Đình', 'Phường Ngọc Khánh', 'Tiệm nail', 'Zalo', 'Trung bình', 'Khách mới', s3.lastID, a2.lastID, null],
    ['KH006', 'Spa Ngọc Ánh', '0912345006', null, '90 Trần Phú', 'Đà Nẵng', 'Hải Châu', 'Phường Hải Châu 1', 'Spa', 'Giới thiệu', 'Thấp', 'Không tiềm năng', s4.lastID, a3.lastID, 'Giá cao'],
    ['KH007', 'Nguyễn Thị C2', '0912345007', '0912345007', '12 Lý Tự Trọng', 'TP. Hồ Chí Minh', 'Quận 3', 'Phường 1', 'C2', 'Facebook', 'Cao', 'Đang chăm sóc', s1.lastID, a1.lastID, null],
    ['KH008', 'Salon Beauty House', '0912345008', '0912345008', '67 Pasteur', 'TP. Hồ Chí Minh', 'Quận 3', 'Phường 6', 'Salon', 'Telesales', 'Trung bình', 'Đã liên hệ', s2.lastID, a1.lastID, null],
    ['KH009', 'Tiệm Nail Kim Anh', '0912345009', null, '34 Đinh Tiên Hoàng', 'Hà Nội', 'Hoàn Kiếm', 'Phường Tràng Tiền', 'Tiệm nail', 'Khác', 'Thấp', 'Ngưng mua', s3.lastID, a2.lastID, 'Ngưng 3 tháng'],
    ['KH010', 'Cty TNHH Mỹ Phẩm Việt', '0912345010', '0912345010', '100 Nguyễn Văn Linh', 'TP. Hồ Chí Minh', 'Quận 7', 'Phường Tân Phú', 'C1', 'DMS', 'Cao', 'Đã mua', s1.lastID, a1.lastID, 'KH VIP'],
  ];

  const custIds = [];
  for (const c of customers) {
    const r = await db.run(
      'INSERT INTO customers (customer_code,customer_name,phone,zalo,address,province,district,ward,customer_type,source,potential_level,status,assigned_sale_id,area_id,note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      c
    );
    custIds.push(r.lastID);
  }

  // Call logs
  const callRows = [
    [custIds[0], s1.lastID, today, '09:00', 'Quan tâm', 'Hỏi về gel màu dòng mới', 'Gel màu bền', 'Cao', 'Gửi báo giá', tomorrow, 'Đang chăm sóc'],
    [custIds[0], s1.lastID, yesterday, '14:30', 'Nghe máy', 'Giới thiệu sản phẩm mới', 'Muốn thử mẫu', 'Trung bình', 'Gửi mẫu', today, 'Đã liên hệ'],
    [custIds[1], s1.lastID, today, '10:00', 'Chốt đơn', 'Xác nhận đơn tháng này', null, 'Cao', 'Chốt đơn', null, 'Đã mua'],
    [custIds[2], s2.lastID, yesterday, '11:00', 'Không nghe', null, null, null, 'Gọi lại', today, 'Đã liên hệ'],
    [custIds[3], s3.lastID, today, '08:30', 'Quan tâm', 'Hỏi chiết khấu đại lý', 'Chiết khấu tốt', 'Cao', 'Gửi báo giá', tomorrow, 'Đang chăm sóc'],
    [custIds[4], s3.lastID, twoDaysAgo, '15:00', 'Máy bận', null, null, null, 'Gọi lại', yesterday, 'Khách mới'],
    [custIds[6], s1.lastID, today, '09:30', 'Hẹn gọi lại', 'Hẹn gọi chiều', 'Tìm hiểu thêm', 'Trung bình', 'Gọi lại', tomorrow, 'Đang chăm sóc'],
    [custIds[9], s1.lastID, today, '11:30', 'Nghe máy', 'Tư vấn sản phẩm mới', 'Muốn xem catalog', 'Cao', 'Gửi báo giá', tomorrow, 'Đang chăm sóc'],
  ];
  for (const r of callRows) {
    await db.run('INSERT INTO call_logs (customer_id,sale_id,call_date,call_time,call_result,call_content,customer_need,interest_level,next_action,follow_up_date,status_after_call) VALUES (?,?,?,?,?,?,?,?,?,?,?)', r);
  }

  // Follow-ups
  const fuRows = [
    [custIds[0], s1.lastID, today, 'Gọi điện', 'Gửi mẫu gel và follow', 'Chưa xử lý'],
    [custIds[0], s1.lastID, tomorrow, 'Gửi báo giá', 'Gửi báo giá dòng gel mới', 'Chưa xử lý'],
    [custIds[2], s2.lastID, today, 'Gọi điện', 'Gọi lại lần 2', 'Chưa xử lý'],
    [custIds[3], s3.lastID, tomorrow, 'Gửi báo giá', 'Gửi báo giá chiết khấu', 'Chưa xử lý'],
    [custIds[4], s3.lastID, yesterday, 'Gọi điện', 'Gọi lại sau bận máy', 'Quá hạn'],
    [custIds[6], s1.lastID, today, 'Gọi điện', 'Gọi chiều theo hẹn', 'Chưa xử lý'],
    [custIds[9], s1.lastID, tomorrow, 'Gửi báo giá', 'Gửi catalog và báo giá VIP', 'Chưa xử lý'],
    [custIds[1], s1.lastID, twoDaysAgo, 'Nhắn Zalo', 'Hỏi feedback đơn hàng', 'Đã xử lý'],
  ];
  for (const r of fuRows) {
    await db.run('INSERT INTO follow_ups (customer_id,sale_id,follow_up_date,follow_up_type,content,status) VALUES (?,?,?,?,?,?)', r);
  }

  // Opportunities
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const in3 = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0];
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  const in10 = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
  const oppRows = [
    [custIds[0], s1.lastID, 'Gửi báo giá', 5000000, tomorrow, 60, 'Quan tâm gel màu'],
    [custIds[1], s1.lastID, 'Chốt đơn', 15000000, today, 90, 'Đơn tháng định kỳ'],
    [custIds[3], s3.lastID, 'Đang đàm phán', 30000000, tomorrow, 70, 'Đại lý cấp 1'],
    [custIds[6], s1.lastID, 'Quan tâm', 8000000, in7, 40, null],
    [custIds[9], s1.lastID, 'Gửi báo giá', 20000000, in3, 75, 'KH VIP'],
    [custIds[4], s3.lastID, 'Lead mới', 3000000, in14, 20, null],
    [custIds[7], s2.lastID, 'Đã liên hệ', 6000000, in10, 30, null],
    [custIds[2], s2.lastID, 'Mất cơ hội', 4000000, yesterday, 0, 'Khách từ chối'],
  ];
  for (const r of oppRows) {
    await db.run('INSERT INTO opportunities (customer_id,sale_id,stage,estimated_value,expected_close_date,probability,note) VALUES (?,?,?,?,?,?,?)', r);
  }

  console.log('✅ Seed data inserted successfully');
  console.log('\n📋 Test accounts (password: 123456):');
  console.log('  Admin:    admin@crm.com');
  console.log('  Manager:  manager1@crm.com');
  console.log('  Sale:     sale1@crm.com');
  console.log('  Telesale: sale3@crm.com');
}

// Run directly: node seeds/seed.js
// Or import as module: require('./seeds/seed')
if (require.main === module) {
  seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else {
  module.exports = seed;
}
