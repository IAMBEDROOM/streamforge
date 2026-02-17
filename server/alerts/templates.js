/**
 * Alert Templates — CRUD operations for alert_templates table.
 *
 * Templates store reusable alert configurations that users can save, load,
 * export, and import. Built-in templates ship with StreamForge and cannot
 * be deleted or updated.
 */

const { getDb } = require('../database');
const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Fetch all templates, ordered with built-in first then alphabetical.
 */
function getAllTemplates() {
  const db = getDb();
  const stmt = db.prepare(
    'SELECT * FROM alert_templates ORDER BY is_builtin DESC, name ASC'
  );
  return stmt.all();
}

/**
 * Fetch a single template by ID.
 * @returns {object|undefined} The template row or undefined if not found.
 */
function getTemplateById(id) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM alert_templates WHERE id = ?');
  return stmt.get(id);
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a user template.
 *
 * @param {object} data
 * @param {string} data.name          — Display name for the template
 * @param {string} [data.description] — Short description
 * @param {string} [data.author]      — Creator name (defaults to "User")
 * @param {object} data.template_data — Complete alert configuration object
 * @returns {object} The newly created template row.
 */
function createTemplate(data) {
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO alert_templates (id, name, description, author, template_data, is_builtin, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `);

  stmt.run(
    id,
    data.name,
    data.description || '',
    data.author || 'User',
    typeof data.template_data === 'string'
      ? data.template_data
      : JSON.stringify(data.template_data),
    now,
    now
  );

  return getTemplateById(id);
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

/**
 * Update a user-created template. Built-in templates cannot be updated.
 *
 * @param {string} id      — Template ID
 * @param {object} updates — Fields to update (name, description, author, template_data)
 * @returns {object} The updated template row.
 * @throws {Error} If the template is built-in.
 */
function updateTemplate(id, updates) {
  const db = getDb();

  const existing = getTemplateById(id);
  if (!existing) {
    throw new Error('Template not found');
  }
  if (existing.is_builtin) {
    throw new Error('Cannot update built-in templates');
  }

  const now = new Date().toISOString();
  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.author !== undefined) {
    fields.push('author = ?');
    values.push(updates.author);
  }
  if (updates.template_data !== undefined) {
    fields.push('template_data = ?');
    values.push(
      typeof updates.template_data === 'string'
        ? updates.template_data
        : JSON.stringify(updates.template_data)
    );
  }

  if (fields.length === 0) {
    return existing; // nothing to update
  }

  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  const stmt = db.prepare(
    `UPDATE alert_templates SET ${fields.join(', ')} WHERE id = ?`
  );
  stmt.run(...values);

  return getTemplateById(id);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete a user-created template. Built-in templates cannot be deleted.
 *
 * @param {string} id — Template ID
 * @returns {{ changes: number }}
 * @throws {Error} If the template is built-in.
 */
function deleteTemplate(id) {
  const db = getDb();

  const existing = getTemplateById(id);
  if (!existing) {
    throw new Error('Template not found');
  }
  if (existing.is_builtin) {
    throw new Error('Cannot delete built-in templates');
  }

  const stmt = db.prepare('DELETE FROM alert_templates WHERE id = ?');
  return stmt.run(id);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
};
