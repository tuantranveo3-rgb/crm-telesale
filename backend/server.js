require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:4173',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.some(o => origin.startsWith(o)) || origin.includes('vercel.app') || origin.includes('netlify.app')) {
      cb(null, true);
    } else {
      cb(null, true); // Allow all for demo
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/users', require('./src/routes/users'));
app.use('/api/areas', require('./src/routes/areas'));
app.use('/api/customers', require('./src/routes/customers'));
app.use('/api/call-logs', require('./src/routes/callLogs'));
app.use('/api/follow-ups', require('./src/routes/followUps'));
app.use('/api/pipeline', require('./src/routes/pipeline'));
app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/settings', require('./src/routes/settings'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Auto-seed if DB is empty (for cloud deployment)
  try {
    const { getDb } = require('./src/config/database');
    const db = await getDb();

    // Check if tables exist and have data
    let needsSeed = false;
    try {
      const row = await db.get("SELECT COUNT(*) as c FROM users");
      needsSeed = (row.c === 0);
    } catch {
      needsSeed = true;
    }

    // Migration: add new columns
    try { await db.run('ALTER TABLE call_logs ADD COLUMN call_method TEXT'); } catch {}
    try { await db.run("ALTER TABLE call_logs ADD COLUMN call_status TEXT DEFAULT 'Kết thúc'"); } catch {}
    try { await db.run('ALTER TABLE customers ADD COLUMN sales_channel TEXT'); } catch {}
    try { await db.run('ALTER TABLE customers ADD COLUMN segment TEXT'); } catch {}
    try { await db.run('ALTER TABLE customers ADD COLUMN chain_system TEXT'); } catch {}

    // Migration: create lookup_values table if not exist
    await db.run(`CREATE TABLE IF NOT EXISTS lookup_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      parent_value TEXT,
      value TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed lookup_values nếu chưa có
    const lookupCount = await db.get('SELECT COUNT(*) as c FROM lookup_values');
    if (lookupCount.c === 0) {
      const lookups = [
        // ── Kênh bán hàng ──
        ['sales_channel', null, 'GT', 1],
        ['sales_channel', null, 'MT', 2],
        ['sales_channel', null, 'TMĐT', 3],
        ['sales_channel', null, 'SR', 4],
        ['sales_channel', null, 'B2B', 5],
        // ── Loại KH theo kênh ──
        ['customer_type', 'GT', 'C1', 1], ['customer_type', 'GT', 'C2', 2],
        ['customer_type', 'GT', 'Tiệm nail', 3], ['customer_type', 'GT', 'Spa', 4],
        ['customer_type', 'GT', 'Salon', 5], ['customer_type', 'GT', 'Khách lẻ', 6],
        ['customer_type', 'MT', 'Đại siêu thị', 1], ['customer_type', 'MT', 'Siêu thị', 2],
        ['customer_type', 'MT', 'Cửa hàng tiện lợi', 3], ['customer_type', 'MT', 'Chuỗi bán lẻ', 4],
        ['customer_type', 'TMĐT', 'Shop online', 1], ['customer_type', 'TMĐT', 'Nhà bán hàng', 2],
        ['customer_type', 'SR', 'Nhà thuốc', 1], ['customer_type', 'SR', 'Beauty Store', 2],
        ['customer_type', 'SR', 'Thẩm mỹ viện', 3], ['customer_type', 'SR', 'Phòng khám', 4],
        ['customer_type', 'B2B', 'Nhà sản xuất', 1], ['customer_type', 'B2B', 'Nhà nhập khẩu', 2],
        ['customer_type', 'B2B', 'Doanh nghiệp', 3], ['customer_type', 'B2B', 'Đại lý độc quyền', 4],
        // ── Phân khúc theo kênh ──
        ['segment', 'GT', 'Nhà phân phối', 1], ['segment', 'GT', 'Đại lý', 2], ['segment', 'GT', 'Điểm bán lẻ', 3],
        ['segment', 'MT', 'Hyper', 1], ['segment', 'MT', 'Super', 2], ['segment', 'MT', 'Mini/CVS', 3],
        ['segment', 'TMĐT', 'Shopee', 1], ['segment', 'TMĐT', 'Lazada', 2],
        ['segment', 'TMĐT', 'TikTok Shop', 3], ['segment', 'TMĐT', 'Tiki', 4],
        ['segment', 'SR', 'Pharmacy', 1], ['segment', 'SR', 'Beauty', 2], ['segment', 'SR', 'Clinic/TMV', 3],
        ['segment', 'B2B', 'Manufacturer', 1], ['segment', 'B2B', 'Importer', 2], ['segment', 'B2B', 'Corporate', 3],
        // ── Hệ thống theo kênh ──
        ['chain_system', 'MT', 'WinMart / WinMart+', 1], ['chain_system', 'MT', 'Lotte Mart', 2],
        ['chain_system', 'MT', 'Big C / GO!', 3], ['chain_system', 'MT', 'MM Mega Market', 4],
        ['chain_system', 'MT', 'AEON', 5], ['chain_system', 'MT', 'Co.opmart', 6],
        ['chain_system', 'MT', 'Bách Hoá Xanh', 7], ['chain_system', 'MT', 'Circle K', 8],
        ['chain_system', 'MT', '7-Eleven', 9], ['chain_system', 'MT', 'FamilyMart', 10],
        ['chain_system', 'SR', 'Long Châu', 1], ['chain_system', 'SR', 'Pharmacity', 2],
        ['chain_system', 'SR', 'An Khang', 3], ['chain_system', 'SR', 'Guardian', 4],
        ['chain_system', 'SR', 'Hasaki', 5], ['chain_system', 'SR', 'The Face Shop', 6],
        ['chain_system', 'TMĐT', 'Shopee Mall', 1], ['chain_system', 'TMĐT', 'Lazada Mall', 2],
        ['chain_system', 'B2B', 'Phân phối độc quyền', 1], ['chain_system', 'B2B', 'Hợp đồng khung', 2],
        // ── Hình thức liên hệ (cuộc gọi) ──
        ['call_method', null, 'Gọi điện', 1], ['call_method', null, 'Nhắn Zalo', 2],
        ['call_method', null, 'Gặp trực tiếp', 3], ['call_method', null, 'Gửi báo giá', 4],
        ['call_method', null, 'Email', 5], ['call_method', null, 'Khác', 6],
        // ── Trạng thái xử lý cuộc gọi ──
        ['call_status', null, 'Kết thúc', 1],
        ['call_status', null, 'Chờ phản hồi', 2],
        ['call_status', null, 'Đang tiếp tục', 3],
        // ── Kết quả cuộc gọi ──
        ['call_result', null, 'Nghe máy', 1], ['call_result', null, 'Không nghe', 2],
        ['call_result', null, 'Máy bận', 3], ['call_result', null, 'Hẹn gọi lại', 4],
        ['call_result', null, 'Từ chối', 5], ['call_result', null, 'Quan tâm', 6],
        ['call_result', null, 'Chốt đơn', 7],
        // ── Hành động tiếp theo ──
        ['next_action', null, 'Gửi báo giá', 1], ['next_action', null, 'Gửi mẫu', 2],
        ['next_action', null, 'Hẹn gặp', 3], ['next_action', null, 'Gọi lại', 4],
        ['next_action', null, 'Chốt đơn', 5], ['next_action', null, 'Không xử lý tiếp', 6],
        // ── Hình thức follow-up ──
        ['follow_up_type', null, 'Gọi điện', 1], ['follow_up_type', null, 'Nhắn Zalo', 2],
        ['follow_up_type', null, 'Gặp trực tiếp', 3], ['follow_up_type', null, 'Gửi báo giá', 4],
      ];
      for (const [cat, parent, val, ord] of lookups) {
        await db.run('INSERT INTO lookup_values (category, parent_value, value, sort_order) VALUES (?,?,?,?)', [cat, parent, val, ord]);
      }
      console.log('✅ Lookup values seeded');
    }

    if (needsSeed) {
      console.log('🌱 Database empty — running initial seed...');
      const bcrypt = require('bcryptjs');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS areas (area_id INTEGER PRIMARY KEY AUTOINCREMENT, area_name TEXT NOT NULL, province TEXT, district TEXT, manager_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS users (user_id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, phone TEXT, password_hash TEXT NOT NULL, role TEXT NOT NULL, area_id INTEGER REFERENCES areas(area_id), status TEXT DEFAULT 'Active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS customers (customer_id INTEGER PRIMARY KEY AUTOINCREMENT, customer_code TEXT UNIQUE, customer_name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, zalo TEXT, address TEXT, province TEXT, district TEXT, ward TEXT, customer_type TEXT, source TEXT, potential_level TEXT, status TEXT DEFAULT 'Khách mới', assigned_sale_id INTEGER REFERENCES users(user_id), area_id INTEGER REFERENCES areas(area_id), note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS call_logs (call_id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE, sale_id INTEGER NOT NULL REFERENCES users(user_id), call_date DATE NOT NULL, call_time TIME, call_result TEXT, call_content TEXT, customer_need TEXT, interest_level TEXT, next_action TEXT, follow_up_date DATE, status_after_call TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS follow_ups (followup_id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE, sale_id INTEGER NOT NULL REFERENCES users(user_id), follow_up_date DATE NOT NULL, follow_up_type TEXT, content TEXT, status TEXT DEFAULT 'Chưa xử lý', result_note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS opportunities (opportunity_id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE, sale_id INTEGER NOT NULL REFERENCES users(user_id), stage TEXT DEFAULT 'Lead mới', estimated_value REAL DEFAULT 0, expected_close_date DATE, probability INTEGER DEFAULT 0, note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS audit_logs (audit_id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER REFERENCES users(user_id), action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id INTEGER, old_data TEXT, new_data TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      `);
      // Run seed
      const seed = require('./seeds/seed');
      await seed();
      console.log('✅ Auto-seed completed');
    }
  } catch (err) {
    console.error('Seed warning:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`🚀 CRM Server running on port ${PORT}`);
  });
}

startServer();
