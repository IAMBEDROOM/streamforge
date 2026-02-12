import { Puzzle, Plus } from "lucide-react";
import PageHeader from "../components/PageHeader";

function Widgets() {
  return (
    <div>
      <PageHeader
        title="Widgets"
        breadcrumbs={[{ label: "Widgets" }]}
        actions={
          <button className="flex items-center gap-2 rounded-lg bg-sf-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sf-primary-dark">
            <Plus className="h-4 w-4" />
            Add Widget
          </button>
        }
      />

      {/* Widget type grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            name: "Chat Box",
            description: "Display live chat messages on your stream",
          },
          {
            name: "Event List",
            description:
              "Scrolling list of recent follows, subs, and donations",
          },
          {
            name: "Goal Bar",
            description: "Track follower, subscriber, or donation goals",
          },
          {
            name: "Now Playing",
            description: "Show the currently playing song",
          },
          {
            name: "Countdown",
            description: "Stream starting soon or event countdown timer",
          },
          {
            name: "Viewer Count",
            description: "Display your current live viewer count",
          },
        ].map((widget) => (
          <div
            key={widget.name}
            className="group cursor-pointer rounded-xl border border-panel-border bg-panel-surface p-5 transition-colors hover:border-sf-primary/40"
          >
            <div className="mb-2 flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-sf-primary" />
              <h3 className="font-semibold text-white">{widget.name}</h3>
            </div>
            <p className="text-sm text-gray-500">{widget.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Widgets;
