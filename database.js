// database.js
// Database SQLite sederhana untuk menyimpan warning member.
// File .sqlite akan dibuat otomatis di folder yang sama.

const Database = require('better-sqlite3');
const db = new Database('bot.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    userId TEXT NOT NULL,
    moderatorId TEXT NOT NULL,
    reason TEXT,
    timestamp INTEGER NOT NULL
  )
`);

function addWarning(guildId, userId, moderatorId, reason) {
  const stmt = db.prepare(
    `INSERT INTO warnings (guildId, userId, moderatorId, reason, timestamp) VALUES (?, ?, ?, ?, ?)`
  );
  stmt.run(guildId, userId, moderatorId, reason, Date.now());
}

function getWarnings(guildId, userId) {
  const stmt = db.prepare(
    `SELECT * FROM warnings WHERE guildId = ? AND userId = ? ORDER BY timestamp DESC`
  );
  return stmt.all(guildId, userId);
}

function clearWarnings(guildId, userId) {
  const stmt = db.prepare(`DELETE FROM warnings WHERE guildId = ? AND userId = ?`);
  stmt.run(guildId, userId);
}

module.exports = { addWarning, getWarnings, clearWarnings };
