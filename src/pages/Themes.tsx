import { Palette } from "lucide-react";
import PageHeader from "../components/PageHeader";

function Themes() {
  return (
    <div>
      <PageHeader
        title="Themes"
        breadcrumbs={[{ label: "Themes" }]}
      />

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-panel-border bg-panel-surface py-16">
        <Palette className="mb-4 h-12 w-12 text-gray-600" />
        <h2 className="mb-2 text-lg font-semibold text-gray-300">
          Themes coming soon
        </h2>
        <p className="max-w-md text-center text-sm text-gray-500">
          Customise your overlay themes with colours, fonts, animations, and
          layouts. Create a unique look for your stream.
        </p>
      </div>
    </div>
  );
}

export default Themes;
