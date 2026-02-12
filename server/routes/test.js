/**
 * StreamForge — Test Alert Routes
 *
 * Provides a REST endpoint for manually triggering test alerts through
 * the alert queue system. Useful for development, debugging, and verifying
 * that the queue processes alerts sequentially.
 *
 * Routes:
 *   POST /api/test-alert           - Enqueue a test alert
 *   GET  /api/test-alert/status    - Get current queue status
 *   POST /api/test-alert/clear     - Clear the alert queue
 */

const express = require('express');
const router = express.Router();
const alertQueue = require('../alerts/queue');

// ---------------------------------------------------------------------------
// Default test data per alert type
// ---------------------------------------------------------------------------

const TEST_DEFAULTS = {
  follow: {
    message_template: '{username} just followed!',
    duration_ms: 5000,
    animation_in: 'slideIn',
    animation_out: 'slideOut',
  },
  subscribe: {
    message_template: '{username} just subscribed!',
    duration_ms: 6000,
    animation_in: 'bounceIn',
    animation_out: 'fadeOut',
  },
  cheer: {
    message_template: '{username} cheered {amount} bits!',
    duration_ms: 6000,
    animation_in: 'popIn',
    animation_out: 'fadeOut',
  },
  raid: {
    message_template: '{username} is raiding with {amount} viewers!',
    duration_ms: 7000,
    animation_in: 'slideIn',
    animation_out: 'slideOut',
  },
  donation: {
    message_template: '{username} donated ${amount}!',
    duration_ms: 6000,
    animation_in: 'fadeIn',
    animation_out: 'fadeOut',
  },
};

const DEFAULT_USERNAMES = [
  'TestViewer', 'StreamFan42', 'CoolDude99', 'NightOwl_TV',
  'PixelHero', 'ChatLurker', 'HypeWatcher', 'SubGifter3000',
];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/test-alert
 *
 * Enqueue a test alert. Accepts optional body fields:
 *   { type, username, displayName, amount, message }
 *
 * If fields are omitted, sensible defaults are applied.
 */
router.post('/', (req, res) => {
  const body = req.body || {};
  const type = body.type || 'follow';
  const username = body.username || DEFAULT_USERNAMES[Math.floor(Math.random() * DEFAULT_USERNAMES.length)];
  const typeDefaults = TEST_DEFAULTS[type] || TEST_DEFAULTS.follow;

  const alertData = {
    type,
    username,
    displayName: body.displayName || username,
    amount: body.amount || (type === 'cheer' ? 100 : type === 'raid' ? 50 : type === 'donation' ? 5 : null),
    message: body.message || null,
    config: {
      ...typeDefaults,
      sound_volume: 0.8,
      font_family: 'Poppins',
      font_size: 48,
      text_color: '#FFFFFF',
      bg_color: null,
      custom_css: '',
      tts_enabled: 0,
    },
  };

  const alertId = alertQueue.enqueueAlert(alertData);

  if (!alertId) {
    return res.status(400).json({
      status: 'error',
      message: 'Failed to enqueue alert — invalid data',
    });
  }

  res.json({
    status: 'ok',
    alertId,
    type: alertData.type,
    username: alertData.username,
    queueLength: alertQueue.getQueueLength(),
    currentAlert: alertQueue.getCurrentAlert()?.id || null,
  });
});

/**
 * GET /api/test-alert/status
 *
 * Returns the current state of the alert queue.
 */
router.get('/status', (req, res) => {
  const current = alertQueue.getCurrentAlert();
  res.json({
    currentAlert: current
      ? { id: current.id, type: current.type, username: current.username }
      : null,
    queueLength: alertQueue.getQueueLength(),
  });
});

/**
 * POST /api/test-alert/clear
 *
 * Clears all pending alerts from the queue.
 * Does not stop the currently playing alert.
 */
router.post('/clear', (req, res) => {
  const cleared = alertQueue.clearQueue();
  res.json({
    status: 'ok',
    cleared,
    message: `Cleared ${cleared} alert(s) from the queue`,
  });
});

module.exports = router;
