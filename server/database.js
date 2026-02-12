/**
 * StreamForge — SQLite Database Module
 *
 * Initializes and manages the SQLite database using better-sqlite3.
 * Stores configuration, alert settings, and other persistent data.
 *
 * Database location (OS-appropriate app data directory):
 *   - Windows: %APPDATA%/streamforge/streamforge.db
 *   - macOS:   ~/Library/Application Support/streamforge/streamforge.db
 *   - Linux:   ~/.config/streamforge/streamforge.db
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// Database Path Resolution
// ---------------------------------------------------------------------------

/**
 * Get the OS-appropriate app data directory for StreamForge.
 * @returns {string} Absolute path to the streamforge data directory
 */
function getAppDataDir() {
  const platform = process.platform;

  let baseDir;
  if (platform === 'win32') {
    baseDir = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming');
  } else if (platform === 'darwin') {
    baseDir = path.join(require('os').homedir(), 'Library', 'Application Support');
  } else {
    // Linux and other Unix-like systems
    baseDir = process.env.XDG_CONFIG_HOME || path.join(require('os').homedir(), '.config');
  }

  return path.join(baseDir, 'streamforge');
}

/**
 * Get the full path to the database file.
 * @returns {string} Absolute path to streamforge.db
 */
function getDbPath() {
  return path.join(getAppDataDir(), 'streamforge.db');
}

// ---------------------------------------------------------------------------
// Database Initialization
// ---------------------------------------------------------------------------

/** @type {import('better-sqlite3').Database | null} */
let db = null;

/**
 * Initialize the SQLite database.
 * Creates the data directory and database file if they don't exist,
 * enables WAL mode for better performance, and creates initial tables.
 *
 * @returns {import('better-sqlite3').Database} The database instance
 */
function initDatabase() {
  const dbDir = getAppDataDir();
  const dbPath = getDbPath();

  // Create the data directory if it doesn't exist
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`[Database] Created data directory: ${dbDir}`);
  }

  // Open (or create) the database
  db = new Database(dbPath);
  console.log(`[Database] Opened database: ${dbPath}`);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  // Create tables
  createTables();

  // Seed default data if tables are empty
  seedDefaults();

  return db;
}

/**
 * Create the initial database schema.
 * Uses IF NOT EXISTS so this is safe to run on every startup.
 */
function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      message_template TEXT,
      duration_ms INTEGER DEFAULT 5000,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('[Database] Tables verified (settings, alerts)');
}

/**
 * Seed default data when the database is first created.
 * Only inserts if the alerts table is empty.
 */
function seedDefaults() {
  const count = db.prepare('SELECT COUNT(*) as count FROM alerts').get();

  if (count.count === 0) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO alerts (id, type, name, enabled, message_template, duration_ms, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      'follow',
      'New Follower',
      1,
      'Thanks for following, {username}!',
      5000,
      now,
      now
    );

    console.log('[Database] Seeded default alert configuration');
  }
}

// ---------------------------------------------------------------------------
// Settings Helper Functions
// ---------------------------------------------------------------------------

/**
 * Get a setting value by key.
 * @param {string} key - The setting key
 * @returns {string|null} The setting value, or null if not found
 */
function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

/**
 * Set (insert or update) a setting value.
 * @param {string} key - The setting key
 * @param {string} value - The setting value
 */
function setSetting(key, value) {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(key, value, now);
}

// ---------------------------------------------------------------------------
// Alerts Helper Functions
// ---------------------------------------------------------------------------

/**
 * Get all alert configurations.
 * @returns {object[]} Array of alert objects
 */
function getAllAlerts() {
  return db.prepare('SELECT * FROM alerts ORDER BY created_at ASC').all();
}

/**
 * Get a single alert by ID.
 * @param {string} id - The alert UUID
 * @returns {object|null} The alert object, or null if not found
 */
function getAlertById(id) {
  return db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) || null;
}

/**
 * Create a new alert configuration.
 * @param {object} alertData - Alert properties
 * @param {string} alertData.type - Alert type (follow, subscribe, cheer, raid, donation, custom)
 * @param {string} alertData.name - Display name
 * @param {number} [alertData.enabled=1] - Whether the alert is enabled
 * @param {string} [alertData.message_template] - Message template with {variables}
 * @param {number} [alertData.duration_ms=5000] - Display duration in milliseconds
 * @returns {object} The created alert object
 */
function createAlert(alertData) {
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO alerts (id, type, name, enabled, message_template, duration_ms, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    alertData.type,
    alertData.name,
    alertData.enabled !== undefined ? alertData.enabled : 1,
    alertData.message_template || null,
    alertData.duration_ms || 5000,
    now,
    now
  );

  return getAlertById(id);
}

/**
 * Update an existing alert configuration.
 * Only updates fields that are provided in alertData.
 * @param {string} id - The alert UUID
 * @param {object} alertData - Fields to update
 * @returns {object|null} The updated alert object, or null if not found
 */
function updateAlert(id, alertData) {
  const existing = getAlertById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated = {
    type: alertData.type !== undefined ? alertData.type : existing.type,
    name: alertData.name !== undefined ? alertData.name : existing.name,
    enabled: alertData.enabled !== undefined ? alertData.enabled : existing.enabled,
    message_template: alertData.message_template !== undefined ? alertData.message_template : existing.message_template,
    duration_ms: alertData.duration_ms !== undefined ? alertData.duration_ms : existing.duration_ms,
  };

  db.prepare(`
    UPDATE alerts
    SET type = ?, name = ?, enabled = ?, message_template = ?, duration_ms = ?, updated_at = ?
    WHERE id = ?
  `).run(
    updated.type,
    updated.name,
    updated.enabled,
    updated.message_template,
    updated.duration_ms,
    now,
    id
  );

  return getAlertById(id);
}

/**
 * Delete an alert configuration.
 * @param {string} id - The alert UUID
 * @returns {boolean} True if the alert was deleted, false if not found
 */
function deleteAlert(id) {
  const result = db.prepare('DELETE FROM alerts WHERE id = ?').run(id);
  return result.changes > 0;
}

// ---------------------------------------------------------------------------
// Database Access
// ---------------------------------------------------------------------------

/**
 * Get the raw database instance for advanced queries.
 * @returns {import('better-sqlite3').Database}
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection gracefully.
 */
function closeDatabase() {
  if (db) {
    db.close();
    console.log('[Database] Connection closed');
    db = null;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  initDatabase,
  closeDatabase,
  getDb,
  getDbPath,
  getAppDataDir,

  // Settings
  getSetting,
  setSetting,

  // Alerts
  getAllAlerts,
  getAlertById,
  createAlert,
  updateAlert,
  deleteAlert,
};
