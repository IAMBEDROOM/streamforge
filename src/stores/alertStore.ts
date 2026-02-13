/**
 * Alert Store (Zustand)
 *
 * Manages UI state for the alert editor: which alert is selected,
 * whether the editor has unsaved changes, and the "new alert" mode.
 *
 * Actual data fetching/caching is handled by React Query — this store
 * only holds ephemeral UI state that doesn't belong in the server cache.
 */

import { create } from "zustand";

interface AlertStore {
  /** Currently selected alert ID (null = nothing selected) */
  selectedAlertId: string | null;

  /** True when the editor is in "create new alert" mode */
  isCreating: boolean;

  /** True when the form has unsaved changes */
  isDirty: boolean;

  /** Select an existing alert for editing */
  selectAlert: (id: string | null) => void;

  /** Enter "create new alert" mode */
  startCreating: () => void;

  /** Exit "create new alert" mode (e.g. after save or cancel) */
  stopCreating: () => void;

  /** Mark the form as having unsaved changes */
  setDirty: (dirty: boolean) => void;
}

const useAlertStore = create<AlertStore>((set) => ({
  selectedAlertId: null,
  isCreating: false,
  isDirty: false,

  selectAlert: (id) =>
    set({ selectedAlertId: id, isCreating: false, isDirty: false }),

  startCreating: () =>
    set({ selectedAlertId: null, isCreating: true, isDirty: false }),

  stopCreating: () => set({ isCreating: false }),

  setDirty: (dirty) => set({ isDirty: dirty }),
}));

export default useAlertStore;
