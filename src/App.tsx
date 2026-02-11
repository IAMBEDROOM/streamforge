import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Alerts from "./pages/Alerts";
import Widgets from "./pages/Widgets";
import Settings from "./pages/Settings";

function App() {
  return (
    <div className="flex h-screen bg-panel-bg text-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/widgets" element={<Widgets />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
