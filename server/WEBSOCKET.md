# StreamForge WebSocket Architecture

This document describes the Socket.io WebSocket setup for the StreamForge sidecar server.

## Overview

StreamForge uses [Socket.io](https://socket.io/) on top of the Express HTTP server to provide real-time communication between the server and overlay clients (OBS browser sources), the Tauri dashboard, and widgets.

Each category of client connects to a dedicated **namespace**, which isolates events and allows independent connection tracking.

## Server Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Transport | WebSocket + polling | Socket.io default with upgrade |
| Ping interval | 25,000 ms | Server sends ping every 25s |
| Ping timeout | 60,000 ms | Client must respond within 60s |
| CORS | localhost only | See `server/config.js` for allowed origins |

## Namespaces

### `/alerts` — Alert Overlays

**Purpose:** OBS browser sources displaying follow/sub/donation alerts.

| Event | Direction | Description |
|-------|-----------|-------------|
| `welcome` | server -> client | Sent on connection with namespace info |
| `alert:trigger` | server -> client | A new alert to display |
| `alert:done` | client -> server | Client finished displaying an alert |
| `alert:skip` | client -> server | User skipped the current alert |
| `alert:pause` | client -> server | Pause/unpause the alert queue |
| `alert:paused` | server -> client | Broadcast pause state to all clients |

### `/chat` — Chat Widgets

**Purpose:** OBS browser sources displaying chat messages from Twitch/YouTube.

| Event | Direction | Description |
|-------|-----------|-------------|
| `welcome` | server -> client | Sent on connection with namespace info |
| `chat:message` | server -> client | A new chat message to display |
| `chat:clear` | both | Clear all messages |
| `chat:delete` | both | Delete a specific message by ID |

### `/widgets` — Other Widgets

**Purpose:** OBS browser sources for goal bars, event lists, timers, etc.

| Event | Direction | Description |
|-------|-----------|-------------|
| `welcome` | server -> client | Sent on connection with namespace info |
| `widget:update` | server -> client | Widget data changed |
| `config:changed` | both | Widget configuration was updated |

### `/dashboard` — Dashboard Live Preview

**Purpose:** The Tauri desktop app's dashboard UI for real-time monitoring and control.

| Event | Direction | Description |
|-------|-----------|-------------|
| `welcome` | server -> client | Sent on connection with namespace info |
| `status:update` | server -> client | Server status and client counts |
| `config:changed` | client -> server | Dashboard pushed a config change (forwarded to `/widgets`) |
| `alert:trigger` | client -> server | Dashboard triggered a test alert (forwarded to `/alerts`) |

## Connecting to a Namespace

### URL Format

```
http://127.0.0.1:<port>/<namespace>
```

The server defaults to port `39283` but will auto-detect an available port if busy. The actual port is printed to stdout as `SERVER_PORT=<port>` on startup.

### Client-Side Reconnection Settings

These are the recommended client settings (from `server/config.js`):

| Setting | Value |
|---------|-------|
| `reconnection` | `true` |
| `reconnectionAttempts` | `Infinity` |
| `reconnectionDelay` | `1000` (1 second initial) |
| `reconnectionDelayMax` | `30000` (30 second cap) |
| `randomizationFactor` | `0.5` |

This gives exponential backoff: 1s, ~2s, ~4s, ~8s... up to 30s max, with 50% jitter to prevent thundering herd reconnections.

## Example Client Code

### Browser (with Socket.io client loaded)

```html
<script src="http://127.0.0.1:39283/socket.io/socket.io.js"></script>
<script>
  // Connect to the alerts namespace
  const socket = io('http://127.0.0.1:39283/alerts', {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
  });

  socket.on('connect', () => {
    console.log('Connected to /alerts as', socket.id);
  });

  socket.on('welcome', (data) => {
    console.log('Welcome message:', data);
    // { namespace, socketId, connectedClients, serverTime, message }
  });

  socket.on('alert:trigger', (alert) => {
    console.log('New alert:', alert);
    // { id, type, username, message, timestamp }

    // ... render the alert ...

    // Tell the server when the alert animation is done
    socket.emit('alert:done', { id: alert.id });
  });

  socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
    // Socket.io will auto-reconnect with exponential backoff
  });
</script>
```

### Connecting to Multiple Namespaces

```javascript
const alerts = io('http://127.0.0.1:39283/alerts');
const chat = io('http://127.0.0.1:39283/chat');
const widgets = io('http://127.0.0.1:39283/widgets');

// Each connection is independent — they have separate
// socket IDs, event listeners, and reconnection state.
```

### OBS Browser Source

In OBS, create a Browser Source pointing to your overlay page. The overlay page should include the Socket.io client script and connect to the appropriate namespace. The server also serves the Socket.io client library automatically at `/socket.io/socket.io.js`.

## REST Test Endpoints

These endpoints trigger test events on the WebSocket namespaces. Useful for development and testing without a live Twitch/YouTube connection.

| Endpoint | Method | Namespace | Event Emitted |
|----------|--------|-----------|---------------|
| `/api/test/alert` | POST | `/alerts` | `alert:trigger` |
| `/api/test/chat` | POST | `/chat` | `chat:message` |
| `/api/test/widget` | POST | `/widgets` | `widget:update` |
| `/api/test/dashboard` | POST | `/dashboard` | `status:update` |

All endpoints accept an optional JSON body to override the default test payload. If no body is provided, a sensible default is used.

### Example: Trigger a Test Alert

```bash
# Default test alert
curl -X POST http://127.0.0.1:39283/api/test/alert

# Custom alert
curl -X POST http://127.0.0.1:39283/api/test/alert \
  -H "Content-Type: application/json" \
  -d '{"type":"subscription","username":"BigFan","message":"subscribed at Tier 3!"}'
```

### Status Endpoint

```bash
# Check connected clients per namespace
curl http://127.0.0.1:39283/api/ws/status
```

Response:
```json
{
  "namespaces": ["/alerts", "/chat", "/widgets", "/dashboard"],
  "clients": { "/alerts": 1, "/chat": 0, "/widgets": 2, "/dashboard": 1 },
  "totalClients": 4
}
```

## Testing

### Interactive Test Page

Start the server and open the built-in test page:

```bash
node server/index.js
# Open http://127.0.0.1:39283/test.html in your browser
```

The test page lets you:
- Connect/disconnect from each namespace individually
- See connection status with live indicators
- Trigger test events via the REST API
- View all received events in a real-time log

### Browser Dev Tools

Open your browser console and connect manually:

```javascript
// Load the client (already available if you're on the test page)
const socket = io('http://127.0.0.1:39283/alerts');

socket.onAny((event, ...args) => {
  console.log(`[${event}]`, ...args);
});
```

### PowerShell / curl

```powershell
# Health check
Invoke-RestMethod http://127.0.0.1:39283/api/health

# WebSocket client counts
Invoke-RestMethod http://127.0.0.1:39283/api/ws/status

# Trigger test alert
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:39283/api/test/alert -ContentType "application/json"
```
