/**
 * StreamForge — Alerts API Routes
 *
 * REST API endpoints for managing alert configurations and alert variations.
 *
 * Alert Routes:
 *   GET    /api/alerts              - List all alerts (with variations)
 *   GET    /api/alerts/type/:type   - Get alerts by type
 *   GET    /api/alerts/enabled      - Get enabled alerts only
 *   GET    /api/alerts/:id          - Get a single alert
 *   POST   /api/alerts              - Create a new alert
 *   PUT    /api/alerts/:id          - Update an alert
 *   DELETE /api/alerts/:id          - Delete an alert (cascades to variations)
 *
 * Variation Routes:
 *   GET    /api/alerts/:id/variations       - List variations for an alert
 *   POST   /api/alerts/:id/variations       - Create a variation for an alert
 *   GET    /api/alerts/variations/:id       - Get a single variation
 *   PUT    /api/alerts/variations/:id       - Update a variation
 *   DELETE /api/alerts/variations/:id       - Delete a variation
 *
 * Matching Route:
 *   POST   /api/alerts/match               - Find the best matching alert for an event
 */

const express = require('express');
const router = express.Router();
const alertsDb = require('../alerts/database');

// ---------------------------------------------------------------------------
// Alert Fields
// ---------------------------------------------------------------------------

/**
 * All accepted fields for creating/updating an alert.
 * These are plucked from the request body to prevent injection of
 * unexpected fields into the database.
 */
const ALERT_FIELDS = [
  'type', 'name', 'enabled', 'message_template', 'duration_ms',
  'animation_in', 'animation_out', 'sound_path', 'sound_volume',
  'image_path', 'font_family', 'font_size', 'text_color', 'bg_color',
  'custom_css', 'min_amount', 'tts_enabled',
  'tts_voice', 'tts_rate', 'tts_pitch', 'tts_volume',
];

/**
 * All accepted fields for creating/updating a variation.
 */
const VARIATION_FIELDS = [
  'name', 'condition_type', 'condition_value', 'message_template',
  'sound_path', 'sound_volume', 'image_path', 'animation_in',
  'animation_out', 'custom_css', 'enabled', 'priority',
];

/**
 * Pick only known fields from a request body.
 * @param {object} body - Request body
 * @param {string[]} fields - Allowed field names
 * @returns {object} Filtered object with only known fields
 */
