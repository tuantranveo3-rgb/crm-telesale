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

    // Migration: add new columns to call_logs if not exist
    try { await db.run('ALTER TABLE call_logs ADD COLUMN call_method TEXT'); } catch {}
    try { await db.run("ALTER TABLE call_logs ADD COLUMN call_status TEXT DEFAULT 'Kết thúc'"); } catch {}

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
