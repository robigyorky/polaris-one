const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'polaris.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrations: add columns if they don't exist (safe to re-run)
const migrations = [
  'ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0',
  'ALTER TABLE users ADD COLUMN locked_until TEXT',
  'ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0',
  'ALTER TABLE users ADD COLUMN verification_token TEXT',
  'ALTER TABLE users ADD COLUMN verification_expires TEXT',
];

for (const sql of migrations) {
  try { db.exec(sql); } catch (e) {
    // Column already exists — ignore
  }
}

module.exports = db;
