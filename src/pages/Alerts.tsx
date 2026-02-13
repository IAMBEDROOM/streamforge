/**
 * Alerts Page — Main alert editor interface.
 *
 * Displays all alerts in a sidebar grouped by type and provides a
 * full editor form for creating, editing, previewing, and deleting
 * alert configurations. Uses React Query for data fetching and
 * Zustand for UI state.
 */

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Plus, Loader2, RefreshCw } from "lucide-react";
import PageHeader from "../components/PageHeader";
import AlertList from "../components/alerts/AlertList";
import AlertEditor from "../components/alerts/AlertEditor";
import useAlertStore from "../stores/alertStore";
import {
  fetchAlerts,
  createAlert,
  updateAlert,
  deleteAlertById,
} from "../api/alertApi";
import type { Alert, AlertInput } from "../api/alertApi";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function Alerts() {
  const queryClient = useQueryClient();
  const {
    selectedAlertId,
    isCreating,
    isDirty,
    selectAlert,
    startCreating,
    stopCreating,
    setDirty,
  } = useAlertStore();

  // -------------------------------------------------------------------------
  // Data Fetching
  // -------------------------------------------------------------------------

  const {
    data: alerts = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Alert[]>({
    queryKey: ["alerts"],
    queryFn: fetchAlerts,
  });

  // Find the currently selected alert from the fetched data
  const selectedAlert = selectedAlertId
    ? alerts.find((a) => a.id === selectedAlertId) ?? null
    : null;

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (data: AlertInput) => createAlert(data),
    onSuccess: (newAlert) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      stopCreating();
      selectAlert(newAlert.id);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AlertInput }) =>
      updateAlert(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAlertById(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      selectAlert(null);
    },
  });

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleSave = useCallback(
    async (data: AlertInput) => {
      if (isCreating) {
        await createMutation.mutateAsync(data);
      } else if (selectedAlertId) {
        await updateMutation.mutateAsync({ id: selectedAlertId, data });
      }
    },
    [isCreating, selectedAlertId, createMutation, updateMutation]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation]
  );

  const handleNewAlert = useCallback(() => {
    if (isDirty) {
      // Could add a confirmation dialog here
      // For now, just switch
    }
    startCreating();
  }, [isDirty, startCreating]);

  const handleDirtyChange = useCallback(
    (dirty: boolean) => {
      setDirty(dirty);
    },
    [setDirty]
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Alerts"
        breadcrumbs={[{ label: "Alerts" }]}
        actions={
          <button
            onClick={handleNewAlert}
            className="flex items-center gap-2 rounded-lg bg-sf-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sf-primary-dark"
          >
            <Plus className="h-4 w-4" />
            New Alert
          </button>
        }
      />

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading alerts...</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-red-400">
            Failed to load alerts:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-lg border border-panel-border px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-panel-hover"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && !isError && (
        <div className="flex flex-1 gap-6 overflow-hidden">
          {/* Sidebar */}
          <div className="w-56 shrink-0 overflow-y-auto rounded-xl border border-panel-border bg-panel-surface p-3">
            <AlertList alerts={alerts} />
          </div>

          {/* Editor Panel */}
          <div className="flex-1 overflow-y-auto rounded-xl border border-panel-border bg-panel-surface p-6">
            {selectedAlert || isCreating ? (
              <AlertEditor
                alert={selectedAlert}
                isCreating={isCreating}
                onSave={handleSave}
                onDelete={handleDelete}
                onDirtyChange={handleDirtyChange}
              />
            ) : (
              /* Empty state - no alert selected */
              <div className="flex h-full flex-col items-center justify-center">
                <Bell className="mb-4 h-12 w-12 text-gray-600" />
                <h2 className="mb-2 text-lg font-semibold text-gray-300">
                  Select an alert to edit
                </h2>
                <p className="max-w-sm text-center text-sm text-gray-500">
                  Choose an alert from the sidebar to configure it, or click
                  "New Alert" to create one.
                </p>
              </div>
            )}

            {/* Mutation error messages */}
            {createMutation.isError && (
              <p className="mt-4 text-sm text-red-400">
                Failed to create alert:{" "}
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : "Unknown error"}
              </p>
            )}
            {updateMutation.isError && (
              <p className="mt-4 text-sm text-red-400">
                Failed to update alert:{" "}
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : "Unknown error"}
              </p>
            )}
            {deleteMutation.isError && (
              <p className="mt-4 text-sm text-red-400">
                Failed to delete alert:{" "}
                {deleteMutation.error instanceof Error
                  ? deleteMutation.error.message
                  : "Unknown error"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Alerts;
