/**
 * StreamForge — SQLite Database Module
 *
 * Initializes and manages the SQLite database using better-sqlite3.
 * Includes a versioned migration runner that applies SQL files from
 * the /migrations directory on startup.
 *
 * Database location (OS-appropriate app data directory):
 *   - Windows: %APPDATA%/streamforge/streamforge.db
 *   - macOS:   ~/Library/Application Support/streamforge/streamforge.db
 *   - Linux:   ~/.config/streamforge/streamforge.db
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

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
// Project Root Resolution (mirrors index.js strategy)
// ---------------------------------------------------------------------------

/**
 * Resolve the project root directory by walking up from the current location
 * looking for the overlays/ directory. Works in both dev mode and pkg binary.
 * @returns {string} Absolute path to the project root
 */
function findProjectRoot() {
  const isPkg = typeof process.pkg !== 'undefined';
  const startDir = isPkg ? path.dirname(process.execPath) : __dirname;

  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'overlays');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Fallback: assume dev mode layout (database.js is in server/)
  return isPkg
    ? path.join(path.dirname(process.execPath), '..', '..')
    : path.join(__dirname, '..');
}

// ---------------------------------------------------------------------------
// Database Initialization
// ---------------------------------------------------------------------------

/** @type {import('better-sqlite3').Database | null} */
let db = null;

/**
 * Initialize the SQLite database.
 * Creates the data directory and database file if they don't exist,
 * enables WAL mode and foreign keys, and runs pending migrations.
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

  // Open (or create) the database.
  // When running inside a pkg-compiled binary, the native .node addon
  // must be loaded from the filesystem (next to the executable) rather
  // than from pkg's virtual snapshot filesystem.
  const dbOptions = {};
  if (typeof process.pkg !== 'undefined') {
    const addonPath = path.join(path.dirname(process.execPath), 'better_sqlite3.node');
    if (fs.existsSync(addonPath)) {
      dbOptions.nativeBinding = addonPath;
      console.log(`[Database] Using native binding: ${addonPath}`);
    } else {
      console.error(`[Database] Native binding not found at: ${addonPath}`);
      console.error('[Database] Run "node scripts/build-server.js --current" to rebuild the sidecar with native addons.');
    }
  }
  db = new Database(dbPath, dbOptions);
  console.log(`[Database] Opened database: ${dbPath}`);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');

  // Enable foreign key enforcement (required for CASCADE deletes)
  db.pragma('foreign_keys = ON');

  // Run pending migrations
  runMigrations();

  return db;
}

// ---------------------------------------------------------------------------
// Migration Runner
// ---------------------------------------------------------------------------

/**
 * Run all pending SQL migrations from the /migrations directory.
 *
 * The runner tracks applied migrations in a `_migrations` table. On each
 * startup it scans the migrations directory, compares against already-applied
 * migrations, and executes any new ones in alphabetical order inside
 * individual transactions.
 */
