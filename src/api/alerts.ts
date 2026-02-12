/**
 * Alert API client.
 *
 * Functions for communicating with the sidecar server's alert endpoints.
 * Uses the cached server URL from config.ts (safe to call synchronously
 * because App.tsx ensures the server is connected before rendering pages).
 */

import { getServerUrl } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestAlertPayload {
  type: "follow" | "subscribe" | "cheer" | "raid" | "donation";
  username: string;
  message: string;
  duration?: number;
  animation?: "slideIn" | "fadeIn" | "bounceIn" | "popIn";
}

export interface TestAlertResponse {
  status: string;
  event: string;
  namespace: string;
  payload: {
    id: string;
    type: string;
    username: string;
    message: string;
    duration: number;
    animation: string;
    timestamp: string;
  };
  connectedClients: number;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Trigger a test alert on the overlay via the sidecar server.
 *
 * POSTs to /api/test/alert-overlay which emits an alert:trigger event
 * to the /alerts Socket.io namespace. Any connected overlay browser
 * sources will display the alert.
 *
 * @param payload - Alert configuration (type, username, message, etc.)
 * @returns The server's response including the emitted payload and client count
 * @throws On network error or non-ok HTTP response
 */
export async function triggerTestAlert(
  payload: TestAlertPayload
): Promise<TestAlertResponse> {
  const serverUrl = getServerUrl();

  const res = await fetch(`${serverUrl}/api/test/alert-overlay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(
      `Server returned ${res.status}${errorBody ? `: ${errorBody}` : ""}`
    );
  }

  return res.json();
}
