import { Activity, Users, Bell, Wifi, Monitor } from "lucide-react";
import PageHeader from "../components/PageHeader";
import TestAlertPanel from "../components/TestAlertPanel";
import BrowserSourceUrl from "../components/BrowserSourceUrl";
import { getServerUrl } from "../api/config";

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="rounded-xl border border-panel-border bg-panel-surface p-5 transition-colors hover:border-panel-border/80">
      <div className="mb-3 flex items-center gap-2 text-gray-400">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{subtext}</p>
    </div>
  );
}

function Dashboard() {
  return (
    <div>
      <PageHeader title="Dashboard" />

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Wifi}
          label="Status"
          value="Offline"
          subtext="Connect a platform to go live"
        />
        <StatCard
          icon={Users}
          label="Viewers"
          value="--"
          subtext="No active stream"
        />
        <StatCard
          icon={Bell}
          label="Alerts Today"
          value="0"
          subtext="No alerts triggered yet"
        />
        <StatCard
          icon={Activity}
          label="Events"
          value="0"
          subtext="No events recorded"
        />
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-panel-border bg-panel-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Getting Started
        </h2>
        <div className="space-y-3 text-sm text-gray-400">
          <p>Welcome to StreamForge! Here's how to get started:</p>
          <ol className="list-inside list-decimal space-y-2">
            <li>
              Go to <span className="text-sf-primary-light">Settings</span> to
              connect your Twitch or YouTube account
            </li>
            <li>
              Configure your{" "}
              <span className="text-sf-primary-light">Alerts</span> — customise
              notifications for follows, subs, and donations
            </li>
            <li>
              Set up <span className="text-sf-primary-light">Widgets</span> —
              add a chat box, event list, or goal bar to your stream
            </li>
            <li>
              Copy the browser source URLs into OBS to display overlays on your
              stream
            </li>
          </ol>
        </div>
      </div>

      {/* Browser Source URLs */}
      <div className="mt-8 rounded-xl border border-panel-border bg-panel-surface p-6">
        <div className="mb-4 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-sf-primary" />
          <h2 className="text-lg font-semibold text-white">
            Browser Source URLs
          </h2>
        </div>
        <p className="mb-4 text-sm text-gray-400">
          Copy these URLs into OBS Studio as Browser Sources to display overlays
          on your stream.
        </p>

        <div className="mb-5 space-y-3">
          <BrowserSourceUrl
            label="Alert Overlay"
            path="/overlays/alerts/"
            serverUrl={getServerUrl()}
          />
        </div>

        <div className="rounded-lg border border-panel-border bg-panel-bg p-4">
          <h3 className="mb-2 text-sm font-medium text-gray-300">
            OBS Setup Instructions
          </h3>
          <ol className="list-inside list-decimal space-y-1.5 text-xs text-gray-500">
            <li>
              In OBS, click{" "}
              <span className="text-gray-300">Sources &gt; + &gt; Browser</span>
            </li>
            <li>Paste the URL above into the URL field</li>
            <li>
              Set size to{" "}
              <span className="text-gray-300">1920 x 1080</span>
            </li>
            <li>
              Check{" "}
              <span className="text-gray-300">
                "Shutdown source when not visible"
              </span>
            </li>
            <li>
              Check{" "}
              <span className="text-gray-300">
                "Refresh browser when scene becomes active"
              </span>
            </li>
          </ol>
        </div>
      </div>

      {/* Test Your Setup */}
      <div className="mt-8">
        <TestAlertPanel />
      </div>
    </div>
  );
}

export default Dashboard;
