import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Bell,
  Puzzle,
  Settings,
  Radio,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/widgets", icon: Puzzle, label: "Widgets" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function Sidebar() {
  return (
    <aside className="flex h-full w-16 flex-col items-center border-r border-panel-border bg-panel-surface py-4 transition-all duration-200 md:w-56">
      {/* Logo / Brand */}
      <div className="mb-8 flex items-center gap-2 px-3">
        <Radio className="h-7 w-7 text-sf-500" />
        <span className="hidden text-lg font-bold tracking-tight text-white md:block">
          StreamForge
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex w-full flex-1 flex-col gap-1 px-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-sf-600/20 text-sf-400"
                  : "text-gray-400 hover:bg-panel-hover hover:text-gray-200"
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="hidden md:block">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="hidden px-3 md:block">
        <p className="text-xs text-gray-600">v0.1.0</p>
      </div>
    </aside>
  );
}

export default Sidebar;
