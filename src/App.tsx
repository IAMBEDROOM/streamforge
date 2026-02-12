import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Alerts from "./pages/Alerts";
import Widgets from "./pages/Widgets";
import Themes from "./pages/Themes";
import Settings from "./pages/Settings";
import { useServerConnection } from "./hooks/useServerConnection";

// ---------------------------------------------------------------------------
// Loading Screen
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-panel-bg text-gray-100">
      <div className="text-center space-y-4">
        <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-gray-600 border-t-sf-primary" />
        <h2 className="text-xl font-semibold">Starting StreamForge</h2>
        <p className="text-sm text-gray-400">
          Launching server and establishing connection...
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error Screen
// ---------------------------------------------------------------------------

function ErrorScreen({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-panel-bg text-gray-100">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
          <svg
            className="h-7 w-7 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Connection Failed</h2>
        <p className="text-sm text-gray-400">{error}</p>
        <button
          onClick={onRetry}
          className="mt-2 rounded-lg bg-sf-primary px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-sf-primary/80"
        >
          Retry Connection
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

function App() {
  const { status, error, retry } = useServerConnection();

  if (status === "connecting") {
    return <LoadingScreen />;
  }

  if (status === "error") {
    return <ErrorScreen error={error ?? "Unknown error"} onRetry={retry} />;
  }

  return (
    <div className="flex h-screen bg-panel-bg text-gray-100">
      <Sidebar connectionStatus={status} />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/widgets" element={<Widgets />} />
          <Route path="/themes" element={<Themes />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
