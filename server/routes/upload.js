/**
 * StreamForge — File Upload Routes
 *
 * Handles sound and image file uploads via multer (multipart) or by copying
 * from a local file path (used when the Tauri file dialog returns a path).
 * Files are saved to the streamforge-data directory alongside the database.
 *
 * Routes:
 *   POST /api/upload/sound         - Upload an audio file via multipart (mp3, wav, ogg)
 *   POST /api/upload/sound/path    - Copy an audio file from a local path
 *   POST /api/upload/image         - Upload an image file via multipart
 *   POST /api/upload/image/path    - Copy an image file from a local path
 *   GET  /api/upload/sounds        - List all uploaded sound files
 *   DELETE /api/upload/sound/:name - Delete an uploaded sound file
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { getAppDataDir } = require('../database');

const router = express.Router();

// ---------------------------------------------------------------------------
// Directory Setup
// ---------------------------------------------------------------------------

/**
 * Ensure a directory exists, creating it recursively if needed.
 * @param {string} dirPath
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get the base data directory for uploaded files.
 * @returns {string}
 */
function getDataDir() {
  const dataDir = path.join(getAppDataDir(), 'streamforge-data');
  ensureDir(dataDir);
  return dataDir;
}

// ---------------------------------------------------------------------------
// Multer Configuration
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Create a multer storage engine that saves files to a specific subdirectory
 * with a UUID-prefixed filename to prevent collisions.
 *
 * @param {string} subdir - Subdirectory name (e.g. 'sounds', 'images')
 * @returns {multer.StorageEngine}
 */
function createStorage(subdir) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(getDataDir(), subdir);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueName = `${uuidv4()}${ext}`;
      cb(null, uniqueName);
    },
  });
}

/**
 * Create a file filter that only accepts specific extensions.
 *
 * @param {string[]} extensions - Allowed extensions (without dots)
 * @param {string} label - Human-readable label for error messages
 * @returns {Function}
 */
function createFileFilter(extensions, label) {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (extensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(`Invalid file type. Allowed ${label} formats: ${extensions.join(', ')}`),
        false
      );
    }
  };
}

// Sound upload config
const soundUpload = multer({
  storage: createStorage('sounds'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: createFileFilter(['mp3', 'wav', 'ogg'], 'audio'),
});

// Image upload config
const imageUpload = multer({
  storage: createStorage('images'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: createFileFilter(['png', 'jpg', 'jpeg', 'gif', 'webp'], 'image'),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/upload/sound
 * Upload a sound file (mp3, wav, ogg). Max 100MB.
 */
router.post('/sound', (req, res) => {
  soundUpload.single('sound')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No sound file provided. Use field name "sound".' });
    }

    console.log(`[Upload] Sound saved: ${req.file.filename} (${(req.file.size / 1024).toFixed(1)}KB)`);

    res.json({
      path: `/sounds/${req.file.filename}`,
      filename: req.file.originalname,
    });
  });
});

/**
 * POST /api/upload/image
 * Upload an image file (png, jpg, jpeg, gif, webp). Max 100MB.
 */
router.post('/image', (req, res) => {
  imageUpload.single('image')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided. Use field name "image".' });
    }

    console.log(`[Upload] Image saved: ${req.file.filename} (${(req.file.size / 1024).toFixed(1)}KB)`);

    res.json({
      path: `/images/${req.file.filename}`,
      filename: req.file.originalname,
    });
  });
});

// ---------------------------------------------------------------------------
// Path-based Uploads (Tauri file dialog → local path → server copies file)
// ---------------------------------------------------------------------------

/**
 * Validate and copy a local file to the data directory.
 * Used when the frontend sends a file path from the Tauri native file dialog
 * instead of a multipart upload (avoids needing the Tauri fs plugin / asset protocol).
 *
 * @param {string} sourcePath - Absolute path to the source file on disk
 * @param {string} subdir - Target subdirectory ('sounds' or 'images')
 * @param {string[]} allowedExts - Allowed extensions (with dots, e.g. ['.mp3', '.wav'])
 * @param {string} label - Human-readable label for errors
 * @returns {{ destPath: string, filename: string, originalName: string, size: number }}
 */
function copyLocalFile(sourcePath, subdir, allowedExts, label) {
  // Validate source path exists
  if (!fs.existsSync(sourcePath)) {
    throw Object.assign(new Error(`File not found: ${sourcePath}`), { status: 404 });
  }

  // Validate extension
  const ext = path.extname(sourcePath).toLowerCase();
  if (!allowedExts.includes(ext)) {
    throw Object.assign(
      new Error(`Invalid file type. Allowed ${label} formats: ${allowedExts.join(', ')}`),
      { status: 400 }
    );
  }

  // Check file size
  const stats = fs.statSync(sourcePath);
  if (stats.size > MAX_FILE_SIZE) {
    throw Object.assign(new Error('File too large. Maximum size is 100MB.'), { status: 400 });
  }

  // Generate unique filename and copy
  const uniqueName = `${uuidv4()}${ext}`;
  const destDir = path.join(getDataDir(), subdir);
  ensureDir(destDir);
  const destPath = path.join(destDir, uniqueName);

  fs.copyFileSync(sourcePath, destPath);

  const originalName = path.basename(sourcePath);
  return { destPath, filename: uniqueName, originalName, size: stats.size };
}

