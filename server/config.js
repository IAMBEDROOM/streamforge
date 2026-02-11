/**
 * StreamForge Server Configuration
 *
 * Central configuration for the Node.js sidecar server.
 * All configurable values live here for easy modification.
 */

const config = {
  // Server binding
  host: '127.0.0.1', // Localhost only — not accessible from other machines
  defaultPort: 39283, // Default port; auto-detection will try this first

  // Port auto-detection range: if defaultPort is busy, scan this range
  portRange: {
    min: 39283,
    max: 39383, // 100 ports to try before giving up
  },

  // CORS — restricted to localhost only
  cors: {
    origin: [
      'http://localhost:39283',
      'http://127.0.0.1:39283',
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      'tauri://localhost', // Tauri webview origin
      'https://tauri.localhost', // Tauri webview origin (v2)
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  },

  // Socket.io namespaces
  socketNamespaces: ['/alerts', '/chat', '/widgets', '/dashboard'],

  // Socket.io reconnection settings (client-side, documented here for reference)
  socketReconnection: {
    enabled: true,
    attempts: Infinity,
    delay: 1000, // Initial delay in ms
    delayMax: 30000, // Max delay with exponential backoff
    randomizationFactor: 0.5,
  },
};

module.exports = config;
