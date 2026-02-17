/**
 * Template Routes — REST endpoints for alert template management.
 *
 * Mounted at /api/templates
 *
 *   GET    /              — List all templates
 *   GET    /:id           — Get a single template
 *   POST   /              — Create a new user template
 *   PUT    /:id           — Update a user template
 *   DELETE /:id           — Delete a user template
 */

const express = require('express');
const {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} = require('../alerts/templates');

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/templates — List all templates
// ---------------------------------------------------------------------------

router.get('/', (_req, res) => {
  try {
    const templates = getAllTemplates();
    res.json({ templates });
  } catch (error) {
    console.error('[Templates] Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/templates/:id — Get a single template
// ---------------------------------------------------------------------------

router.get('/:id', (req, res) => {
  try {
    const template = getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ template });
  } catch (error) {
    console.error('[Templates] Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/templates — Create a new user template
// ---------------------------------------------------------------------------

router.post('/', (req, res) => {
  try {
    const { name, description, author, template_data } = req.body;

    if (!name || !template_data) {
      return res
        .status(400)
        .json({ error: 'name and template_data are required' });
    }

    const template = createTemplate({ name, description, author, template_data });
    res.json({ template });
  } catch (error) {
    console.error('[Templates] Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/templates/:id — Update a user template
// ---------------------------------------------------------------------------

router.put('/:id', (req, res) => {
  try {
    const template = updateTemplate(req.params.id, req.body);
    res.json({ template });
  } catch (error) {
    console.error('[Templates] Error updating template:', error);
    const status = error.message.includes('built-in') ? 403 : 500;
    res.status(status).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/templates/:id — Delete a user template
// ---------------------------------------------------------------------------

router.delete('/:id', (req, res) => {
  try {
    deleteTemplate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('[Templates] Error deleting template:', error);
    const status = error.message.includes('built-in') ? 403
      : error.message.includes('not found') ? 404
      : 500;
    res.status(status).json({ error: error.message });
  }
});

module.exports = router;
