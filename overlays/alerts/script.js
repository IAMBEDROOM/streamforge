/**
 * StreamForge — Alert Overlay Script
 *
 * Connects to the Socket.io /alerts namespace, listens for alert:trigger
 * events, and displays animated alerts one at a time using a FIFO queue.
 *
 * Performance:
 *   - All animations are CSS-only (GPU accelerated)
 *   - Minimal DOM manipulation
 *   - Event listeners are cleaned up to prevent memory leaks
 */

(function () {
  'use strict';

  // -----------------------------------------------------------------------
  // DOM References
  // -----------------------------------------------------------------------

  var container = document.getElementById('alert-container');
  var iconEl = document.getElementById('alert-icon');
  var usernameEl = document.getElementById('alert-username');
  var messageEl = document.getElementById('alert-message');
  var alertBox = container.querySelector('.alert-box');

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  /** @type {Array<object>} FIFO alert queue */
  var queue = [];

  /** Whether an alert is currently being displayed */
  var isShowing = false;

  /** Reference to the dismiss timeout so it can be cleared */
  var dismissTimer = null;

  /** Socket.io client connection */
  var client = null;

  // -----------------------------------------------------------------------
  // Animation Mapping
  // -----------------------------------------------------------------------

  /**
   * Maps animation names from the event data to CSS class names.
   * Entry and exit animations are paired.
   */
  var animations = {
    slideIn:  { enter: 'anim-slideIn',  exit: 'anim-slideOut' },
    fadeIn:   { enter: 'anim-fadeIn',   exit: 'anim-fadeOut' },
    bounceIn: { enter: 'anim-bounceIn', exit: 'anim-fadeOut' },
    popIn:    { enter: 'anim-popIn',    exit: 'anim-fadeOut' },
  };

  /** Default animation if none specified or unrecognized */
  var defaultAnimation = 'slideIn';

  // -----------------------------------------------------------------------
  // Alert Queue
  // -----------------------------------------------------------------------

  /**
   * Add an alert to the queue and start processing if idle.
   * @param {object} data - Alert event data
   */
  function queueAlert(data) {
    queue.push(data);
    console.log('[Alerts] Queued alert (' + queue.length + ' in queue):', data.type);

    if (!isShowing) {
      processQueue();
    }
  }

  /**
   * Process the next alert in the queue.
   * Does nothing if an alert is already showing or the queue is empty.
   */
  function processQueue() {
    if (isShowing || queue.length === 0) {
      return;
    }

    var data = queue.shift();
    showAlert(data);
  }

  // -----------------------------------------------------------------------
  // Show / Dismiss Alert
  // -----------------------------------------------------------------------

  /**
   * Display an alert with the given data.
   * @param {object} data
   * @param {string} [data.type='follow'] - Alert type (follow, subscribe, cheer, raid, donation)
   * @param {string} [data.username='Someone'] - Username to display
   * @param {string} [data.message=''] - Alert message text
   * @param {number} [data.duration=5000] - Display duration in ms
   * @param {string} [data.animation='slideIn'] - Animation name
   */
  function showAlert(data) {
    isShowing = true;

    var type = data.type || 'follow';
    var username = data.username || 'Someone';
    var message = data.message || '';
    var duration = data.duration || 5000;
    var animName = data.animation || defaultAnimation;
    var anim = animations[animName] || animations[defaultAnimation];

    // Populate DOM
    usernameEl.textContent = username;
    messageEl.textContent = message;

    // Set icon type class
    iconEl.className = 'alert-icon ' + type;

    // Clear any previous animation classes
    alertBox.className = 'alert-box';

    // Show the container
    container.classList.add('visible');
    container.setAttribute('aria-hidden', 'false');

    // Force a reflow so the animation starts fresh
    void alertBox.offsetWidth;

    // Apply entry animation
    alertBox.classList.add(anim.enter);

    // Schedule dismiss after duration
    dismissTimer = setTimeout(function () {
      dismissAlert(data, anim);
    }, duration);
  }

  /**
   * Dismiss the currently showing alert with an exit animation.
   * @param {object} data - The original alert data (for alert:done event)
   * @param {object} anim - Animation class pair { enter, exit }
   */
  function dismissAlert(data, anim) {
    dismissTimer = null;

    // Remove entry animation, apply exit animation
    alertBox.classList.remove(anim.enter);

    // Force reflow
    void alertBox.offsetWidth;

    alertBox.classList.add(anim.exit);

    // Listen for the exit animation to complete
    function onAnimEnd() {
      alertBox.removeEventListener('animationend', onAnimEnd);

      // Hide the container
      container.classList.remove('visible');
      container.setAttribute('aria-hidden', 'true');

      // Clean up animation classes
      alertBox.className = 'alert-box';

      isShowing = false;

      // Notify server that this alert is done
      if (client) {
        client.emit('alert:done', {
          id: data.id || null,
          type: data.type || 'follow',
          timestamp: new Date().toISOString(),
        });
      }

      // Process next alert in queue
      processQueue();
    }

    alertBox.addEventListener('animationend', onAnimEnd);
  }

  // -----------------------------------------------------------------------
  // Socket.io Connection
  // -----------------------------------------------------------------------

  function init() {
    if (typeof StreamForge === 'undefined') {
      console.error('[Alerts] StreamForge socket client not loaded.');
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
    client.on('alert:trigger', function (data) {
      console.log('[Alerts] Received alert:trigger:', data);
      queueAlert(data);
    });

    // Listen for pause/resume
    client.on('alert:paused', function (data) {
      console.log('[Alerts] Pause state:', data.paused);
      // Future: implement pause queue processing
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
