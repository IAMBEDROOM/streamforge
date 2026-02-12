/**
 * StreamForge — Alert Queue System
 *
 * Manages an in-memory FIFO queue that ensures alerts fire sequentially
 * via WebSocket. Only one alert plays at a time — when it completes,
 * the next alert in the queue fires automatically.
 *
 * Usage:
 *   const alertQueue = require('./alerts/queue');
 *   alertQueue.init(io.of('/alerts'));
 *   alertQueue.enqueueAlert({ type: 'follow', username: 'viewer1', ... });
 */

const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// Internal State
// ---------------------------------------------------------------------------

/** @type {object[]} FIFO queue of pending alerts */
const queue = [];

/** @type {object|null} The alert currently being displayed on the overlay */
let currentAlert = null;

/** @type {boolean} Whether an alert is currently being processed */
let isProcessing = false;

/** @type {NodeJS.Timeout|null} Fallback timer in case overlay never sends alert:done */
let fallbackTimer = null;

/** @type {import('socket.io').Namespace|null} Reference to the /alerts Socket.io namespace */
let alertsNamespace = null;

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize the alert queue with a reference to the Socket.io /alerts namespace.
 * Must be called once during server startup, after namespaces are set up.
 *
 * @param {import('socket.io').Namespace} namespace - The /alerts Socket.io namespace
 */
function init(namespace) {
  if (!namespace) {
    throw new Error('[AlertQueue] init() requires a Socket.io namespace');
  }
  alertsNamespace = namespace;
  console.log('[AlertQueue] Initialized');
}

// ---------------------------------------------------------------------------
// Required Fields Validation
// ---------------------------------------------------------------------------

/** Fields that must be present on every enqueued alert */
const REQUIRED_FIELDS = ['type', 'username'];

/**
 * Validate that alertData contains all required fields.
 *
 * @param {object} alertData
 * @returns {{ valid: boolean, missing: string[] }}
 */
