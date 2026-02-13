/**
 * StreamForge — File Upload Routes
 *
 * Handles sound and image file uploads via multer.
 * Files are saved to the streamforge-data directory alongside the database.
 *
 * Routes:
 *   POST /api/upload/sound   - Upload an audio file (mp3, wav, ogg)
 *   POST /api/upload/image   - Upload an image file (png, jpg, jpeg, gif, webp)
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

module.exports = router;
