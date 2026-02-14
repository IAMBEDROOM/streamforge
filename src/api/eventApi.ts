/**
 * Event History API Client
 *
 * Typed functions for querying the sidecar server's event log endpoints.
 * Used by the History dashboard page for displaying, filtering, and
 * exporting alert history.
 */

import { getServerUrl } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EventType =
  | "follow"
  | "subscribe"
  | "cheer"
  | "raid"
  | "donation"
  | "chat"
  | "custom";

export type Platform = "twitch" | "youtube" | "stripe" | "internal";

export interface EventLog {
  id: string;
  platform: Platform;
  event_type: EventType;
  username: string;
  display_name: string | null;
  amount: number | null;
  message: string | null;
  metadata: string; // JSON string
  alert_fired: number; // 0 | 1
  timestamp: string; // ISO timestamp
}

export interface EventQueryOptions {
  limit?: number;
  event_type?: EventType | "";
  platform?: Platform | "";
  alert_fired_only?: boolean;
  search?: string;
}

interface EventsResponse {
  events: EventLog[];
  count: number;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Fetch recent events with optional filtering.
 */
export async function fetchEvents(
  options: EventQueryOptions = {}
): Promise<EventLog[]> {
  const url = getServerUrl();
  const params = new URLSearchParams();

  if (options.limit) params.append("limit", String(options.limit));
  if (options.event_type) params.append("event_type", options.event_type);
  if (options.platform) params.append("platform", options.platform);
  if (options.alert_fired_only)
    params.append("alert_fired_only", "true");
  if (options.search) params.append("search", options.search);

  const res = await fetch(`${url}/api/events?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch events: ${res.status}`);
  }

  const data: EventsResponse = await res.json();
  return data.events;
}

/**
 * Fetch events within a date range.
 */
export async function fetchEventsByDateRange(
  start: string,
  end: string
): Promise<EventLog[]> {
  const url = getServerUrl();
  const params = new URLSearchParams({ start, end });

  const res = await fetch(`${url}/api/events/range?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch events by range: ${res.status}`);
  }

  const data: EventsResponse = await res.json();
  return data.events;
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

/**
 * Convert an array of event logs to a CSV string.
 */
export function convertEventsToCSV(events: EventLog[]): string {
  const headers = [
    "Timestamp",
    "Type",
    "Username",
    "Display Name",
    "Amount",
    "Message",
    "Platform",
    "Alert Fired",
  ];

  const rows = events.map((e) => [
    e.timestamp,
    e.event_type,
    e.username,
    e.display_name || "",
    e.amount != null ? String(e.amount) : "",
    e.message || "",
    e.platform,
    e.alert_fired ? "Yes" : "No",
  ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
