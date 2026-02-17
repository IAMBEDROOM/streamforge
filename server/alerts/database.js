/**
 * StreamForge — Alert Database Module
 *
 * CRUD operations for alerts and alert variations, plus the alert
 * matching logic that finds the best alert config for a given event.
 *
 * All functions use better-sqlite3's synchronous API.
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');

// ---------------------------------------------------------------------------
// Alert Column Definitions
// ---------------------------------------------------------------------------

/**
 * All columns on the alerts table (excluding id, created_at, updated_at
 * which are handled separately).
 */
const ALERT_COLUMNS = [
  'type', 'name', 'enabled', 'message_template', 'duration_ms',
  'animation_in', 'animation_out', 'sound_path', 'sound_volume',
  'image_path', 'font_family', 'font_size', 'text_color', 'bg_color',
  'custom_css', 'min_amount', 'tts_enabled',
  'tts_voice', 'tts_rate', 'tts_pitch', 'tts_volume',
];

/**
 * Columns on the alert_variations table that can be updated
 * (excluding id, parent_alert_id, created_at, updated_at).
 */
const VARIATION_COLUMNS = [
  'name', 'condition_type', 'condition_value', 'message_template',
  'sound_path', 'sound_volume', 'image_path', 'animation_in',
  'animation_out', 'custom_css', 'enabled', 'priority',
];

// ---------------------------------------------------------------------------
// Alert Defaults
// ---------------------------------------------------------------------------

const ALERT_DEFAULTS = {
  enabled: 1,
  duration_ms: 5000,
  animation_in: 'fadeIn',
  animation_out: 'fadeOut',
  sound_volume: 0.8,
  font_family: 'Arial',
  font_size: 24,
  text_color: '#FFFFFF',
  tts_enabled: 0,
  tts_voice: null,
  tts_rate: 1.0,
  tts_pitch: 1.0,
  tts_volume: 1.0,
};

// ---------------------------------------------------------------------------
// Alert CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Create a new alert configuration.
 * @param {object} alertData - Alert properties (type and name are required)
 * @returns {object} The created alert object
 */
function createAlert(alertData) {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  // Build the values, applying defaults for unspecified fields
  const values = {};
  for (const col of ALERT_COLUMNS) {
    if (alertData[col] !== undefined) {
      values[col] = alertData[col];
    } else if (ALERT_DEFAULTS[col] !== undefined) {
      values[col] = ALERT_DEFAULTS[col];
    } else {
      values[col] = null;
    }
  }

  const columns = ['id', ...ALERT_COLUMNS, 'created_at', 'updated_at'];
  const placeholders = columns.map(() => '?').join(', ');
  const params = [id, ...ALERT_COLUMNS.map(c => values[c]), now, now];

  try {
    db.prepare(
      `INSERT INTO alerts (${columns.join(', ')}) VALUES (${placeholders})`
    ).run(...params);

    return getAlertById(id);
  } catch (err) {
    console.error('[Alerts DB] Error creating alert:', err.message);
    throw err;
  }
}

/**
 * Retrieve a single alert by ID.
 * @param {string} id - The alert UUID
 * @returns {object|null} The alert object, or null if not found
 */
function getAlertById(id) {
  const db = getDb();
  try {
    return db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) || null;
  } catch (err) {
    console.error('[Alerts DB] Error fetching alert:', err.message);
    throw err;
  }
}

/**
 * Retrieve all alerts with their variations attached.
 * Each alert object gets a `variations` array property.
 * @returns {object[]} Array of alert objects with variations
 */
function getAllAlerts() {
  const db = getDb();
  try {
    const alerts = db.prepare('SELECT * FROM alerts ORDER BY created_at ASC').all();
    const variations = db.prepare(
      'SELECT * FROM alert_variations ORDER BY priority DESC, created_at ASC'
    ).all();

    // Group variations by parent_alert_id
    const variationsByParent = {};
    for (const v of variations) {
      if (!variationsByParent[v.parent_alert_id]) {
        variationsByParent[v.parent_alert_id] = [];
      }
      variationsByParent[v.parent_alert_id].push(v);
    }

    // Attach variations to each alert
    for (const alert of alerts) {
      alert.variations = variationsByParent[alert.id] || [];
    }

    return alerts;
  } catch (err) {
    console.error('[Alerts DB] Error fetching all alerts:', err.message);
    throw err;
  }
}

/**
 * Get all alerts of a specific type.
 * @param {string} type - Alert type (follow, subscribe, cheer, raid, donation, custom)
 * @returns {object[]} Array of alert objects
 */
function getAlertsByType(type) {
  const db = getDb();
  try {
    return db.prepare('SELECT * FROM alerts WHERE type = ? ORDER BY created_at ASC').all(type);
  } catch (err) {
    console.error('[Alerts DB] Error fetching alerts by type:', err.message);
    throw err;
  }
}

/**
 * Get only enabled alerts.
 * @returns {object[]} Array of enabled alert objects
 */
function getEnabledAlerts() {
  const db = getDb();
  try {
    return db.prepare('SELECT * FROM alerts WHERE enabled = 1 ORDER BY created_at ASC').all();
  } catch (err) {
    console.error('[Alerts DB] Error fetching enabled alerts:', err.message);
    throw err;
  }
}

