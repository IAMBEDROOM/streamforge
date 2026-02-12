/**
 * React hook that manages the connection lifecycle to the sidecar server.
 *
 * 1. Fetches the server port from Tauri (with retries, since the sidecar
 *    needs a moment to start and print its port).
 * 2. Polls the /api/health endpoint until the server responds.
 * 3. Returns the connection status, server URL, and a retry function.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getServerPort } from "../api/config";

export type ConnectionStatus = "connecting" | "connected" | "error";

interface ServerConnectionState {
  status: ConnectionStatus;
  serverUrl: string | null;
  error: string | null;
  retry: () => void;
}

/** Retry delays in ms for each attempt (5 attempts total) */
const RETRY_DELAYS = [500, 1000, 2000, 3000, 5000];

/** Max retries for the port fetch (sidecar needs time to start) */
const PORT_FETCH_RETRIES = 10;
const PORT_FETCH_DELAY = 500; // ms between port fetch attempts

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempts to fetch the server port from Tauri, retrying if the sidecar
 * hasn't printed its port yet.
 */
async function fetchPortWithRetry(
  signal: AbortSignal
): Promise<number> {
  for (let i = 0; i < PORT_FETCH_RETRIES; i++) {
    if (signal.aborted) throw new Error("Aborted");

    try {
      return await getServerPort();
    } catch {
      // Port not available yet -- the sidecar is still starting
      if (i < PORT_FETCH_RETRIES - 1) {
        await sleep(PORT_FETCH_DELAY);
      }
    }
  }
  throw new Error(
    "Timed out waiting for sidecar to report its port. " +
      "The server binary may have failed to start."
  );
}

/**
 * Pings the server's /api/health endpoint with retry + backoff.
 */
async function waitForHealthy(
  serverUrl: string,
  signal: AbortSignal
): Promise<void> {
  for (let i = 0; i < RETRY_DELAYS.length; i++) {
    if (signal.aborted) throw new Error("Aborted");

    try {
      const res = await fetch(`${serverUrl}/api/health`, { signal });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "ok") return;
      }
    } catch {
      // Server not ready yet -- expected during startup
    }

    if (i < RETRY_DELAYS.length - 1) {
      await sleep(RETRY_DELAYS[i]);
    }
  }
  throw new Error(
    "Server started but /api/health is not responding. " +
      "Check the sidecar logs for errors."
  );
}

export function useServerConnection(): ServerConnectionState {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track the current connection attempt so we can abort on unmount/retry
  const abortRef = useRef<AbortController | null>(null);

  const connect = useCallback(async () => {
    // Abort any in-flight attempt
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("connecting");
    setError(null);
    setServerUrl(null);

    try {
      // Step 1: Get the port from Tauri
      const port = await fetchPortWithRetry(controller.signal);
      const url = `http://localhost:${port}`;

      // Step 2: Wait for the server to be healthy
      await waitForHealthy(url, controller.signal);

      if (!controller.signal.aborted) {
        setServerUrl(url);
        setStatus("connected");
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : String(err));
        setStatus("error");
      }
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      abortRef.current?.abort();
    };
  }, [connect]);

  const retry = useCallback(() => {
    connect();
  }, [connect]);

  return { status, serverUrl, error, retry };
}
