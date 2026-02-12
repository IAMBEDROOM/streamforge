import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

interface Breadcrumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
}

function PageHeader({ title, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {/* Breadcrumbs */}
      <nav className="mb-2 flex items-center gap-1 text-sm text-gray-500">
        <Link
          to="/"
          className="flex items-center gap-1 transition-colors hover:text-gray-300"
        >
          <Home className="h-3.5 w-3.5" />
          <span>Home</span>
        </Link>
        {breadcrumbs?.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
            {crumb.to ? (
              <Link
                to={crumb.to}
                className="transition-colors hover:text-gray-300"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="text-gray-400">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      {/* Title + Actions */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
