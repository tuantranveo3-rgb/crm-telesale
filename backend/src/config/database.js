const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const DB_PATH = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(__dirname, '../../crm.db');

let dbInstance = null;

async function getDb() {
  if (!dbInstance) {
    dbInstance = await open({ filename: DB_PATH, driver: sqlite3.Database });
    await dbInstance.run('PRAGMA foreign_keys = ON');
    await dbInstance.run('PRAGMA journal_mode = WAL');
  }
  return dbInstance;
}

module.exports = { getDb };
