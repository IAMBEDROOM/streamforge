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

// Placeholder for future overlay static file serving
// app.use('/overlays', express.static(path.join(__dirname, '..', 'overlays')));

// 404 handler for unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

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
// Socket.io Namespaces
// ---------------------------------------------------------------------------

/**
 * /alerts — Alert overlay connections (OBS browser sources)
 * Events: alert:trigger, alert:done, alert:skip, alert:pause
 */
const alertsNsp = io.of('/alerts');
alertsNsp.on('connection', (socket) => {
  console.log(`[Alerts] Client connected: ${socket.id}`);
  socket.on('disconnect', (reason) => {
    console.log(`[Alerts] Client disconnected: ${socket.id} (${reason})`);
  });
});

/**
 * /chat — Chat overlay connections (OBS browser sources)
 * Events: chat:message, chat:clear, chat:delete
 */
const chatNsp = io.of('/chat');
chatNsp.on('connection', (socket) => {
  console.log(`[Chat] Client connected: ${socket.id}`);
  socket.on('disconnect', (reason) => {
    console.log(`[Chat] Client disconnected: ${socket.id} (${reason})`);
  });
});

/**
 * /widgets — Widget overlay connections (OBS browser sources)
 * Events: widget:update, config:changed
 */
const widgetsNsp = io.of('/widgets');
widgetsNsp.on('connection', (socket) => {
  console.log(`[Widgets] Client connected: ${socket.id}`);
  socket.on('disconnect', (reason) => {
    console.log(`[Widgets] Client disconnected: ${socket.id} (${reason})`);
  });
});

/**
 * /dashboard — Dashboard UI connection (Tauri webview)
 * Events: config:changed, alert:trigger (test), status updates
 */
const dashboardNsp = io.of('/dashboard');
dashboardNsp.on('connection', (socket) => {
  console.log(`[Dashboard] Client connected: ${socket.id}`);
  socket.on('disconnect', (reason) => {
    console.log(`[Dashboard] Client disconnected: ${socket.id} (${reason})`);
  });
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
