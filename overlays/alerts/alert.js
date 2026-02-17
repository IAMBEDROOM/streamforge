/**
 * StreamForge — Alert Display Logic
 *
 * Receives alert:trigger events from the server's /alerts namespace,
 * renders styled alert elements with entry/exit animations, plays
 * sounds via Howler.js, and emits alert:done when complete.
 *
 * Depends on:
 *   - StreamForge.connect() from ../shared/socket-client.js
 *   - Animations.playEntry() / Animations.playExit() from animations.js
 *   - Howl from howler.js (CDN)
 *   - window.ttsManager from tts.js (Web Speech API)
 *
 * Server payload shape (from server/alerts/queue.js):
 *   {
 *     id, type, username, displayName, amount, message, timestamp,
 *     config: {
 *       message_template, duration_ms, animation_in, animation_out,
 *       sound_path, sound_volume, image_path, font_family, font_size,
 *       text_color, bg_color, custom_css, tts_enabled,
 *       tts_voice, tts_rate, tts_pitch, tts_volume
 *     }
 *   }
 */

(function () {
  'use strict';

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  /** Socket.io client connection */
  var client = null;

  /** Currently playing sound (for cleanup) */
  var currentSound = null;

  /** Counter for unique alert element IDs */
  var alertCounter = 0;

  // -----------------------------------------------------------------------
  // Template Processing
  // -----------------------------------------------------------------------

  /**
   * Replace {username}, {amount}, {message} placeholders in a template.
   * Escapes HTML to prevent XSS from user-generated content.
   *
   * @param {string} template - Message template string
   * @param {object} data - Replacement values
   * @returns {string} Processed string (HTML-safe)
   */
  function processTemplate(template, data) {
    if (!template) return '';

    return template
      .replace(/\{username\}/g, escapeHtml(data.username || ''))
      .replace(/\{amount\}/g, escapeHtml(String(data.amount || '')))
      .replace(/\{message\}/g, escapeHtml(data.message || ''));
  }

  /**
   * Escape HTML special characters to prevent XSS.
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // -----------------------------------------------------------------------
  // Sound Playback
  // -----------------------------------------------------------------------

  /**
   * Play an alert sound via Howler.js.
   * Stops any currently playing alert sound first.
   *
   * @param {string} soundPath - URL/path to the sound file
   * @param {number} volume - Volume 0.0 to 1.0
   */
  function playSound(soundPath, volume) {
    if (!soundPath) return;
    if (typeof Howl === 'undefined') {
      console.warn('[Alerts] Howler.js not loaded, skipping sound');
      return;
    }

    if (currentSound) {
      currentSound.stop();
      currentSound = null;
    }

    currentSound = new Howl({
      src: [soundPath],
      volume: typeof volume === 'number' ? volume : 0.8,
      onend: function () {
        currentSound = null;
      },
      onloaderror: function (_id, err) {
        console.warn('[Alerts] Failed to load sound:', soundPath, err);
        currentSound = null;
      }
    });

    currentSound.play();
  }

  // -----------------------------------------------------------------------
  // TTS Message Sanitisation
  // -----------------------------------------------------------------------

  /**
   * Sanitise a message for text-to-speech.
   * Removes URLs, emote patterns, and excessive punctuation that sound
   * unnatural when spoken aloud. Truncates very long messages.
   *
   * @param {string} message - Raw user message
   * @returns {string} Cleaned message suitable for TTS
   */
  function sanitizeMessage(message) {
    if (!message) return '';

    var clean = message;

    // Remove URLs
    clean = clean.replace(/https?:\/\/[^\s]+/g, '');

    // Remove common emote patterns (e.g., :emotename:, emote codes)
    clean = clean.replace(/:[a-zA-Z0-9_]+:/g, '');

    // Remove excessive punctuation (3+ of the same char)
    clean = clean.replace(/([!?.]){3,}/g, '$1');

    // Collapse excessive whitespace
    clean = clean.replace(/\s{2,}/g, ' ');

    // Trim
    clean = clean.trim();

    // Truncate very long messages (TTS is slow for long text)
    if (clean.length > 200) {
      clean = clean.substring(0, 200) + '...';
    }

    return clean;
  }

  /**
   * Speak an alert message via TTS if enabled and available.
   *
   * @param {string} message - Raw user message
   * @param {object} config - Alert config containing TTS settings
   * @returns {Promise<void>}
   */
  function speakMessage(message, config) {
    if (!config.tts_enabled) return Promise.resolve();
    if (!message) return Promise.resolve();

    if (typeof window.ttsManager === 'undefined') {
      console.warn('[Alerts] TTSManager not loaded, skipping TTS');
      return Promise.resolve();
    }

    var cleaned = sanitizeMessage(message);
    if (!cleaned) return Promise.resolve();

    return window.ttsManager.speak(cleaned, {
      voice: config.tts_voice || undefined,
      rate: config.tts_rate || 1.0,
      pitch: config.tts_pitch || 1.0,
      volume: config.tts_volume || 1.0
    }).catch(function (err) {
      console.error('[Alerts] TTS failed:', err);
    });
  }

  // -----------------------------------------------------------------------
  // Alert Display
  // -----------------------------------------------------------------------

  /**
   * Display a single alert with full lifecycle:
   *   1. Create DOM element with styling from config
   *   2. Play entry animation (WAAPI)
   *   3. Play sound (if configured)
   *   4. Wait for duration_ms
   *   5. Play exit animation (WAAPI)
   *   6. Clean up DOM
   *   7. Emit alert:done to server
   *
   * @param {object} alertData - Full alert payload from server
   * @returns {Promise<void>}
   */
  async function displayAlert(alertData) {
    var container = document.getElementById('alert-container');
    if (!container) {
      console.error('[Alerts] #alert-container not found');
      return;
    }

    var config = alertData.config || {};
    var username = alertData.displayName || alertData.username || 'Someone';
    var amount = alertData.amount;
    var message = alertData.message || '';
    var type = alertData.type || 'follow';

    // Generate unique ID for this alert element
    alertCounter++;
    var elementId = 'sf-alert-' + alertCounter;

    // Create alert element
    var alertEl = document.createElement('div');
    alertEl.className = 'alert';
    alertEl.id = elementId;
    alertEl.setAttribute('data-type', type);

    // Apply background color (transparent if null/empty)
    if (config.bg_color) {
      alertEl.style.backgroundColor = config.bg_color;
    } else {
      alertEl.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    }

    // Build alert inner HTML
    var html = '';

    // Image (optional)
    if (config.image_path) {
      html += '<img src="' + escapeHtml(config.image_path) + '" class="alert-image" alt="Alert">';
    }

    // Processed message text
    var text = processTemplate(config.message_template || '{username}', {
      username: username,
      amount: amount,
      message: message
    });

    // Text element with inline styling from config
    var fontFamily = config.font_family || 'Poppins';
    var fontSize = config.font_size || 48;
    var textColor = config.text_color || '#FFFFFF';

    html += '<div class="alert-text" style="'
      + 'font-family: ' + escapeHtml(fontFamily) + ', sans-serif; '
      + 'font-size: ' + fontSize + 'px; '
      + 'color: ' + escapeHtml(textColor) + ';'
      + '">' + text + '</div>';

    alertEl.innerHTML = html;

    // Inject custom CSS if provided (scoped to this alert's ID)
    var customStyleEl = null;
    if (config.custom_css) {
      customStyleEl = document.createElement('style');
      customStyleEl.textContent = '#' + elementId + ' { ' + config.custom_css + ' }';
      document.head.appendChild(customStyleEl);
    }

    // Start invisible (WAAPI will handle the reveal)
    alertEl.style.opacity = '0';

    // Add to DOM
    container.appendChild(alertEl);

    // --- Entry Animation ---
    var animIn = config.animation_in || 'fadeIn';
    var entryAnim = Animations.playEntry(alertEl, animIn);
    await entryAnim.finished;

    // --- Play Sound ---
    if (config.sound_path) {
      playSound(config.sound_path, config.sound_volume);
    }

    // --- TTS + Display Duration (concurrent) ---
    // Run TTS and the display timer in parallel so the alert exits after
    // whichever takes longer. This prevents very long alerts for long
    // messages while still keeping the alert visible during TTS.
    var duration = config.duration_ms || 5000;
    // Speak the rendered template text (what's visible on screen), not just
    // the raw {message} variable. The `text` variable contains the processed
    // template with HTML escaping — strip any HTML tags for clean TTS input.
    var ttsText = text ? text.replace(/<[^>]*>/g, '') : message;
    var ttsPromise = speakMessage(ttsText, config);
    await Promise.all([ttsPromise, sleep(duration)]);

    // --- Exit Animation ---
    var animOut = config.animation_out || 'fadeOut';
    var exitAnim = Animations.playExit(alertEl, animOut);
    await exitAnim.finished;

    // --- Cleanup ---
    alertEl.remove();
    if (customStyleEl) {
      customStyleEl.remove();
    }

    // --- Notify server ---
    if (client) {
      client.emit('alert:done', { alertId: alertData.id || null });
    }

    console.log('[Alerts] Alert complete:', alertData.id, '(' + type + ')');
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  /**
   * Promise-based sleep.
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise<void>}
   */
  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // -----------------------------------------------------------------------
  // Socket.io Connection
  // -----------------------------------------------------------------------

  function init() {
    if (typeof StreamForge === 'undefined') {
      console.error('[Alerts] StreamForge socket client not loaded.');
      return;
    }

    if (typeof Animations === 'undefined') {
      console.error('[Alerts] Animations module not loaded.');
      return;
    }

    client = StreamForge.connect('/alerts');

    if (!client) {
      console.error('[Alerts] Failed to connect to /alerts namespace.');
      return;
    }

    // Welcome message from server
    client.on('welcome', function (data) {
      console.log('[Alerts] ' + data.message);
    });

    // Listen for alert triggers
    client.on('alert:trigger', function (alertData) {
      console.log('[Alerts] Received alert:trigger:', alertData);
      displayAlert(alertData);
    });

    // Listen for pause/resume (future use)
    client.on('alert:paused', function (data) {
      console.log('[Alerts] Pause state:', data.paused);
    });

    console.log('[Alerts] Overlay initialized, waiting for events...');
  }

  // -----------------------------------------------------------------------
  // Startup
  // -----------------------------------------------------------------------

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
