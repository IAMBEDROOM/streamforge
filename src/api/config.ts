/**
 * Server configuration utility.
 *
 * Calls the Tauri `get_server_port` command to discover the sidecar's port,
 * caches it in memory, and exposes helpers for building server URLs.
 */

import { invoke } from "@tauri-apps/api/core";

let cachedPort: number | null = null;

/**
 * Fetch the sidecar server port from Tauri.
 * Caches the result so subsequent calls are instant.
 *
 * @throws If the Tauri command fails (e.g. sidecar hasn't started yet)
 */
export async function getServerPort(): Promise<number> {
  if (cachedPort !== null) {
    return cachedPort;
  }

  const port = await invoke<number>("get_server_port");
  cachedPort = port;
  return port;
}

/**
 * Returns the base URL for the sidecar server.
 * Must only be called after `getServerPort()` has resolved at least once.
 *
 * @throws If the port hasn't been fetched yet
 */
export function getServerUrl(): string {
  if (cachedPort === null) {
    throw new Error(
      "Server port not yet available. Call getServerPort() first."
    );
  }
  return `http://localhost:${cachedPort}`;
}

/**
 * Async version of `getServerUrl()` that fetches the port if needed.
 */
export async function getServerUrlAsync(): Promise<string> {
  const port = await getServerPort();
  return `http://localhost:${port}`;
}

// ---------------------------------------------------------------------------
// Server Info
// ---------------------------------------------------------------------------

export interface ServerInfo {
  status: "running" | "stopped";
  port: number;
  host: string;
  uptime: number;
  version: string;
  dbPath: string;
  overlays: Record<string, string>;
}

/**
 * Fetch detailed server information from the `/api/server/info` endpoint.
 * Requires the server port to have been fetched at least once.
 */
export async function fetchServerInfo(): Promise<ServerInfo> {
  const url = await getServerUrlAsync();
  const res = await fetch(`${url}/api/server/info`);
  if (!res.ok) {
    throw new Error(`Server info request failed: ${res.status}`);
  }
  return res.json();
}
