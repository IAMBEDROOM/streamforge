/**
 * StreamForge — Event History API Routes
 *
 * REST endpoints for querying the event_log table. Used by the
 * History dashboard page to display, filter, and export alert history.
 *
 * Endpoints:
 *   GET /api/events         — Recent events with optional filtering
 *   GET /api/events/range   — Events within a date range
 */

const express = require('express');
const { getRecentEvents, getEventsByDateRange } = require('../alerts/logger');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/events
// ---------------------------------------------------------------------------

/**
 * Fetch recent events with optional filtering.
 *
 * Query params:
 *   limit            — Max results (default 100, max 1000)
 *   event_type       — Filter by type: follow | subscribe | cheer | raid | donation
 *   platform         — Filter by platform: twitch | youtube | stripe | internal
 *   alert_fired_only — 'true' to only return events that fired alerts
 *   search           — Search by username or message content
 */
router.get('/', (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);

    const options = {
      limit,
      event_type: req.query.event_type || null,
      platform: req.query.platform || null,
      alert_fired_only: req.query.alert_fired_only === 'true',
      search: req.query.search || null,
    };

    const events = getRecentEvents(options);
    res.json({ events, count: events.length });
  } catch (error) {
    console.error('[Events] Error fetching events:', error.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/events/range
// ---------------------------------------------------------------------------

/**
 * Fetch events within a date range.
 *
 * Query params:
 *   start — ISO timestamp (required, inclusive)
 *   end   — ISO timestamp (required, inclusive)
 */
router.get('/range', (req, res) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end query params are required (ISO timestamps)' });
    }

    const events = getEventsByDateRange(start, end);
    res.json({ events, count: events.length });
  } catch (error) {
    console.error('[Events] Error fetching events by range:', error.message);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

module.exports = router;
