/**
 * StreamForge — TTS Manager
 *
 * Text-to-speech module using the browser's built-in Web Speech API.
 * Reads donation/tip messages aloud when tts_enabled is true on an alert.
 *
 * Works in OBS browser sources (Chromium-based) and all modern browsers.
 *
 * Usage:
 *   await window.ttsManager.speak('Hello world', { rate: 1.0, pitch: 1.0 });
 *   window.ttsManager.stop();
 */

(function () {
  'use strict';

  /**
   * TTSManager — handles speech synthesis lifecycle.
   * @constructor
   */
  function TTSManager() {
    this.synthesis = window.speechSynthesis;
    this.voices = [];
    this.currentUtterance = null;
    this.unlocked = false;

    // Load voices (may be available immediately or asynchronously)
    this._loadVoices();

    // Some browsers fire this event when voices become available
    var self = this;
    if (typeof this.synthesis.onvoiceschanged !== 'undefined') {
      this.synthesis.onvoiceschanged = function () {
        self._loadVoices();
      };
    }

    // Unlock speech synthesis on first user interaction.
    // Browsers require a user gesture before speechSynthesis.speak() will
    // work. OBS browser sources typically auto-allow audio, but regular
    // browsers (used during testing) block it. We fire a silent utterance
    // on the first click/touch/keypress to unlock it.
    this._setupUnlock();
  }

  /**
   * Load available voices from the browser.
   * @private
   */
  TTSManager.prototype._loadVoices = function () {
    this.voices = this.synthesis.getVoices();
    console.log('[TTS] Loaded voices:', this.voices.length);
  };

  /**
   * Set up automatic unlock of the Speech Synthesis API.
   *
   * Browsers enforce autoplay policy on speechSynthesis.speak() — it must
   * be called from a user gesture at least once before non-gesture calls
   * are allowed. OBS browser sources are generally exempt from this, but
   * regular browser tabs (used during development/testing) are not.
   *
   * This fires a silent zero-length utterance on the first user interaction
   * to unlock the API, then removes the listeners.
   *
   * @private
   */
  TTSManager.prototype._setupUnlock = function () {
    var self = this;

    function unlock() {
      if (self.unlocked) return;

      // Fire a silent utterance to satisfy the user-gesture requirement
      var silent = new SpeechSynthesisUtterance('');
      silent.volume = 0;
      silent.onend = function () {
        self.unlocked = true;
        console.log('[TTS] Speech synthesis unlocked via user gesture');
      };
      silent.onerror = function () {
        // Still mark as attempted — some browsers may reject the empty
        // utterance but will now allow subsequent real ones
        self.unlocked = true;
        console.log('[TTS] Speech synthesis unlock attempted');
      };
      self.synthesis.speak(silent);

      // Clean up listeners
      document.removeEventListener('click', unlock, true);
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    }

    // Listen on capture phase so we catch the very first interaction
    document.addEventListener('click', unlock, true);
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('keydown', unlock, true);

    // Also try unlocking immediately — this works in OBS browser sources
    // and other contexts where autoplay is already permitted
    try {
      var probe = new SpeechSynthesisUtterance('');
      probe.volume = 0;
      probe.onend = function () {
        self.unlocked = true;
        console.log('[TTS] Speech synthesis auto-unlocked (no gesture needed)');
        document.removeEventListener('click', unlock, true);
        document.removeEventListener('touchstart', unlock, true);
        document.removeEventListener('keydown', unlock, true);
      };
      // If this throws or fires an error, that's fine — the gesture
      // listeners above will handle it
      probe.onerror = function () {};
      self.synthesis.speak(probe);
    } catch (e) {
      // Expected in strict autoplay environments — gesture unlock will handle it
    }
  };

  /**
   * Get the list of available voices.
   * @returns {SpeechSynthesisVoice[]}
   */
  TTSManager.prototype.getVoices = function () {
    return this.voices;
  };

  /**
   * Speak the given text with optional configuration.
   *
   * @param {string} text - Text to speak
   * @param {object} [options] - TTS options
   * @param {string} [options.voice] - Voice name to use
   * @param {number} [options.rate=1.0] - Speech rate (0.1 to 10)
   * @param {number} [options.pitch=1.0] - Pitch (0 to 2)
   * @param {number} [options.volume=1.0] - Volume (0 to 1)
   * @returns {Promise<void>} Resolves when speech completes
   */
  TTSManager.prototype.speak = function (text, options) {
    var self = this;
    options = options || {};

    // Nothing to say
    if (!text || !text.trim()) {
      return Promise.resolve();
    }

    // Cancel any ongoing speech
    if (this.currentUtterance) {
      this.synthesis.cancel();
      this.currentUtterance = null;
    }

    // Create utterance
    var utterance = new SpeechSynthesisUtterance(text);

    // Select voice
    if (options.voice) {
      var matchedVoice = this.voices.find(function (v) {
        return v.name === options.voice;
      });
      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }
    } else {
      // Use default voice
      var defaultVoice = this.voices.find(function (v) { return v.default; })
        || this.voices[0];
      if (defaultVoice) {
        utterance.voice = defaultVoice;
      }
    }

    // Apply rate, pitch, volume with sensible clamping
    utterance.rate = typeof options.rate === 'number'
      ? Math.max(0.1, Math.min(10, options.rate)) : 1.0;
    utterance.pitch = typeof options.pitch === 'number'
      ? Math.max(0, Math.min(2, options.pitch)) : 1.0;
    utterance.volume = typeof options.volume === 'number'
      ? Math.max(0, Math.min(1, options.volume)) : 1.0;

    // Return a promise that resolves on end / rejects on error
    return new Promise(function (resolve, reject) {
      utterance.onend = function () {
        self.currentUtterance = null;
        resolve();
      };

      utterance.onerror = function (event) {
        // 'canceled' is not a real error — it happens when we call cancel()
        if (event.error === 'canceled') {
          self.currentUtterance = null;
          resolve();
          return;
        }

        // 'not-allowed' means the browser blocked speech due to autoplay
        // policy. This happens in regular browser tabs when no user gesture
        // has occurred yet. OBS browser sources are typically exempt.
        if (event.error === 'not-allowed') {
          console.warn(
            '[TTS] Speech blocked by browser autoplay policy. '
            + 'Click anywhere on the overlay page to unlock TTS, '
            + 'or use this overlay as an OBS browser source (which auto-allows audio).'
          );
          self.currentUtterance = null;
          resolve(); // Don't reject — this is a recoverable situation
          return;
        }

        console.error('[TTS] Speech error:', event.error);
        self.currentUtterance = null;
        reject(event);
      };

      self.currentUtterance = utterance;
      self.synthesis.speak(utterance);
    });
  };

  /**
   * Stop any ongoing speech immediately.
   */
  TTSManager.prototype.stop = function () {
    this.synthesis.cancel();
    this.currentUtterance = null;
  };

  /**
   * Check if currently speaking.
   * @returns {boolean}
   */
  TTSManager.prototype.isSpeaking = function () {
    return this.synthesis.speaking;
  };

  // -------------------------------------------------------------------------
  // Create global instance
  // -------------------------------------------------------------------------

  window.ttsManager = new TTSManager();
  console.log('[TTS] TTSManager initialized');
})();
