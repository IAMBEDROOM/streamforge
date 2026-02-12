import { Bell, Plus } from "lucide-react";
import PageHeader from "../components/PageHeader";

function Alerts() {
  return (
    <div>
      <PageHeader
        title="Alerts"
        breadcrumbs={[{ label: "Alerts" }]}
        actions={
          <button className="flex items-center gap-2 rounded-lg bg-sf-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sf-primary-dark">
            <Plus className="h-4 w-4" />
            New Alert
          </button>
        }
      />

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-panel-border bg-panel-surface py-16">
        <Bell className="mb-4 h-12 w-12 text-gray-600" />
        <h2 className="mb-2 text-lg font-semibold text-gray-300">
          No alerts configured
        </h2>
        <p className="max-w-md text-center text-sm text-gray-500">
          Create alerts for follows, subscriptions, donations, raids, and more.
          Each alert can have custom animations, sounds, and styling.
        </p>
      </div>
    </div>
  );
}

export default Alerts;
