import { Activity, Users, Bell, Wifi } from "lucide-react";
import PageHeader from "../components/PageHeader";

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
    </div>
  );
}

export default Dashboard;
