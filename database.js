// database.js — semua data permanen NedeerVilleBOT disimpan di sini (SQLite)
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
  );

  CREATE TABLE IF NOT EXISTS levels (
    guildId TEXT NOT NULL,
    userId TEXT NOT NULL,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 0,
    lastMessage INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guildId, userId)
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guildId TEXT NOT NULL,
    channelId TEXT NOT NULL,
    messageId TEXT NOT NULL,
    prize TEXT NOT NULL,
    winnerCount INTEGER NOT NULL,
    endTime INTEGER NOT NULL,
    ended INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS starboard (
    guildId TEXT NOT NULL,
    originalMessageId TEXT NOT NULL,
    starboardMessageId TEXT NOT NULL,
    PRIMARY KEY (guildId, originalMessageId)
  );

  CREATE TABLE IF NOT EXISTS settings (
    guildId TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    PRIMARY KEY (guildId, key)
  );
`);

// ---- Warnings ----
function addWarning(guildId, userId, moderatorId, reason) {
  db.prepare(
    `INSERT INTO warnings (guildId, userId, moderatorId, reason, timestamp) VALUES (?, ?, ?, ?, ?)`
  ).run(guildId, userId, moderatorId, reason, Date.now());
}
function getWarnings(guildId, userId) {
  return db
    .prepare(`SELECT * FROM warnings WHERE guildId = ? AND userId = ? ORDER BY timestamp DESC`)
    .all(guildId, userId);
}
function clearWarnings(guildId, userId) {
  db.prepare(`DELETE FROM warnings WHERE guildId = ? AND userId = ?`).run(guildId, userId);
}

// ---- Leveling ----
function getLevel(guildId, userId) {
  const row = db
    .prepare(`SELECT * FROM levels WHERE guildId = ? AND userId = ?`)
    .get(guildId, userId);
  return row || { guildId, userId, xp: 0, level: 0, lastMessage: 0 };
}
function addXp(guildId, userId, amount, xpBaseForLevelUp) {
  const current = getLevel(guildId, userId);
  const newXp = current.xp + amount;
  const xpNeeded = xpBaseForLevelUp * (current.level + 1);
  let newLevel = current.level;
  let leveledUp = false;
  if (newXp >= xpNeeded) {
    newLevel += 1;
    leveledUp = true;
  }
  db.prepare(
    `INSERT INTO levels (guildId, userId, xp, level, lastMessage)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(guildId, userId) DO UPDATE SET xp = ?, level = ?, lastMessage = ?`
  ).run(guildId, userId, newXp, newLevel, Date.now(), newXp, newLevel, Date.now());
  return { leveledUp, newLevel, newXp };
}
function getRank(guildId, userId) {
  const all = db
    .prepare(`SELECT userId FROM levels WHERE guildId = ? ORDER BY xp DESC`)
    .all(guildId);
  return all.findIndex((r) => r.userId === userId) + 1;
}

// ---- Giveaways ----
function createGiveaway(guildId, channelId, messageId, prize, winnerCount, endTime) {
  db.prepare(
    `INSERT INTO giveaways (guildId, channelId, messageId, prize, winnerCount, endTime, ended)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).run(guildId, channelId, messageId, prize, winnerCount, endTime);
}
function getActiveGiveaways() {
  return db.prepare(`SELECT * FROM giveaways WHERE ended = 0`).all();
}
function markGiveawayEnded(id) {
  db.prepare(`UPDATE giveaways SET ended = 1 WHERE id = ?`).run(id);
}

// ---- Starboard ----
function getStarboardEntry(guildId, originalMessageId) {
  return db
    .prepare(`SELECT * FROM starboard WHERE guildId = ? AND originalMessageId = ?`)
    .get(guildId, originalMessageId);
}
function addStarboardEntry(guildId, originalMessageId, starboardMessageId) {
  db.prepare(
    `INSERT INTO starboard (guildId, originalMessageId, starboardMessageId) VALUES (?, ?, ?)`
  ).run(guildId, originalMessageId, starboardMessageId);
}

module.exports = {
  addWarning,
  getWarnings,
  clearWarnings,
  getLevel,
  addXp,
  getRank,
  createGiveaway,
  getActiveGiveaways,
  markGiveawayEnded,
  getStarboardEntry,
  addStarboardEntry,
};
