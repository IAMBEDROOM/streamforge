/**
 * StreamForge — Node.js Sidecar Server
 *
 * Entry point for the Express + Socket.io server that runs alongside
 * the Tauri desktop shell. Handles HTTP API, WebSocket connections
 * for real-time overlay events, and serves overlay pages to OBS.
 *
 * Usage:
 *   node server/index.js
 *
 * The server will:
 *   1. Try to bind to the default port (39283)
 *   2. If busy, scan ports 39283–39383 for a free one
 *   3. Print "SERVER_PORT=<port>" to stdout so Tauri can read it
 *   4. Handle graceful shutdown on SIGINT / SIGTERM
 */

const http = require('http');
const net = require('net');
const path = require('path');
const express = require('express');
const { Server: SocketIOServer } = require('socket.io');
const cors = require('cors');
const config = require('./config');

// ---------------------------------------------------------------------------
// Express App Setup
// ---------------------------------------------------------------------------

const app = express();

// Middleware
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve static test page in development
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// HTTP Server + Socket.io Setup
// ---------------------------------------------------------------------------

const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: config.cors,
  // Server-side connection settings
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ---------------------------------------------------------------------------
// Socket.io Namespace Setup
// ---------------------------------------------------------------------------

/**
 * Per-namespace connected client counter.
 * Keys are namespace paths (e.g. '/alerts'), values are current client count.
 */
const clientCounts = {};

/**
 * References to each configured namespace, keyed by path.
 * @type {Object<string, import('socket.io').Namespace>}
 */
const namespaces = {};

/**
 * Per-namespace event listener definitions.
 * Each key is a namespace path. The value is an array of { event, handler }
 * objects that get attached to every connecting socket.
 */
const namespaceEvents = {
  '/alerts': [
    {
      event: 'alert:done',
      handler: (socket, data) => {
        console.log(`[Alerts] alert:done from ${socket.id}:`, data);
      },
    },
    {
      event: 'alert:skip',
      handler: (socket, data) => {
        console.log(`[Alerts] alert:skip from ${socket.id}:`, data);
      },
    },
    {
      event: 'alert:pause',
      handler: (socket, data) => {
        console.log(`[Alerts] alert:pause from ${socket.id}:`, data);
        // Broadcast pause state to all alert clients
        namespaces['/alerts'].emit('alert:paused', { paused: !!data?.paused });
      },
    },
  ],
  '/chat': [
    {
      event: 'chat:clear',
      handler: (socket, _data) => {
        console.log(`[Chat] chat:clear from ${socket.id}`);
        namespaces['/chat'].emit('chat:clear');
      },
    },
    {
      event: 'chat:delete',
      handler: (socket, data) => {
        console.log(`[Chat] chat:delete from ${socket.id}:`, data);
        namespaces['/chat'].emit('chat:delete', data);
      },
    },
  ],
  '/widgets': [
    {
      event: 'config:changed',
      handler: (socket, data) => {
        console.log(`[Widgets] config:changed from ${socket.id}:`, data);
        // Broadcast config change to all widget clients
        namespaces['/widgets'].emit('config:changed', data);
      },
    },
  ],
  '/dashboard': [
    {
      event: 'config:changed',
      handler: (socket, data) => {
        console.log(`[Dashboard] config:changed from ${socket.id}:`, data);
        // Forward config changes to relevant widget clients
        namespaces['/widgets'].emit('config:changed', data);
      },
    },
    {
      event: 'alert:trigger',
      handler: (socket, data) => {
        console.log(`[Dashboard] alert:trigger (test) from ${socket.id}:`, data);
        // Forward test alert to the alerts namespace
        namespaces['/alerts'].emit('alert:trigger', data);
      },
    },
  ],
};

/**
 * Pretty label for log output, derived from namespace path.
 * '/alerts' -> 'Alerts'
 */
