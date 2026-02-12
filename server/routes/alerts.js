/**
 * StreamForge — Alerts API Routes
 *
 * REST API endpoints for managing alert configurations.
 *
 * Routes:
 *   GET    /api/alerts      - List all alerts
 *   GET    /api/alerts/:id  - Get a single alert
 *   POST   /api/alerts      - Create a new alert
 *   PUT    /api/alerts/:id  - Update an alert
 *   DELETE /api/alerts/:id  - Delete an alert
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * GET /api/alerts
 * Returns all alert configurations.
 */
router.get('/', (req, res) => {
  try {
    const alerts = db.getAllAlerts();
    res.json(alerts);
  } catch (err) {
    console.error('[API] Error fetching alerts:', err.message);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * GET /api/alerts/:id
 * Returns a single alert by ID.
 */
router.get('/:id', (req, res) => {
  try {
    const alert = db.getAlertById(req.params.id);
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
 * Optional body fields: enabled, message_template, duration_ms
 */
router.post('/', (req, res) => {
  try {
    const { type, name, enabled, message_template, duration_ms } = req.body;

    if (!type || !name) {
      return res.status(400).json({ error: 'Missing required fields: type, name' });
    }

    const alert = db.createAlert({ type, name, enabled, message_template, duration_ms });
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
    const { type, name, enabled, message_template, duration_ms } = req.body;
    const alert = db.updateAlert(req.params.id, { type, name, enabled, message_template, duration_ms });

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
 * Deletes an alert configuration.
 */
router.delete('/:id', (req, res) => {
  try {
    const deleted = db.deleteAlert(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    res.json({ status: 'ok', message: 'Alert deleted' });
  } catch (err) {
    console.error('[API] Error deleting alert:', err.message);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

module.exports = router;