/**
 * POST /api/upload/sound/path
 * Copy a sound file from a local file path (sent as JSON body).
 * Body: { "filePath": "C:\\Users\\...\\alert.mp3" }
 */
router.post('/sound/path', (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid filePath in request body.' });
    }

    const result = copyLocalFile(filePath, 'sounds', ['.mp3', '.wav', '.ogg'], 'audio');
    console.log(`[Upload] Sound copied: ${result.originalName} → ${result.filename} (${(result.size / 1024).toFixed(1)}KB)`);

    res.json({
      path: `/sounds/${result.filename}`,
      filename: result.originalName,
    });
  } catch (error) {
    const status = error.status || 500;
    console.error('[Upload] Error copying sound from path:', error.message);
    res.status(status).json({ error: error.message || 'Failed to copy sound file' });
  }
});

/**
 * POST /api/upload/image/path
 * Copy an image file from a local file path (sent as JSON body).
 * Body: { "filePath": "C:\\Users\\...\\banner.png" }
 */
router.post('/image/path', (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid filePath in request body.' });
    }

    const result = copyLocalFile(filePath, 'images', ['.png', '.jpg', '.jpeg', '.gif', '.webp'], 'image');
    console.log(`[Upload] Image copied: ${result.originalName} → ${result.filename} (${(result.size / 1024).toFixed(1)}KB)`);

    res.json({
      path: `/images/${result.filename}`,
      filename: result.originalName,
    });
  } catch (error) {
    const status = error.status || 500;
    console.error('[Upload] Error copying image from path:', error.message);
    res.status(status).json({ error: error.message || 'Failed to copy image file' });
  }
});

// ---------------------------------------------------------------------------
// Sound Management Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/upload/sounds
 * List all uploaded sound files with metadata.
 */
router.get('/sounds', (req, res) => {
  try {
    const dir = path.join(getDataDir(), 'sounds');
    ensureDir(dir);

    const allowedExts = ['.mp3', '.wav', '.ogg'];
    const files = fs.readdirSync(dir);
    const sounds = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return allowedExts.includes(ext);
      })
      .map((file) => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: `/sounds/${file}`,
          size: stats.size,
          uploaded: stats.mtime.toISOString(),
        };
      })
      // Most recently uploaded first
      .sort((a, b) => b.uploaded.localeCompare(a.uploaded));

    res.json({ sounds });
  } catch (error) {
    console.error('[Upload] Error listing sounds:', error);
    res.status(500).json({ error: 'Failed to list sounds' });
  }
});

/**
 * DELETE /api/upload/sound/:filename
 * Delete an uploaded sound file by filename.
 * Validates the filename to prevent directory traversal attacks.
 */
router.delete('/sound/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    // Prevent directory traversal
    if (
      !filename ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('\0')
    ) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    // Verify it has an allowed audio extension
    const ext = path.extname(filename).toLowerCase();
    if (!['.mp3', '.wav', '.ogg'].includes(ext)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    const filePath = path.join(getDataDir(), 'sounds', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Sound file not found' });
    }

    fs.unlinkSync(filePath);
    console.log(`[Upload] Sound deleted: ${filename}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Upload] Error deleting sound:', error);
    res.status(500).json({ error: 'Failed to delete sound' });
  }
});

// ---------------------------------------------------------------------------
// Image Management Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/upload/images
 * List all uploaded image files with metadata.
 */
router.get('/images', (req, res) => {
  try {
    const dir = path.join(getDataDir(), 'images');
    ensureDir(dir);

    const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const files = fs.readdirSync(dir);
    const images = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return allowedExts.includes(ext);
      })
      .map((file) => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          path: `/images/${file}`,
          size: stats.size,
          uploaded: stats.mtime.toISOString(),
        };
      })
      // Most recently uploaded first
      .sort((a, b) => b.uploaded.localeCompare(a.uploaded));

    res.json({ images });
  } catch (error) {
    console.error('[Upload] Error listing images:', error);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

/**
 * DELETE /api/upload/image/:filename
 * Delete an uploaded image file by filename.
 * Validates the filename to prevent directory traversal attacks.
 */
router.delete('/image/:filename', (req, res) => {
  try {
    const { filename } = req.params;

    // Prevent directory traversal
    if (
      !filename ||
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('\0')
    ) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    // Verify it has an allowed image extension
    const ext = path.extname(filename).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    const filePath = path.join(getDataDir(), 'images', filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Image file not found' });
    }

    fs.unlinkSync(filePath);
    console.log(`[Upload] Image deleted: ${filename}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Upload] Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;
