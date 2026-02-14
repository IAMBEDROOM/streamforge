/**
 * StreamForge — Event Logger
 *
 * Logs every alert event to the event_log table in SQLite and provides
 * query helpers for the History dashboard page. Also handles auto-pruning
 * of records older than 7 days.
 *
 * Usage:
 *   const logger = require('./alerts/logger');
 *   logger.logEvent({ event_type: 'follow', username: 'viewer1', ... });
 *   const events = logger.getRecentEvents({ limit: 50, event_type: 'follow' });
 */

const { v4: uuidv4 } = require('uuid');
const database = require('../database');

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/**
 * Log an event to the database.
 *
 * @param {object} eventData
 * @param {string}  [eventData.platform='internal']  - twitch | youtube | stripe | internal
 * @param {string}   eventData.event_type            - follow | subscribe | cheer | raid | donation | chat | custom
 * @param {string}   eventData.username               - Viewer/user who triggered the event
 * @param {string}  [eventData.display_name]          - Formatted display name (defaults to username)
 * @param {number}  [eventData.amount=null]           - Monetary amount or bit count
 * @param {string}  [eventData.message=null]          - Associated message
 * @param {object}  [eventData.metadata={}]           - Platform-specific extra data
 * @param {number}  [eventData.alert_fired=0]         - 1 if an alert was triggered
 * @returns {object|null} The created log record, or null on failure
 */
function logEvent(eventData) {
  const {
    platform = 'internal',
    event_type,
    username,
    display_name = username,
    amount = null,
    message = null,
    metadata = {},
    alert_fired = 0,
  } = eventData;

  const log = {
    id: uuidv4(),
    platform,
    event_type,
    username,
    display_name,
    amount,
    message,
    metadata: JSON.stringify(metadata),
    alert_fired,
    timestamp: new Date().toISOString(),
  };

  try {
    database.createEventLog(log);
    console.log(
      `[Logger] Logged event: ${event_type} by ${username} (platform: ${platform}, alert: ${alert_fired ? 'yes' : 'no'})`
    );
    return log;
  } catch (error) {
    console.error('[Logger] Failed to log event:', error.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Querying
// ---------------------------------------------------------------------------

/**
 * Get recent events with optional filtering.
 *
 * @param {object} [options]
 * @param {number}  [options.limit=100]           - Max rows to return
 * @param {string}  [options.event_type]          - Filter by event type
 * @param {string}  [options.platform]            - Filter by platform
 * @param {boolean} [options.alert_fired_only]    - Only events that fired alerts
 * @param {string}  [options.search]              - Search username or message
 * @returns {object[]} Array of event log rows
 */
function getRecentEvents(options = {}) {
  try {
    return database.getEventLogs(options);
  } catch (error) {
    console.error('[Logger] Failed to fetch events:', error.message);
    return [];
  }
}

/**
 * Get events within a specific date range.
 *
 * @param {string} startDate - ISO timestamp (inclusive)
 * @param {string} endDate - ISO timestamp (inclusive)
 * @returns {object[]} Array of event log rows
 */
function getEventsByDateRange(startDate, endDate) {
  try {
    return database.getEventLogsByDateRange(startDate, endDate);
  } catch (error) {
    console.error('[Logger] Failed to fetch events by date:', error.message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Pruning
// ---------------------------------------------------------------------------

/**
 * Prune events older than 7 days from the event_log table.
 *
 * @returns {number} Number of deleted rows
 */
function pruneOldEvents() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const deleted = database.deleteEventLogsBefore(sevenDaysAgo.toISOString());
    if (deleted > 0) {
      console.log(`[Logger] Pruned ${deleted} event(s) older than 7 days`);
    }
    return deleted;
  } catch (error) {
    console.error('[Logger] Failed to prune events:', error.message);
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  logEvent,
  getRecentEvents,
  getEventsByDateRange,
  pruneOldEvents,
};
