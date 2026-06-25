const path = require('path');

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

let dbInstance = null;

function rowToObject(columns, row) {
  if (!columns || !row) return row;
  const obj = {};
  columns.forEach((col, i) => { obj[col] = row[i]; });
  return obj;
}

function createLibsqlAdapter(client) {
  return {
    async get(sql, params = []) {
      const result = await client.execute({ sql, args: params });
      if (!result.rows || result.rows.length === 0) return undefined;
      return rowToObject(result.columns, result.rows[0]);
    },
    async all(sql, params = []) {
      const result = await client.execute({ sql, args: params });
      return (result.rows || []).map(row => rowToObject(result.columns, row));
    },
    async run(sql, params = []) {
      const result = await client.execute({ sql, args: params });
      return {
        lastID: result.lastInsertRowid != null ? Number(result.lastInsertRowid) : undefined,
        changes: result.rowsAffected || 0,
      };
    },
    async exec(sql) {
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .map(s => ({ sql: s, args: [] }));
      if (statements.length > 0) {
        await client.batch(statements, 'write');
      }
    },
  };
}

async function getDb() {
  if (dbInstance) return dbInstance;

  if (TURSO_URL) {
    const { createClient } = require('@libsql/client');
    const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
    dbInstance = createLibsqlAdapter(client);
    console.log('🌐 Connected to Turso cloud database');
  } else {
    const sqlite3 = require('sqlite3');
    const { open } = require('sqlite');
    const DB_PATH = process.env.DB_PATH
      ? path.resolve(process.env.DB_PATH)
      : path.join(__dirname, '../../crm.db');
    const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
    await db.run('PRAGMA foreign_keys = ON');
    await db.run('PRAGMA journal_mode = WAL');
    dbInstance = db;
    console.log(`📁 Using local SQLite: ${DB_PATH}`);
  }

  return dbInstance;
}

module.exports = { getDb };
