require('dotenv').config();
const { getDb } = require('../src/config/database');

async function run() {
  const db = await getDb();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS areas (
      area_id INTEGER PRIMARY KEY AUTOINCREMENT,
      area_name TEXT NOT NULL,
      province TEXT,
      district TEXT,
      manager_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('Admin','Manager','Sale','Telesale')),
      area_id INTEGER REFERENCES areas(area_id),
      status TEXT DEFAULT 'Active' CHECK(status IN ('Active','Inactive')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_code TEXT UNIQUE,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      zalo TEXT,
      address TEXT,
      province TEXT,
      district TEXT,
      ward TEXT,
      customer_type TEXT,
      source TEXT,
      potential_level TEXT,
      status TEXT DEFAULT 'Khách mới',
      assigned_sale_id INTEGER REFERENCES users(user_id),
      area_id INTEGER REFERENCES areas(area_id),
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS call_logs (
      call_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
      sale_id INTEGER NOT NULL REFERENCES users(user_id),
      call_date DATE NOT NULL,
      call_time TIME,
      call_result TEXT,
      call_content TEXT,
      customer_need TEXT,
      interest_level TEXT,
      next_action TEXT,
      follow_up_date DATE,
      status_after_call TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS follow_ups (
      followup_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
      sale_id INTEGER NOT NULL REFERENCES users(user_id),
      follow_up_date DATE NOT NULL,
      follow_up_type TEXT,
      content TEXT,
      status TEXT DEFAULT 'Chưa xử lý',
      result_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS opportunities (
      opportunity_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
      sale_id INTEGER NOT NULL REFERENCES users(user_id),
      stage TEXT DEFAULT 'Lead mới',
      estimated_value REAL DEFAULT 0,
      expected_close_date DATE,
      probability INTEGER DEFAULT 0,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(user_id),
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      old_data TEXT,
      new_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_sale ON customers(assigned_sale_id);
    CREATE INDEX IF NOT EXISTS idx_call_logs_customer ON call_logs(customer_id);
    CREATE INDEX IF NOT EXISTS idx_call_logs_sale ON call_logs(sale_id);
    CREATE INDEX IF NOT EXISTS idx_follow_ups_date ON follow_ups(follow_up_date);
    CREATE INDEX IF NOT EXISTS idx_follow_ups_sale ON follow_ups(sale_id);
  `);

  console.log('✅ Migration completed successfully');
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
} else {
  module.exports = run();
}
