/**
 * StreamForge — Settings API Routes
 *
 * REST API endpoints for managing key-value settings.
 *
 * Routes:
 *   GET /api/settings/:key  - Get a setting value
 *   PUT /api/settings/:key  - Set/update a setting value
 */

const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * GET /api/settings/:key
 * Returns the value for a given setting key.
 */
router.get('/:key', (req, res) => {
  try {
    const value = db.getSetting(req.params.key);
    if (value === null) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json({ key: req.params.key, value });
  } catch (err) {
    console.error('[API] Error fetching setting:', err.message);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

/**
 * PUT /api/settings/:key
 * Creates or updates a setting value.
 *
 * Required body fields: value
 */
router.put('/:key', (req, res) => {
  try {
    const { value } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'Missing required field: value' });
    }

    // Convert non-string values to string for storage
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

    db.setSetting(req.params.key, stringValue);
    res.json({ key: req.params.key, value: stringValue });
  } catch (err) {
    console.error('[API] Error updating setting:', err.message);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

module.exports = router;