function validateAlertData(alertData) {
  if (!alertData || typeof alertData !== 'object') {
    return { valid: false, missing: REQUIRED_FIELDS };
  }
  const missing = REQUIRED_FIELDS.filter(
    (field) => alertData[field] === undefined || alertData[field] === null || alertData[field] === ''
  );
  return { valid: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Default Alert Configuration
// ---------------------------------------------------------------------------

/** Default config values applied when fields are missing from the alert data */
const DEFAULT_CONFIG = {
  message_template: '{username} triggered an alert!',
  duration_ms: 5000,
  animation_in: 'fadeIn',
  animation_out: 'fadeOut',
  sound_path: null,
  sound_volume: 0.8,
  image_path: null,
  font_family: 'Poppins',
  font_size: 48,
  text_color: '#FFFFFF',
  bg_color: null,
  custom_css: '',
  tts_enabled: 0,
};

/** Default message templates per alert type */
const DEFAULT_MESSAGES = {
  follow: '{username} just followed!',
  subscribe: '{username} just subscribed!',
  cheer: '{username} cheered {amount} bits!',
  raid: '{username} is raiding with {amount} viewers!',
  donation: '{username} donated ${amount}!',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Add an alert to the queue. If the queue was empty and nothing is
 * currently playing, the alert fires immediately.
 *
 * @param {object} alertData - Alert data object (must include type, username)
 * @returns {string|null} The alert instance ID, or null if validation failed
 */
function enqueueAlert(alertData) {
  // Validate required fields
  const { valid, missing } = validateAlertData(alertData);
  if (!valid) {
    console.error(`[AlertQueue] Invalid alert data — missing fields: ${missing.join(', ')}`);
    return null;
  }

  // Generate unique ID for this alert instance if not present
  const id = alertData.id || uuidv4();

  // Build the full alert object with defaults
  const config = Object.assign({}, DEFAULT_CONFIG, alertData.config || {});

  // Apply type-specific default message template if not provided
  if (!alertData.config?.message_template && DEFAULT_MESSAGES[alertData.type]) {
    config.message_template = DEFAULT_MESSAGES[alertData.type];
  }

  const alert = {
    id,
    alertConfigId: alertData.alertConfigId || null,
    type: alertData.type,
    username: alertData.username,
    displayName: alertData.displayName || alertData.username,
    amount: alertData.amount || null,
    message: alertData.message || null,
    config,
    timestamp: alertData.timestamp || new Date().toISOString(),
  };

  // Add to queue
  queue.push(alert);
  console.log(
    `[AlertQueue] Enqueued alert ${id} (type: ${alert.type}, user: ${alert.username}) — ` +
    `queue length: ${queue.length}, processing: ${isProcessing}`
  );

  // TODO: Log triggered alert to event_log table (Task 2.8)

  // If nothing is currently playing, start processing
  if (!isProcessing) {
    processQueue();
  }

  return id;
}

/**
 * Get the alert currently being displayed, or null if none.
 *
 * @returns {object|null}
 */
function getCurrentAlert() {
  return currentAlert;
}

/**
 * Get the number of alerts waiting in the queue (not including the current alert).
 *
 * @returns {number}
 */
function getQueueLength() {
  return queue.length;
}

/**
 * Clear all queued alerts. Does NOT stop the currently playing alert.
 *
 * @returns {number} Number of alerts that were cleared
 */
function clearQueue() {
  const count = queue.length;
  queue.length = 0;
  console.log(`[AlertQueue] Queue cleared (${count} alerts removed)`);
  return count;
}

// ---------------------------------------------------------------------------
// Queue Processing (Internal)
// ---------------------------------------------------------------------------

/**
 * Process the next alert in the queue. Called automatically when:
 *   - A new alert is enqueued and nothing is playing
 *   - The current alert completes (via alert:done or fallback timeout)
 */
function processQueue() {
  // Guard: don't process if already processing or queue is empty
  if (isProcessing || queue.length === 0) {
    return;
  }

  isProcessing = true;

  // Take the next alert from the front of the queue (FIFO)
  currentAlert = queue.shift();

  console.log(
    `[AlertQueue] Firing alert ${currentAlert.id} (type: ${currentAlert.type}, ` +
    `user: ${currentAlert.username}) — ${queue.length} remaining in queue`
  );

  // Emit to the /alerts namespace
  if (alertsNamespace) {
    const connectedCount = alertsNamespace.sockets?.size || 0;

    if (connectedCount === 0) {
      console.warn(
        '[AlertQueue] No overlay clients connected to /alerts — ' +
        'alert will advance via fallback timeout'
      );
    }

    alertsNamespace.emit('alert:trigger', currentAlert);
  } else {
    console.error('[AlertQueue] Namespace not initialized — call init() first');
  }

  // Set a fallback timeout in case the overlay never sends alert:done.
  // This prevents the queue from getting permanently stuck.
  const duration = currentAlert.config?.duration_ms || DEFAULT_CONFIG.duration_ms;
  const fallbackDelay = duration + 1000; // 1 second buffer

  fallbackTimer = setTimeout(() => {
    console.warn(
      `[AlertQueue] Fallback timeout fired for alert ${currentAlert?.id} ` +
      `after ${fallbackDelay}ms — overlay did not send alert:done`
    );
    resetAndProcessNext();
  }, fallbackDelay);
}

/**
 * Handle the alert:done event from the overlay. Validates that the
 * completed alert matches the current one, then advances the queue.
 *
 * @param {object} data - Payload from the overlay: { alertId: string }
 */
function onAlertDone(data) {
  const alertId = data?.alertId;

  if (!currentAlert) {
    console.warn(`[AlertQueue] Received alert:done but no alert is currently playing (alertId: ${alertId})`);
    return;
  }

  if (alertId && alertId !== currentAlert.id) {
    console.warn(
      `[AlertQueue] alert:done ID mismatch — received: ${alertId}, ` +
      `expected: ${currentAlert.id}. Ignoring.`
    );
    return;
  }

  console.log(
    `[AlertQueue] Alert ${currentAlert.id} completed (type: ${currentAlert.type}, ` +
    `user: ${currentAlert.username})`
  );

  resetAndProcessNext();
}

/**
 * Reset current alert state, clear the fallback timer, and process
 * the next alert in the queue if any.
 */
function resetAndProcessNext() {
  // Clear the fallback timer
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }

  currentAlert = null;
  isProcessing = false;

  // Process next alert if queue has more
  if (queue.length > 0) {
    processQueue();
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  init,
  enqueueAlert,
  getCurrentAlert,
  getQueueLength,
  clearQueue,
  onAlertDone,
};
