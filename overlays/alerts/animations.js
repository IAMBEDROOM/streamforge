/**
 * StreamForge — Alert Animations (Web Animations API)
 *
 * Provides programmatic animation control via WAAPI. Returns Animation
 * objects whose .finished promise can be awaited for precise lifecycle
 * management (entry → display → exit → cleanup).
 *
 * All animations use GPU-accelerated properties only (transform + opacity).
 * Falls back to fadeIn / fadeOut for unknown animation names.
 */

// eslint-disable-next-line no-var
var Animations = (function () {
  'use strict';

  // -----------------------------------------------------------------------
  // Entry keyframes
  // -----------------------------------------------------------------------

  var entryKeyframes = {
    slideIn: [
      { transform: 'translateY(-100px)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 }
    ],
    fadeIn: [
      { opacity: 0 },
      { opacity: 1 }
    ],
    bounceIn: [
      { transform: 'scale(0.3)', opacity: 0, offset: 0 },
      { transform: 'scale(1.05)', offset: 0.5 },
      { transform: 'scale(0.9)', offset: 0.7 },
      { transform: 'scale(1)', opacity: 1, offset: 1 }
    ],
    popIn: [
      { transform: 'scale(0)', opacity: 0, offset: 0 },
      { transform: 'scale(1.1)', offset: 0.5 },
      { transform: 'scale(1)', opacity: 1, offset: 1 }
    ]
  };

  // -----------------------------------------------------------------------
  // Exit keyframes
  // -----------------------------------------------------------------------

  var exitKeyframes = {
    slideOut: [
      { transform: 'translateY(0)', opacity: 1 },
      { transform: 'translateY(-100px)', opacity: 0 }
    ],
    fadeOut: [
      { opacity: 1 },
      { opacity: 0 }
    ],
    bounceOut: [
      { transform: 'scale(1)', opacity: 1, offset: 0 },
      { transform: 'scale(1.1)', offset: 0.5 },
      { transform: 'scale(0)', opacity: 0, offset: 1 }
    ],
    popOut: [
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(0)', opacity: 0 }
    ]
  };

  // -----------------------------------------------------------------------
  // Duration & easing lookup
  // -----------------------------------------------------------------------

  var entryDurations = {
    slideIn: 500,
    fadeIn: 500,
    bounceIn: 700,
    popIn: 400
  };

  var exitDurations = {
    slideOut: 500,
    fadeOut: 500,
    bounceOut: 600,
    popOut: 300
  };

  var entryEasings = {
    slideIn: 'ease-out',
    fadeIn: 'ease-in-out',
    bounceIn: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    popIn: 'ease-out'
  };

  // Exit animations all use ease-in
  var defaultExitEasing = 'ease-in';

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Play an entry animation on the given element.
   *
   * @param {HTMLElement} element - The DOM element to animate
   * @param {string} animationType - One of: slideIn, fadeIn, bounceIn, popIn
   * @returns {Animation} WAAPI Animation object (await .finished for completion)
   */
  function playEntry(element, animationType) {
    var keyframes = entryKeyframes[animationType] || entryKeyframes.fadeIn;
    var duration = entryDurations[animationType] || 500;
    var easing = entryEasings[animationType] || 'ease-out';

    return element.animate(keyframes, {
      duration: duration,
      easing: easing,
      fill: 'forwards'
    });
  }

  /**
   * Play an exit animation on the given element.
   *
   * @param {HTMLElement} element - The DOM element to animate
   * @param {string} animationType - One of: slideOut, fadeOut, bounceOut, popOut
   * @returns {Animation} WAAPI Animation object (await .finished for completion)
   */
  function playExit(element, animationType) {
    var keyframes = exitKeyframes[animationType] || exitKeyframes.fadeOut;
    var duration = exitDurations[animationType] || 500;

    return element.animate(keyframes, {
      duration: duration,
      easing: defaultExitEasing,
      fill: 'forwards'
    });
  }

  return {
    playEntry: playEntry,
    playExit: playExit
  };
})();
