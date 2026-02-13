/**
 * VariationList — Collapsible section within the alert editor for managing
 * alert variations (e.g. different alerts for sub tiers, bit thresholds).
 *
 * Displays all variations for a parent alert, with controls to create,
 * edit, and delete variations. Opens the VariationEditor modal for
 * create/edit operations.
 */

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import type {
  AlertType,
  AlertVariation,
  AlertVariationInput,
} from "../../api/alertApi";
import {
  fetchVariations,
  createVariation,
  updateVariation,
  deleteVariation,
} from "../../api/alertApi";
import VariationEditor from "./VariationEditor";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VariationListProps {
  /** The parent alert ID to load variations for. */
  alertId: string;
  /** The parent alert type — used to set smart condition defaults. */
  alertType: AlertType;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable condition summary. */
function formatCondition(type: string, value: string): string {
  switch (type) {
    case "tier":
      return `Tier ${value}`;
    case "amount":
      return `${value}+`;
    case "custom":
      return value;
    default:
      return value;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VariationList({
  alertId,
  alertType,
}: VariationListProps) {
  const queryClient = useQueryClient();
  const [variations, setVariations] = useState<AlertVariation[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The variation currently being edited, or a blank object for creation
  const [editingVariation, setEditingVariation] =
    useState<Partial<AlertVariation> | null>(null);

  // -----------------------------------------------------------------------
  // Data Loading
  // -----------------------------------------------------------------------

  const loadVariations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchVariations(alertId);
      setVariations(data);
    } catch (err) {
      console.error("Failed to fetch variations:", err);
      setError("Failed to load variations");
    } finally {
      setIsLoading(false);
    }
  }, [alertId]);

  useEffect(() => {
    loadVariations();
  }, [loadVariations]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleCreate = () => {
    // Smart defaults based on alert type
    const defaultConditionType =
      alertType === "subscribe"
        ? "tier"
        : alertType === "cheer" || alertType === "donation"
          ? "amount"
          : "custom";

    setEditingVariation({
      name: "",
      condition_type: defaultConditionType,
      condition_value: "",
      priority: variations.length + 1,
      enabled: 1,
      message_template: null,
      sound_path: null,
      sound_volume: null,
      image_path: null,
      animation_in: null,
      animation_out: null,
      custom_css: null,
    });
  };

  const handleSave = async (data: AlertVariationInput) => {
    try {
      if (editingVariation?.id) {
        await updateVariation(editingVariation.id, data);
      } else {
        await createVariation(alertId, data);
      }
      setEditingVariation(null);
      await loadVariations();
      // Invalidate the parent alerts query so the variations count refreshes
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    } catch (err) {
      console.error("Failed to save variation:", err);
      throw err; // Let the editor show the error
    }
  };

  const handleDelete = async (variationId: string) => {
    try {
      await deleteVariation(variationId);
      await loadVariations();
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    } catch (err) {
      console.error("Failed to delete variation:", err);
    }
  };

  const handleToggleEnabled = async (variation: AlertVariation) => {
    try {
      await updateVariation(variation.id, {
        enabled: variation.enabled === 1 ? 0 : 1,
      });
      await loadVariations();
    } catch (err) {
      console.error("Failed to toggle variation:", err);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <section className="border-t border-panel-border pt-5 mt-6">
      {/* Section header / toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-300"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Layers className="h-4 w-4" />
        Alert Variations
        <span className="text-xs font-normal text-gray-600">
          ({variations.length})
        </span>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-gray-500">
            Create different versions of this alert for specific conditions
            (e.g. sub tiers, bit amounts). Variations override the parent
            alert's settings. Higher priority variations are checked first.
          </p>

          {/* Loading / Error */}
          {isLoading && (
            <p className="text-xs text-gray-500 italic">
              Loading variations...
            </p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Variation Rows */}
          {!isLoading && variations.length === 0 && (
            <p className="text-xs text-gray-600 italic">
              No variations configured. Click "Add Variation" to create one.
            </p>
          )}

          {variations.map((variation) => (
            <div
              key={variation.id}
              className="flex items-center gap-3 rounded-lg border border-panel-border bg-panel-bg px-4 py-3"
            >
              {/* Enabled dot */}
              <button
                type="button"
                onClick={() => handleToggleEnabled(variation)}
                title={
                  variation.enabled ? "Enabled (click to disable)" : "Disabled (click to enable)"
                }
                className="shrink-0"
              >
                <span
                  className={`block h-2 w-2 rounded-full transition-colors ${
                    variation.enabled
                      ? "bg-emerald-400"
                      : "bg-gray-600"
                  }`}
                />
              </button>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-gray-200">
                  {variation.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>
                    {formatCondition(
                      variation.condition_type,
                      variation.condition_value
                    )}
                  </span>
                  <span className="text-gray-700">|</span>
                  <span>Priority: {variation.priority}</span>
                  {variation.sound_path && (
                    <>
                      <span className="text-gray-700">|</span>
                      <span>Custom sound</span>
                    </>
                  )}
                  {variation.image_path && (
                    <>
                      <span className="text-gray-700">|</span>
                      <span>Custom image</span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditingVariation(variation)}
                  className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-panel-hover hover:text-gray-200"
                  title="Edit variation"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(variation.id)}
                  className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                  title="Delete variation"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Add button */}
          <button
            type="button"
            onClick={handleCreate}
            className="flex items-center gap-2 rounded-lg border border-dashed border-panel-border px-4 py-2 text-sm text-gray-400 transition-colors hover:border-sf-primary hover:text-sf-primary"
          >
            <Plus className="h-4 w-4" />
            Add Variation
          </button>
        </div>
      )}

      {/* Variation Editor Modal */}
      {editingVariation && (
        <VariationEditor
          variation={editingVariation}
          alertType={alertType}
          onSave={handleSave}
          onCancel={() => setEditingVariation(null)}
        />
      )}
    </section>
  );
}