function runMigrations() {
  // Create the migrations tracking table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  // Resolve the migrations directory
  const projectRoot = findProjectRoot();
  const migrationsDir = path.join(projectRoot, 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.log('[Database] No migrations directory found, skipping migrations');
    return;
  }

  // Get all .sql files sorted alphabetically
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    console.log('[Database] No migration files found');
    return;
  }

  // Get already-applied migrations
  const applied = new Set(
    db.prepare('SELECT filename FROM _migrations').all().map(row => row.filename)
  );

  // Apply pending migrations
  let appliedCount = 0;
  for (const filename of migrationFiles) {
    if (applied.has(filename)) continue;

    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`[Database] Applying migration: ${filename}`);

    // Run the migration inside a transaction for safety.
    // Note: We temporarily disable foreign keys during migration because
    // ALTER TABLE statements can conflict with FK enforcement in SQLite.
    const applyMigration = db.transaction(() => {
      db.pragma('foreign_keys = OFF');
      db.exec(sql);
      db.pragma('foreign_keys = ON');
      db.prepare(
        'INSERT INTO _migrations (filename, applied_at) VALUES (?, ?)'
      ).run(filename, new Date().toISOString());
    });

    try {
      applyMigration();
      appliedCount++;
      console.log(`[Database] Applied migration: ${filename}`);
    } catch (err) {
      console.error(`[Database] Migration failed: ${filename}`);
      console.error(`[Database] Error: ${err.message}`);
      // Re-enable foreign keys even on failure
      try { db.pragma('foreign_keys = ON'); } catch (_) {}
      throw err; // Stop processing further migrations
    }
  }

  if (appliedCount > 0) {
    console.log(`[Database] Applied ${appliedCount} migration(s)`);
  } else {
    console.log('[Database] All migrations already applied');
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
// Event Log Functions
// ---------------------------------------------------------------------------

/**
 * Insert an event log record into the event_log table.
 *
 * @param {object} logData - Event log fields
 * @param {string} logData.id - UUID
 * @param {string} logData.platform - twitch | youtube | stripe | internal
 * @param {string} logData.event_type - follow | subscribe | cheer | raid | donation | chat | custom
 * @param {string} logData.username - Viewer/user who triggered the event
 * @param {string} logData.display_name - Formatted display name
 * @param {number|null} logData.amount - Monetary amount or bit count
 * @param {string|null} logData.message - Associated message
 * @param {string} logData.metadata - JSON string of platform-specific data
 * @param {number} logData.alert_fired - 1 if an alert was triggered
 * @param {string} logData.timestamp - ISO timestamp
 */
function createEventLog(logData) {
  const stmt = db.prepare(`
    INSERT INTO event_log (id, platform, event_type, username, display_name, amount, message, metadata, alert_fired, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    logData.id,
    logData.platform,
    logData.event_type,
    logData.username,
    logData.display_name,
    logData.amount,
    logData.message,
    logData.metadata,
    logData.alert_fired,
    logData.timestamp
  );
}

/**
 * Query event logs with optional filtering.
 *
 * @param {object} [options]
 * @param {number}  [options.limit=100]           - Max rows to return
 * @param {string}  [options.event_type]          - Filter by event type
 * @param {string}  [options.platform]            - Filter by platform
 * @param {boolean} [options.alert_fired_only]    - Only return rows where alert_fired = 1
 * @param {string}  [options.search]              - Search username or message (LIKE %term%)
 * @returns {object[]} Array of event log rows
 */
function getEventLogs(options = {}) {
  let query = 'SELECT * FROM event_log WHERE 1=1';
  const params = [];

  if (options.event_type) {
    query += ' AND event_type = ?';
    params.push(options.event_type);
  }

  if (options.platform) {
    query += ' AND platform = ?';
    params.push(options.platform);
  }

  if (options.alert_fired_only) {
    query += ' AND alert_fired = 1';
  }

  if (options.search) {
    query += ' AND (username LIKE ? OR display_name LIKE ? OR message LIKE ?)';
    const term = `%${options.search}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(options.limit || 100);

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

/**
 * Query event logs within a date range.
 *
 * @param {string} startDate - ISO timestamp (inclusive)
 * @param {string} endDate - ISO timestamp (inclusive)
 * @returns {object[]} Array of event log rows
 */
function getEventLogsByDateRange(startDate, endDate) {
  const stmt = db.prepare(`
    SELECT * FROM event_log
    WHERE timestamp >= ? AND timestamp <= ?
    ORDER BY timestamp DESC
  `);

  return stmt.all(startDate, endDate);
}

/**
 * Delete event log records older than the given timestamp.
 *
 * @param {string} timestamp - ISO timestamp cutoff
 * @returns {number} Number of deleted rows
 */
function deleteEventLogsBefore(timestamp) {
  const stmt = db.prepare('DELETE FROM event_log WHERE timestamp < ?');
  const result = stmt.run(timestamp);
  return result.changes;
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

  // Event Log
  createEventLog,
  getEventLogs,
  getEventLogsByDateRange,
  deleteEventLogsBefore,
};
