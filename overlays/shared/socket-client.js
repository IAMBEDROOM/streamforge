/**
 * StreamForge — Lightweight Socket.io Client Wrapper
 *
 * Shared utility for all overlay browser sources. Provides a minimal
 * wrapper around socket.io-client with auto-connect, reconnection,
 * and clean event handling.
 *
 * Depends on socket.io.min.js being loaded first (global `io`).
 *
 * Usage:
 *   const client = StreamForge.connect('/alerts');
 *   client.on('alert:trigger', (data) => { ... });
 *   client.emit('alert:done', { id: '...' });
 */

// eslint-disable-next-line no-var
var StreamForge = (function () {
  'use strict';

  /**
   * Connect to a Socket.io namespace on the current server.
   *
   * @param {string} namespace - Namespace path (e.g. '/alerts')
   * @param {object} [options] - Additional socket.io client options
   * @returns {{ on, off, emit, disconnect, socket }}
   */
  function connect(namespace, options) {
    if (typeof io === 'undefined') {
      console.error('[StreamForge] socket.io client not loaded. Include socket.io.min.js before this script.');
      return null;
    }

    // Derive server URL from the page's own origin (works in OBS and browser)
    var serverUrl = window.location.origin + (namespace || '/');

    var socket = io(serverUrl, Object.assign({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
    }, options || {}));

    // Connection lifecycle logging
    socket.on('connect', function () {
      console.log('[StreamForge] Connected to ' + namespace + ' (id: ' + socket.id + ')');
    });

    socket.on('disconnect', function (reason) {
      console.log('[StreamForge] Disconnected from ' + namespace + ': ' + reason);
    });

    socket.on('connect_error', function (err) {
      console.warn('[StreamForge] Connection error on ' + namespace + ':', err.message);
    });

    socket.on('reconnect', function (attempt) {
      console.log('[StreamForge] Reconnected to ' + namespace + ' after ' + attempt + ' attempts');
    });

    return {
      /** Subscribe to an event */
      on: function (event, callback) {
        socket.on(event, callback);
        return this;
      },
      /** Unsubscribe from an event */
      off: function (event, callback) {
        socket.off(event, callback);
        return this;
      },
      /** Emit an event to the server */
      emit: function (event, data) {
        socket.emit(event, data);
        return this;
      },
      /** Disconnect from the server */
      disconnect: function () {
        socket.disconnect();
      },
      /** Direct access to the underlying socket.io socket */
      socket: socket,
    };
  }

  return { connect: connect };
})();