function nsLabel(nspath) {
  return nspath.replace('/', '').replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Factory that sets up a Socket.io namespace with:
 *   - Connection/disconnection logging
 *   - Connected client count tracking
 *   - Welcome message on connect
 *   - Per-namespace event listeners
 *
 * @param {string} nspath - Namespace path (e.g. '/alerts')
 */
function setupNamespace(nspath) {
  const label = nsLabel(nspath);
  const nsp = io.of(nspath);
  clientCounts[nspath] = 0;
  namespaces[nspath] = nsp;

  nsp.on('connection', (socket) => {
    clientCounts[nspath]++;
    console.log(
      `[${label}] Client connected: ${socket.id} (${clientCounts[nspath]} connected)`
    );

    // Send welcome message to the newly connected client
    socket.emit('welcome', {
      namespace: nspath,
      socketId: socket.id,
      connectedClients: clientCounts[nspath],
      serverTime: new Date().toISOString(),
      message: `Connected to StreamForge ${label} namespace`,
    });

    // Attach per-namespace event listeners
    const events = namespaceEvents[nspath] || [];
    for (const { event, handler } of events) {
      socket.on(event, (data) => handler(socket, data));
    }

    // Disconnection
    socket.on('disconnect', (reason) => {
      clientCounts[nspath] = Math.max(0, clientCounts[nspath] - 1);
      console.log(
        `[${label}] Client disconnected: ${socket.id} (${reason}) (${clientCounts[nspath]} connected)`
      );
    });
  });

  return nsp;
}

// Initialize all namespaces from config
for (const nspath of config.socketNamespaces) {
  setupNamespace(nspath);
}

// ---------------------------------------------------------------------------
// Test Event Emitters
// ---------------------------------------------------------------------------

/**
 * Emit a test alert to the /alerts namespace.
 * @param {object} [data] - Optional custom payload
 * @returns {object} The emitted payload
 */
function emitTestAlert(data) {
  const payload = data || {
    id: `alert_${Date.now()}`,
    type: 'follow',
    username: 'TestUser',
    message: 'just followed!',
    timestamp: new Date().toISOString(),
  };
  namespaces['/alerts'].emit('alert:trigger', payload);
  console.log('[Test] Emitted alert:trigger to /alerts');
  return payload;
}

/**
 * Emit a test chat message to the /chat namespace.
 * @param {object} [data] - Optional custom payload
 * @returns {object} The emitted payload
 */
function emitTestChat(data) {
  const payload = data || {
    id: `msg_${Date.now()}`,
    username: 'TestChatter',
    message: 'Hello from the test endpoint!',
    color: '#9147ff',
    badges: ['subscriber'],
    timestamp: new Date().toISOString(),
  };
  namespaces['/chat'].emit('chat:message', payload);
  console.log('[Test] Emitted chat:message to /chat');
  return payload;
}

/**
 * Emit a test widget update to the /widgets namespace.
 * @param {object} [data] - Optional custom payload
 * @returns {object} The emitted payload
 */
function emitTestWidget(data) {
  const payload = data || {
    id: `widget_${Date.now()}`,
    widgetType: 'goal-bar',
    data: {
      label: 'Follower Goal',
      current: 42,
      target: 100,
    },
    timestamp: new Date().toISOString(),
  };
  namespaces['/widgets'].emit('widget:update', payload);
  console.log('[Test] Emitted widget:update to /widgets');
  return payload;
}

/**
 * Emit a status update to the /dashboard namespace.
 * @param {object} [data] - Optional custom payload
 * @returns {object} The emitted payload
 */
function emitDashboardStatus(data) {
  const payload = data || {
    connectedClients: { ...clientCounts },
    serverUptime: process.uptime(),
    timestamp: new Date().toISOString(),
  };
  namespaces['/dashboard'].emit('status:update', payload);
  console.log('[Test] Emitted status:update to /dashboard');
  return payload;
}

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------

// Health check endpoint — used by Tauri and for manual testing
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    port: serverPort,
    uptime: process.uptime(),
  });
});

// WebSocket status endpoint — returns connected client counts
app.get('/api/ws/status', (req, res) => {
  res.json({
    namespaces: config.socketNamespaces,
    clients: { ...clientCounts },
    totalClients: Object.values(clientCounts).reduce((sum, n) => sum + n, 0),
  });
});

// ---------------------------------------------------------------------------
// Test API Endpoints
// ---------------------------------------------------------------------------

/**
 * POST /api/test/alert
 * Triggers a test alert event on the /alerts namespace.
 * Accepts optional JSON body to customize the alert payload.
 */
app.post('/api/test/alert', (req, res) => {
  const payload = emitTestAlert(Object.keys(req.body).length ? req.body : undefined);
  res.json({
    status: 'ok',
    event: 'alert:trigger',
    namespace: '/alerts',
    payload,
    connectedClients: clientCounts['/alerts'],
  });
});

/**
 * POST /api/test/chat
 * Triggers a test chat message on the /chat namespace.
 * Accepts optional JSON body to customize the message payload.
 */
