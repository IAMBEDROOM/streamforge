/**
 * History Page
 *
 * Displays alert history from the event_log table with filtering,
 * searching, and CSV export. Events are fetched from the sidecar
 * server's /api/events endpoint.
 */

import { useState, useEffect, useCallback } from "react";
import { Download, Search, Filter, Clock } from "lucide-react";
import {
  fetchEvents,
  convertEventsToCSV,
  type EventLog,
  type EventQueryOptions,
} from "../api/eventApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleString();
}

const EVENT_TYPE_STYLES: Record<string, string> = {
  follow: "bg-purple-500/20 text-purple-300",
  subscribe: "bg-blue-500/20 text-blue-300",
  cheer: "bg-yellow-500/20 text-yellow-300",
  raid: "bg-red-500/20 text-red-300",
  donation: "bg-green-500/20 text-green-300",
  chat: "bg-gray-500/20 text-gray-300",
  custom: "bg-orange-500/20 text-orange-300",
};

function getEventTypeStyle(type: string): string {
  return EVENT_TYPE_STYLES[type] || "bg-gray-500/20 text-gray-300";
}

function formatAmount(type: string, amount: number): string {
  if (type === "cheer") return `${amount} bits`;
  if (type === "donation") return `$${amount.toFixed(2)}`;
  if (type === "raid") return `${amount} viewers`;
  return String(amount);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function History() {
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<EventQueryOptions>({
    event_type: "",
    platform: "",
    limit: 100,
    search: "",
  });

  // Debounced search — we fetch on filter change, but debounce text input
  const [searchInput, setSearchInput] = useState("");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEvents(filters);
      setEvents(data);
    } catch (err) {
      console.error("Failed to fetch events:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Fetch events when filters change
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Debounce search input → filters.search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput || undefined }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const exportToCSV = () => {
    if (events.length === 0) return;
    const csv = convertEventsToCSV(events);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `streamforge-history-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sf-primary/15">
            <Clock className="h-5 w-5 text-sf-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Alert History</h1>
            <p className="text-sm text-gray-400">
              Recent events and fired alerts (auto-pruned after 7 days)
            </p>
          </div>
        </div>
        <button
          onClick={exportToCSV}
          disabled={events.length === 0}
          className="flex items-center gap-2 rounded-lg bg-sf-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sf-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-400">Filters:</span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search user or message..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="rounded-lg border border-panel-border bg-panel-surface py-2 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-500 outline-none transition-colors focus:border-sf-primary/50"
          />
        </div>

        {/* Event Type */}
        <select
          value={filters.event_type || ""}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, event_type: e.target.value as EventQueryOptions["event_type"] }))
          }
          className="rounded-lg border border-panel-border bg-panel-surface px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary/50"
        >
          <option value="">All Types</option>
          <option value="follow">Follows</option>
          <option value="subscribe">Subscriptions</option>
          <option value="cheer">Cheers</option>
          <option value="raid">Raids</option>
          <option value="donation">Donations</option>
        </select>

        {/* Platform */}
        <select
          value={filters.platform || ""}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, platform: e.target.value as EventQueryOptions["platform"] }))
          }
          className="rounded-lg border border-panel-border bg-panel-surface px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary/50"
        >
          <option value="">All Platforms</option>
          <option value="twitch">Twitch</option>
          <option value="youtube">YouTube</option>
          <option value="stripe">Donations</option>
          <option value="internal">Internal</option>
        </select>

        {/* Limit */}
        <select
          value={filters.limit || 100}
          onChange={(e) =>
            setFilters((prev) => ({ ...prev, limit: parseInt(e.target.value) }))
          }
          className="rounded-lg border border-panel-border bg-panel-surface px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary/50"
        >
          <option value={50}>Last 50</option>
          <option value={100}>Last 100</option>
          <option value={250}>Last 250</option>
          <option value={500}>Last 500</option>
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Event Table */}
      <div className="overflow-hidden rounded-lg border border-panel-border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-panel-border bg-panel-surface">
                <th className="px-4 py-3 text-left font-medium text-gray-400">
                  Time
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-400">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-400">
                  Platform
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-400">
                  User
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-400">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-400">
                  Message
                </th>
                <th className="px-4 py-3 text-center font-medium text-gray-400">
                  Alert
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-sf-primary" />
                      <span>Loading events...</span>
                    </div>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Clock className="h-8 w-8 text-gray-600" />
                      <span>No events yet</span>
                      <span className="text-xs text-gray-600">
                        Events will appear here when alerts are triggered
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-panel-border/50 transition-colors hover:bg-panel-surface/50"
                  >
                    <td
                      className="whitespace-nowrap px-4 py-3 text-gray-400"
                      title={new Date(event.timestamp).toLocaleString()}
                    >
                      {formatTime(event.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${getEventTypeStyle(event.event_type)}`}
                      >
                        {event.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {event.platform}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-200">
                      {event.display_name || event.username}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {event.amount != null
                        ? formatAmount(event.event_type, event.amount)
                        : <span className="text-gray-600">&mdash;</span>}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-gray-400">
                      {event.message || (
                        <span className="text-gray-600">&mdash;</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {event.alert_fired ? (
                        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" title="Alert fired" />
                      ) : (
                        <span className="inline-block h-2 w-2 rounded-full bg-gray-600" title="No alert" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer info */}
      {!loading && events.length > 0 && (
        <p className="text-xs text-gray-600">
          Showing {events.length} event{events.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
