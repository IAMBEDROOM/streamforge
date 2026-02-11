import { Settings as SettingsIcon, ExternalLink } from "lucide-react";

function Settings() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-white">Settings</h1>

      <div className="space-y-6">
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