app.post('/api/test/chat', (req, res) => {
  const payload = emitTestChat(Object.keys(req.body).length ? req.body : undefined);
  res.json({
    status: 'ok',
    event: 'chat:message',
    namespace: '/chat',
    payload,
    connectedClients: clientCounts['/chat'],
  });
});

/**
 * POST /api/test/widget
 * Triggers a test widget update on the /widgets namespace.
 * Accepts optional JSON body to customize the widget payload.
 */
app.post('/api/test/widget', (req, res) => {
  const payload = emitTestWidget(Object.keys(req.body).length ? req.body : undefined);
  res.json({
    status: 'ok',
    event: 'widget:update',
    namespace: '/widgets',
    payload,
    connectedClients: clientCounts['/widgets'],
  });
});

/**
 * POST /api/test/dashboard
 * Triggers a status update on the /dashboard namespace.
 */
app.post('/api/test/dashboard', (req, res) => {
  const payload = emitDashboardStatus(Object.keys(req.body).length ? req.body : undefined);
  res.json({
    status: 'ok',
    event: 'status:update',
    namespace: '/dashboard',
    payload,
    connectedClients: clientCounts['/dashboard'],
  });
});

// Placeholder for future overlay static file serving
// app.use('/overlays', express.static(path.join(__dirname, '..', 'overlays')));

// 404 handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ---------------------------------------------------------------------------
// Port Auto-Detection
// ---------------------------------------------------------------------------

/**
 * Check if a port is available on the configured host.
 * Creates a temporary TCP server to test the port, then closes it.
 *
 * @param {number} port - Port number to test
 * @returns {Promise<boolean>} - true if the port is free
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, config.host);
  });
}

/**
 * Find an available port, starting with the default and scanning upward.
 *
 * Strategy:
 *   1. Try config.defaultPort (39283)
 *   2. If busy, scan from portRange.min to portRange.max
 *   3. If all ports in range are busy, let the OS assign one (port 0)
 *
 * @returns {Promise<number>} - An available port number
 */
async function findAvailablePort() {
  // Try the default port first
  if (await isPortAvailable(config.defaultPort)) {
    return config.defaultPort;
  }
  console.log(
    `[Server] Default port ${config.defaultPort} is busy, scanning for an available port...`
  );

  // Scan the configured range
  for (
    let port = config.portRange.min;
    port <= config.portRange.max;
    port++
  ) {
    if (port === config.defaultPort) continue; // Already tried
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  // Fallback: let the OS pick any available port
  console.log(
    '[Server] No ports available in configured range, requesting OS-assigned port...'
  );
  return 0;
}

// ---------------------------------------------------------------------------
// Server Startup
// ---------------------------------------------------------------------------

/** The actual port the server is listening on (set after startup). */
let serverPort = null;

async function startServer() {
  try {
    const port = await findAvailablePort();

    httpServer.listen(port, config.host, () => {
      // If port was 0, the OS assigned one — read the actual port
      serverPort = httpServer.address().port;

      // Print port to stdout in the format Tauri expects.
      // This MUST be a clean line so Tauri can parse it reliably.
      console.log(`SERVER_PORT=${serverPort}`);

      console.log(
        `[Server] StreamForge server running at http://${config.host}:${serverPort}`
      );
      console.log(
        `[Server] Health check: http://${config.host}:${serverPort}/api/health`
      );
      console.log(
        `[Server] WebSocket status: http://${config.host}:${serverPort}/api/ws/status`
      );
      console.log(
        `[Server] Test page: http://${config.host}:${serverPort}/test.html`
      );
      console.log(
        `[Server] Socket.io namespaces: ${config.socketNamespaces.join(', ')}`
      );
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

/**
 * Gracefully shut down the server:
 *   1. Close all Socket.io connections
 *   2. Close the HTTP server (stop accepting new connections)
 *   3. Exit the process
 */
function shutdown(signal) {
  console.log(`\n[Server] Received ${signal}, shutting down gracefully...`);

  // Close Socket.io (disconnects all clients)
  io.close(() => {
    console.log('[Server] Socket.io connections closed');

    // Close HTTP server
    httpServer.close(() => {
      console.log('[Server] HTTP server closed');
      process.exit(0);
    });
  });

  // Force exit after 5 seconds if graceful shutdown stalls
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle uncaught errors to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

startServer();
