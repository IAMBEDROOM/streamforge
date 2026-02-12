import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Bell,
  Puzzle,
  Palette,
  Settings,
  Radio,
} from "lucide-react";
import type { ConnectionStatus } from "../hooks/useServerConnection";

// ---------------------------------------------------------------------------
// Navigation items
// ---------------------------------------------------------------------------

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/widgets", icon: Puzzle, label: "Widgets" },
  { to: "/themes", icon: Palette, label: "Themes" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

// ---------------------------------------------------------------------------
// Status indicator config
// ---------------------------------------------------------------------------

const statusConfig: Record<
  ConnectionStatus,
  { color: string; pulse: boolean; label: string }
> = {
  connecting: {
    color: "bg-yellow-400",
    pulse: true,
    label: "Connecting...",
  },
  connected: {
    color: "bg-emerald-400",
    pulse: false,
    label: "Connected",
  },
  error: {
    color: "bg-red-400",
    pulse: false,
    label: "Disconnected",
  },
};

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

interface SidebarProps {
  connectionStatus: ConnectionStatus;
}

function Sidebar({ connectionStatus }: SidebarProps) {
  const { color, pulse, label } = statusConfig[connectionStatus];

  return (
    <aside className="flex h-full w-16 flex-col border-r border-panel-border bg-panel-surface transition-all duration-200 md:w-60">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 py-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sf-primary/15">
          <Radio className="h-5 w-5 text-sf-primary" />
        </div>
        <div className="hidden md:block">
          <span className="text-lg font-bold tracking-tight text-white">
            StreamForge
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-panel-border" />

      {/* Navigation */}
      <nav className="mt-4 flex flex-1 flex-col gap-1 px-2">
        {navItems.map(({ to, icon: Icon, label: navLabel }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-sf-primary/15 text-sf-primary-light"
                  : "text-gray-400 hover:bg-panel-hover hover:text-gray-200"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`h-5 w-5 shrink-0 transition-colors duration-150 ${
                    isActive ? "text-sf-primary" : ""
                  }`}
                />
                <span className="hidden md:block">{navLabel}</span>
                {isActive && (
                  <div className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-sf-accent md:block" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Server status indicator */}
      <div className="mx-3 border-t border-panel-border" />
      <div className="flex items-center gap-3 px-4 py-4">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {pulse && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-75`}
            />
          )}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`}
          />
        </span>
        <div className="hidden md:block">
          <p className="text-xs font-medium text-gray-300">{label}</p>
          <p className="text-[10px] text-gray-600">Sidecar server</p>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
