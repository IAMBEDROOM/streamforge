/**
 * AlertList — Sidebar component for the alert editor.
 *
 * Displays all alerts grouped by type (Follow, Subscribe, Cheer, Raid,
 * Donation, Custom). Each alert shows its name and enabled/disabled status.
 * Click to select an alert for editing.
 */

import {
  Heart,
  Star,
  Gem,
  Swords,
  DollarSign,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import type { Alert, AlertType } from "../../api/alertApi";
import useAlertStore from "../../stores/alertStore";

// ---------------------------------------------------------------------------
// Type Configuration
// ---------------------------------------------------------------------------

interface TypeConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const ALERT_TYPE_CONFIG: Record<AlertType, TypeConfig> = {
  follow: { label: "Follow", icon: Heart, color: "text-pink-400" },
  subscribe: { label: "Subscribe", icon: Star, color: "text-yellow-400" },
  cheer: { label: "Cheer", icon: Gem, color: "text-purple-400" },
  raid: { label: "Raid", icon: Swords, color: "text-orange-400" },
  donation: { label: "Donation", icon: DollarSign, color: "text-green-400" },
  custom: { label: "Custom", icon: Sparkles, color: "text-blue-400" },
};

/** Ordered list of alert types for display. */
const TYPE_ORDER: AlertType[] = [
  "follow",
  "subscribe",
  "cheer",
  "raid",
  "donation",
  "custom",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AlertListProps {
  alerts: Alert[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AlertList({ alerts }: AlertListProps) {
  const { selectedAlertId, selectAlert } = useAlertStore();

  // Track which type groups are collapsed
  const [collapsed, setCollapsed] = useState<Set<AlertType>>(new Set());

  // Group alerts by type
  const grouped = new Map<AlertType, Alert[]>();
  for (const type of TYPE_ORDER) {
    grouped.set(type, []);
  }
  for (const alert of alerts) {
    const list = grouped.get(alert.type as AlertType);
    if (list) {
      list.push(alert);
    } else {
      // Unknown type → put in custom
      const customList = grouped.get("custom")!;
      customList.push(alert);
    }
  }

  const toggleCollapse = (type: AlertType) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-1">
      {TYPE_ORDER.map((type) => {
        const typeAlerts = grouped.get(type) || [];
        const config = ALERT_TYPE_CONFIG[type];
        const Icon = config.icon;
        const isCollapsed = collapsed.has(type);

        return (
          <div key={type}>
            {/* Type group header */}
            <button
              onClick={() => toggleCollapse(type)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-300"
            >
              {isCollapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
              <Icon className={`h-3.5 w-3.5 ${config.color}`} />
              <span>{config.label}</span>
              <span className="ml-auto text-[10px] text-gray-600">
                {typeAlerts.length}
              </span>
            </button>

            {/* Alert items */}
            {!isCollapsed && (
              <div className="ml-2 flex flex-col gap-0.5">
                {typeAlerts.length === 0 ? (
                  <p className="py-1 pl-5 text-[11px] text-gray-600 italic">
                    No alerts
                  </p>
                ) : (
                  typeAlerts.map((alert) => (
                    <button
                      key={alert.id}
                      onClick={() => selectAlert(alert.id)}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-all duration-100 ${
                        selectedAlertId === alert.id
                          ? "bg-sf-primary/15 text-sf-primary-light"
                          : "text-gray-300 hover:bg-panel-hover hover:text-gray-100"
                      }`}
                    >
                      {/* Enabled indicator dot */}
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          alert.enabled
                            ? "bg-emerald-400"
                            : "bg-gray-600"
                        }`}
                      />
                      <span className="truncate">{alert.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