/**
 * Update an existing alert configuration.
 * Only updates fields that are provided in the updates object.
 * Automatically updates the updated_at timestamp.
 *
 * @param {string} id - The alert UUID
 * @param {object} updates - Fields to update
 * @returns {object|null} The updated alert object, or null if not found
 */
function updateAlert(id, updates) {
  const db = getDb();
  const existing = getAlertById(id);
  if (!existing) return null;

  // Build SET clause from only the provided fields
  const setClauses = [];
  const params = [];

  for (const col of ALERT_COLUMNS) {
    if (updates[col] !== undefined) {
      setClauses.push(`${col} = ?`);
      params.push(updates[col]);
    }
  }

  if (setClauses.length === 0) {
    // Nothing to update, but still touch updated_at
    const now = new Date().toISOString();
    db.prepare('UPDATE alerts SET updated_at = ? WHERE id = ?').run(now, id);
    return getAlertById(id);
  }

  const now = new Date().toISOString();
  setClauses.push('updated_at = ?');
  params.push(now);
  params.push(id);

  try {
    db.prepare(
      `UPDATE alerts SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...params);

    return getAlertById(id);
  } catch (err) {
    console.error('[Alerts DB] Error updating alert:', err.message);
    throw err;
  }
}

/**
 * Delete an alert and all its variations (cascade via foreign key).
 * @param {string} id - The alert UUID
 * @returns {boolean} True if the alert was deleted, false if not found
 */
function deleteAlert(id) {
  const db = getDb();
  try {
    const result = db.prepare('DELETE FROM alerts WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (err) {
    console.error('[Alerts DB] Error deleting alert:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Alert Variation CRUD Operations
// ---------------------------------------------------------------------------

/**
 * Create a new alert variation.
 * @param {object} variationData - Variation properties (parent_alert_id, name, condition_type, condition_value are required)
 * @returns {object} The created variation object
 */
function createAlertVariation(variationData) {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  // Verify parent alert exists
  const parent = getAlertById(variationData.parent_alert_id);
  if (!parent) {
    throw new Error(`Parent alert not found: ${variationData.parent_alert_id}`);
  }

  const values = {};
  for (const col of VARIATION_COLUMNS) {
    values[col] = variationData[col] !== undefined ? variationData[col] : null;
  }

  // Ensure required fields have values
  if (!values.name || !values.condition_type || values.condition_value === null) {
    throw new Error('Missing required variation fields: name, condition_type, condition_value');
  }

  // Default enabled to 1 if not specified
  if (values.enabled === null) values.enabled = 1;
  // Default priority to 0 if not specified
  if (values.priority === null) values.priority = 0;

  const columns = ['id', 'parent_alert_id', ...VARIATION_COLUMNS, 'created_at', 'updated_at'];
  const placeholders = columns.map(() => '?').join(', ');
  const params = [
    id,
    variationData.parent_alert_id,
    ...VARIATION_COLUMNS.map(c => values[c]),
    now,
    now,
  ];

  try {
    db.prepare(
      `INSERT INTO alert_variations (${columns.join(', ')}) VALUES (${placeholders})`
    ).run(...params);

    return getVariationById(id);
  } catch (err) {
    console.error('[Alerts DB] Error creating variation:', err.message);
    throw err;
  }
}

/**
 * Get all variations for a parent alert, ordered by priority (highest first).
 * @param {string} parentId - The parent alert UUID
 * @returns {object[]} Array of variation objects
 */
function getVariationsByParentId(parentId) {
  const db = getDb();
  try {
    return db.prepare(
      'SELECT * FROM alert_variations WHERE parent_alert_id = ? ORDER BY priority DESC, created_at ASC'
    ).all(parentId);
  } catch (err) {
    console.error('[Alerts DB] Error fetching variations:', err.message);
    throw err;
  }
}

/**
 * Retrieve a single variation by ID.
 * @param {string} id - The variation UUID
 * @returns {object|null} The variation object, or null if not found
 */
function getVariationById(id) {
  const db = getDb();
  try {
    return db.prepare('SELECT * FROM alert_variations WHERE id = ?').get(id) || null;
  } catch (err) {
    console.error('[Alerts DB] Error fetching variation:', err.message);
    throw err;
  }
}

/**
 * Update an existing alert variation.
 * Only updates fields that are provided in the updates object.
 *
 * @param {string} id - The variation UUID
 * @param {object} updates - Fields to update
 * @returns {object|null} The updated variation object, or null if not found
 */
function updateAlertVariation(id, updates) {
  const db = getDb();
  const existing = getVariationById(id);
  if (!existing) return null;

  const setClauses = [];
  const params = [];

  for (const col of VARIATION_COLUMNS) {
    if (updates[col] !== undefined) {
      setClauses.push(`${col} = ?`);
      params.push(updates[col]);
    }
  }

  if (setClauses.length === 0) {
    const now = new Date().toISOString();
    db.prepare('UPDATE alert_variations SET updated_at = ? WHERE id = ?').run(now, id);
    return getVariationById(id);
  }

  const now = new Date().toISOString();
  setClauses.push('updated_at = ?');
  params.push(now);
  params.push(id);

  try {
    db.prepare(
      `UPDATE alert_variations SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...params);

    return getVariationById(id);
  } catch (err) {
    console.error('[Alerts DB] Error updating variation:', err.message);
    throw err;
  }
}

