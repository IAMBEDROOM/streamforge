import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  ExternalLink,
  Monitor,
  Server,
  Database,
  RefreshCw,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import { fetchServerInfo, type ServerInfo } from "../api/config";

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function Settings() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchServerInfo()
      .then((info) => {
        if (!cancelled) setServerInfo(info);
      })
      .catch((err) => {
        if (!cancelled)
          setInfoError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Settings"
        breadcrumbs={[{ label: "Settings" }]}
      />

      <div className="space-y-6">
        {/* Server Information */}
        <section className="rounded-xl border border-panel-border bg-panel-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <Server className="h-5 w-5 text-sf-primary" />
            <h2 className="text-lg font-semibold text-white">
              Server Information
            </h2>
          </div>

          {infoError ? (
            <p className="text-sm text-red-400">
              Failed to load server info: {infoError}
            </p>
          ) : !serverInfo ? (
            <p className="text-sm text-gray-500">Loading server info...</p>
          ) : (
            <div className="space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between rounded-lg border border-panel-border p-3">
                <span className="text-sm text-gray-400">Status</span>
                <span className="flex items-center gap-2 text-sm font-medium text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-400" />
                  Running
                </span>
              </div>

              {/* Port */}
              <div className="flex items-center justify-between rounded-lg border border-panel-border p-3">
                <span className="text-sm text-gray-400">Server Port</span>
                <code className="text-sm text-gray-200">
                  {serverInfo.port}
                </code>
              </div>

              {/* Database Location */}
              <div className="flex items-center justify-between gap-4 rounded-lg border border-panel-border p-3">
                <span className="flex shrink-0 items-center gap-1.5 text-sm text-gray-400">
                  <Database className="h-3.5 w-3.5" />
                  Database
                </span>
                <code className="truncate text-sm text-gray-200" title={serverInfo.dbPath}>
                  {serverInfo.dbPath}
                </code>
              </div>

              {/* Uptime */}
              <div className="flex items-center justify-between rounded-lg border border-panel-border p-3">
                <span className="text-sm text-gray-400">Uptime</span>
                <span className="text-sm text-gray-200">
                  {formatUptime(serverInfo.uptime)}
                </span>
              </div>

              {/* Version */}
              <div className="flex items-center justify-between rounded-lg border border-panel-border p-3">
                <span className="text-sm text-gray-400">Version</span>
                <span className="text-sm text-gray-200">
                  v{serverInfo.version}
                </span>
              </div>

              {/* Restart placeholder */}
              <button
                disabled
                title="Coming soon"
                className="flex items-center gap-2 rounded-lg border border-panel-border px-4 py-2 text-sm text-gray-500 opacity-50 cursor-not-allowed"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Restart Server
              </button>
            </div>
          )}
        </section>

        {/* Platform Connections */}
        <section className="rounded-xl border border-panel-border bg-panel-surface p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Platform Connections
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-panel-border p-4">
              <div>
                <p className="font-medium text-white">Twitch</p>
                <p className="text-sm text-gray-500">Not connected</p>
              </div>
              <button className="flex items-center gap-2 rounded-lg border border-panel-border px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-panel-hover">
                Connect
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-panel-border p-4">
              <div>
                <p className="font-medium text-white">YouTube</p>
                <p className="text-sm text-gray-500">Not connected</p>
              </div>
              <button className="flex items-center gap-2 rounded-lg border border-panel-border px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-panel-hover">
                Connect
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>

        {/* General Settings */}
        <section className="rounded-xl border border-panel-border bg-panel-surface p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">General</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-300">
                  Start on boot
                </p>
                <p className="text-xs text-gray-500">
                  Launch StreamForge when your computer starts
                </p>
              </div>
              <div className="h-6 w-11 rounded-full bg-panel-border" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-300">
                  Minimise to tray
                </p>
                <p className="text-xs text-gray-500">
                  Keep running in the background when the window is closed
                </p>
              </div>
              <div className="h-6 w-11 rounded-full bg-panel-border" />
            </div>
          </div>
        </section>

        {/* System Tray */}
        <section className="rounded-xl border border-panel-border bg-panel-surface p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sf-primary/10">
              <Monitor className="h-5 w-5 text-sf-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                System Tray Integration
              </h2>
              <p className="text-xs text-gray-500">
                Coming in Phase 8 — minimise to tray, quick actions, and
                notifications
              </p>
            </div>
          </div>
        </section>

        {/* About */}
        <section className="rounded-xl border border-panel-border bg-panel-surface p-6">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm text-gray-300">StreamForge v0.1.0</p>
              <p className="text-xs text-gray-500">
                Open source &middot; MIT License
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Settings;