function pickFields(body, fields) {
  const result = {};
  for (const field of fields) {
    if (body[field] !== undefined) {
      result[field] = body[field];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Alert Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/alerts
 * Returns all alert configurations with their variations.
 */
router.get('/', (req, res) => {
  try {
    const alerts = alertsDb.getAllAlerts();
    res.json(alerts);
  } catch (err) {
    console.error('[API] Error fetching alerts:', err.message);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * GET /api/alerts/enabled
 * Returns only enabled alerts.
 * NOTE: This route must come before /:id to avoid "enabled" being treated as an ID.
 */
router.get('/enabled', (req, res) => {
  try {
    const alerts = alertsDb.getEnabledAlerts();
    res.json(alerts);
  } catch (err) {
    console.error('[API] Error fetching enabled alerts:', err.message);
    res.status(500).json({ error: 'Failed to fetch enabled alerts' });
  }
});

/**
 * GET /api/alerts/type/:type
 * Returns all alerts of a specific type.
 */
router.get('/type/:type', (req, res) => {
  try {
    const alerts = alertsDb.getAlertsByType(req.params.type);
    res.json(alerts);
  } catch (err) {
    console.error('[API] Error fetching alerts by type:', err.message);
    res.status(500).json({ error: 'Failed to fetch alerts by type' });
  }
});

/**
 * POST /api/alerts/match
 * Find the best matching alert configuration for an event.
 *
 * Body: { eventType: string, eventData: object }
 */
router.post('/match', (req, res) => {
  try {
    const { eventType, eventData } = req.body;

    if (!eventType) {
      return res.status(400).json({ error: 'Missing required field: eventType' });
    }

    const alert = alertsDb.findMatchingAlert(eventType, eventData || {});
    if (!alert) {
      return res.status(404).json({ error: 'No matching alert found' });
    }

    res.json(alert);
  } catch (err) {
    console.error('[API] Error matching alert:', err.message);
    res.status(500).json({ error: 'Failed to match alert' });
  }
});

/**
 * GET /api/alerts/:id
 * Returns a single alert by ID.
 */
router.get('/:id', (req, res) => {
  try {
    const alert = alertsDb.getAlertById(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json(alert);
  } catch (err) {
    console.error('[API] Error fetching alert:', err.message);
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

/**
 * POST /api/alerts
 * Creates a new alert configuration.
 *
 * Required body fields: type, name
 * Optional: all other alert fields (animation_in, sound_path, etc.)
 */
router.post('/', (req, res) => {
  try {
    const data = pickFields(req.body, ALERT_FIELDS);

    if (!data.type || !data.name) {
      return res.status(400).json({ error: 'Missing required fields: type, name' });
    }

    const alert = alertsDb.createAlert(data);
    res.status(201).json(alert);
  } catch (err) {
    console.error('[API] Error creating alert:', err.message);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

/**
 * PUT /api/alerts/:id
 * Updates an existing alert configuration.
 * Only provided fields will be updated.
 */
router.put('/:id', (req, res) => {
  try {
    const data = pickFields(req.body, ALERT_FIELDS);
    const alert = alertsDb.updateAlert(req.params.id, data);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (err) {
    console.error('[API] Error updating alert:', err.message);
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

/**
 * DELETE /api/alerts/:id
 * Deletes an alert and all its variations (cascade).
 */
router.delete('/:id', (req, res) => {
  try {
    const deleted = alertsDb.deleteAlert(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ status: 'ok', message: 'Alert deleted' });
  } catch (err) {
    console.error('[API] Error deleting alert:', err.message);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// ---------------------------------------------------------------------------
// Variation Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/alerts/:id/variations
 * Returns all variations for a specific alert, ordered by priority.
 */
router.get('/:id/variations', (req, res) => {
  try {
    // Verify parent alert exists
    const alert = alertsDb.getAlertById(req.params.id);
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const variations = alertsDb.getVariationsByParentId(req.params.id);
    res.json(variations);
  } catch (err) {
    console.error('[API] Error fetching variations:', err.message);
    res.status(500).json({ error: 'Failed to fetch variations' });
  }
});

/**
 * POST /api/alerts/:id/variations
 * Creates a new variation for an alert.
 *
 * Required body fields: name, condition_type, condition_value
 * Optional: message_template, sound_path, sound_volume, image_path,
 *           animation_in, animation_out, custom_css, enabled, priority
 */
router.post('/:id/variations', (req, res) => {
  try {
    const data = pickFields(req.body, VARIATION_FIELDS);
    data.parent_alert_id = req.params.id;

    if (!data.name || !data.condition_type || data.condition_value === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: name, condition_type, condition_value',
      });
    }

    const variation = alertsDb.createAlertVariation(data);
    res.status(201).json(variation);
  } catch (err) {
    if (err.message && err.message.includes('Parent alert not found')) {
      return res.status(404).json({ error: 'Parent alert not found' });
    }
    console.error('[API] Error creating variation:', err.message);
    res.status(500).json({ error: 'Failed to create variation' });
  }
});

/**
 * GET /api/alerts/variations/:id
 * Returns a single variation by ID.
 */
router.get('/variations/:id', (req, res) => {
  try {
    const variation = alertsDb.getVariationById(req.params.id);
    if (!variation) {
      return res.status(404).json({ error: 'Variation not found' });
    }
    res.json(variation);
  } catch (err) {
    console.error('[API] Error fetching variation:', err.message);
    res.status(500).json({ error: 'Failed to fetch variation' });
  }
});

/**
 * PUT /api/alerts/variations/:id
 * Updates an existing variation.
 * Only provided fields will be updated.
 */
router.put('/variations/:id', (req, res) => {
  try {
    const data = pickFields(req.body, VARIATION_FIELDS);
    const variation = alertsDb.updateAlertVariation(req.params.id, data);

    if (!variation) {
      return res.status(404).json({ error: 'Variation not found' });
    }

    res.json(variation);
  } catch (err) {
    console.error('[API] Error updating variation:', err.message);
    res.status(500).json({ error: 'Failed to update variation' });
  }
});

/**
 * DELETE /api/alerts/variations/:id
 * Deletes a single variation.
 */
router.delete('/variations/:id', (req, res) => {
  try {
    const deleted = alertsDb.deleteAlertVariation(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Variation not found' });
    }
    res.json({ status: 'ok', message: 'Variation deleted' });
  } catch (err) {
    console.error('[API] Error deleting variation:', err.message);
    res.status(500).json({ error: 'Failed to delete variation' });
  }
});

module.exports = router;