/**
 * Delete a single alert variation.
 * @param {string} id - The variation UUID
 * @returns {boolean} True if deleted, false if not found
 */
function deleteAlertVariation(id) {
  const db = getDb();
  try {
    const result = db.prepare('DELETE FROM alert_variations WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (err) {
    console.error('[Alerts DB] Error deleting variation:', err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Alert Matching Logic
// ---------------------------------------------------------------------------

/**
 * Find the best matching alert configuration for a given event.
 *
 * Logic:
 *   1. Get all enabled alerts matching the event type
 *   2. For each alert (first match wins), check its enabled variations
 *      ordered by priority (highest first)
 *   3. If a variation matches the event data, merge its non-null fields
 *      over the parent alert and return the merged config
 *   4. If no variation matches but the parent alert passes its own
 *      conditions (min_amount), return the parent alert
 *   5. If no alert matches at all, return null
 *
 * @param {string} eventType - Event type (follow, subscribe, cheer, raid, donation, custom)
 * @param {object} eventData - Event-specific data (e.g. { tier: '3', amount: 500, username: 'viewer1' })
 * @returns {object|null} The resolved alert config (possibly merged with a variation), or null
 */
function findMatchingAlert(eventType, eventData = {}) {
  const db = getDb();

  try {
    // Get enabled alerts matching the event type
    const alerts = db.prepare(
      'SELECT * FROM alerts WHERE type = ? AND enabled = 1 ORDER BY created_at ASC'
    ).all(eventType);

    if (alerts.length === 0) return null;

    for (const alert of alerts) {
      // Check min_amount condition on the parent alert
      if (alert.min_amount !== null && eventData.amount !== undefined) {
        if (Number(eventData.amount) < alert.min_amount) {
          continue; // This alert requires a higher amount, skip it
        }
      }

      // Get enabled variations for this alert, ordered by priority DESC
      const variations = db.prepare(
        'SELECT * FROM alert_variations WHERE parent_alert_id = ? AND enabled = 1 ORDER BY priority DESC'
      ).all(alert.id);

      // Check each variation for a match
      for (const variation of variations) {
        if (doesVariationMatch(variation, eventData)) {
          // Merge variation overrides onto the parent alert
          return mergeVariation(alert, variation);
        }
      }

      // No variation matched — return the parent alert as-is
      return alert;
    }

    // No alert passed its conditions
    return null;
  } catch (err) {
    console.error('[Alerts DB] Error finding matching alert:', err.message);
    throw err;
  }
}

/**
 * Check if a variation's condition matches the event data.
 *
 * Condition types:
 *   - 'tier':   matches eventData.tier (e.g. '1', '2', '3')
 *   - 'amount': matches if eventData.amount >= condition_value
 *   - 'custom': matches if eventData[condition_type_key] === condition_value
 *               (for extensibility)
 *
 * @param {object} variation - The variation record
 * @param {object} eventData - The event data to match against
 * @returns {boolean} True if the variation matches
 */
function doesVariationMatch(variation, eventData) {
  const { condition_type, condition_value } = variation;

  switch (condition_type) {
    case 'tier':
      // Match exact tier value (e.g. '1', '2', '3')
      return String(eventData.tier) === String(condition_value);

    case 'amount':
      // Match if the event amount meets or exceeds the threshold
      if (eventData.amount === undefined) return false;
      return Number(eventData.amount) >= Number(condition_value);

    case 'custom':
      // Generic string match — condition_value is checked against
      // eventData.custom_value for extensibility
      return String(eventData.custom_value) === String(condition_value);

    default:
      return false;
  }
}

/**
 * Merge a variation's non-null override fields onto a parent alert.
 * Returns a new object — does not mutate the originals.
 *
 * @param {object} alert - The parent alert record
 * @param {object} variation - The matching variation record
 * @returns {object} Merged alert config
 */
function mergeVariation(alert, variation) {
  const merged = { ...alert };

  // Fields that a variation can override
  const overrideFields = [
    'message_template', 'sound_path', 'sound_volume', 'image_path',
    'animation_in', 'animation_out', 'custom_css',
  ];

  for (const field of overrideFields) {
    if (variation[field] !== null && variation[field] !== undefined) {
      merged[field] = variation[field];
    }
  }

  // Attach variation metadata for reference
  merged._variation_id = variation.id;
  merged._variation_name = variation.name;

  return merged;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // Alert CRUD
  createAlert,
  getAlertById,
  getAllAlerts,
  getAlertsByType,
  getEnabledAlerts,
  updateAlert,
  deleteAlert,

  // Alert Variation CRUD
  createAlertVariation,
  getVariationsByParentId,
  getVariationById,
  updateAlertVariation,
  deleteAlertVariation,

  // Alert Matching
  findMatchingAlert,
};
