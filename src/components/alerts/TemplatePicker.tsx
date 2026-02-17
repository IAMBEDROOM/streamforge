/**
 * TemplatePicker — Modal for browsing, importing, exporting, and selecting
 * alert templates. Opens as a Radix Dialog overlay.
 *
 * Features:
 *  - Grid of template cards (built-in starred, user-created with user icon)
 *  - "Use Template" applies config to the alert editor
 *  - Export templates as .json files
 *  - Import templates from .json files
 *  - Delete user-created templates (built-in protected)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Download,
  Upload,
  Trash2,
  Star,
  User,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  fetchTemplates,
  createTemplate,
  deleteTemplateById,
} from "../../api/templateApi";
import type {
  AlertTemplate,
  TemplateData,
  TemplateExportData,
} from "../../api/templateApi";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TemplatePickerProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog should close. */
  onOpenChange: (open: boolean) => void;
  /** Called when the user selects a template — receives the parsed config. */
  onSelect: (config: TemplateData) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TemplatePicker({
  open,
  onOpenChange,
  onSelect,
}: TemplatePickerProps) {
  const [templates, setTemplates] = useState<AlertTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Fetch templates when dialog opens
  // -------------------------------------------------------------------------

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTemplates();
      setTemplates(data);
    } catch (err) {
      console.error("[TemplatePicker] Failed to fetch templates:", err);
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open, loadTemplates]);

  // -------------------------------------------------------------------------
  // Select
  // -------------------------------------------------------------------------

  const handleSelect = (template: AlertTemplate) => {
    try {
      const config: TemplateData = JSON.parse(template.template_data);
      onSelect(config);
      onOpenChange(false);
    } catch (err) {
      console.error("[TemplatePicker] Failed to parse template data:", err);
    }
  };

  // -------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------

  const handleExport = (template: AlertTemplate) => {
    try {
      const exportData: TemplateExportData = {
        name: template.name,
        description: template.description,
        author: template.author,
        template_data: JSON.parse(template.template_data),
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${template.name
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[TemplatePicker] Export failed:", err);
    }
  };

  // -------------------------------------------------------------------------
  // Import
  // -------------------------------------------------------------------------

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as TemplateExportData;

      // Validate required fields
      if (!data.name || !data.template_data) {
        throw new Error("Invalid template file: missing name or template_data");
      }

      await createTemplate({
        name: data.name,
        description: data.description || "",
        author: data.author || "Imported",
        template_data: data.template_data,
      });

      await loadTemplates();
    } catch (err) {
      console.error("[TemplatePicker] Import failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to import template"
      );
    } finally {
      setImporting(false);
      // Reset file input so the same file can be re-imported
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // -------------------------------------------------------------------------
  // Delete
  // -------------------------------------------------------------------------

  const handleDelete = async (template: AlertTemplate) => {
    if (template.is_builtin) return;

    try {
      await deleteTemplateById(template.id);
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
    } catch (err) {
      console.error("[TemplatePicker] Delete failed:", err);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-panel-border bg-panel-surface shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-panel-border px-6 py-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-white">
                Alert Templates
              </Dialog.Title>
              <Dialog.Description className="text-sm text-gray-400">
                Load a template to quickly configure an alert, or save your own.
              </Dialog.Description>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleImportClick}
                disabled={importing}
                className="flex items-center gap-2 rounded-lg bg-sf-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sf-primary-dark disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {importing ? "Importing..." : "Import"}
              </button>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-panel-hover hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Hidden file input for import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Body */}
          <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
            {/* Error banner */}
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="ml-auto text-red-400 hover:text-red-300"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading templates...
              </div>
            )}

            {/* Empty state */}
            {!loading && templates.length === 0 && (
              <div className="py-16 text-center text-gray-500">
                <p className="mb-2 text-sm">No templates found.</p>
                <p className="text-xs">
                  Import a template file or save one from the alert editor.
                </p>
              </div>
            )}

            {/* Template grid */}
            {!loading && templates.length > 0 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {templates.map((template) => {
                  let config: TemplateData | null = null;
                  try {
                    config = JSON.parse(template.template_data);
                  } catch {
                    // ignore parse errors
                  }

                  return (
                    <div
                      key={template.id}
                      className="rounded-lg border border-panel-border bg-panel-bg p-4 transition-colors hover:border-gray-600"
                    >
                      {/* Title row */}
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {template.is_builtin ? (
                            <Star className="h-4 w-4 shrink-0 text-yellow-500" />
                          ) : (
                            <User className="h-4 w-4 shrink-0 text-blue-400" />
                          )}
                          <h4 className="text-sm font-semibold text-white">
                            {template.name}
                          </h4>
                        </div>
                        {config && (
                          <span className="rounded-full bg-panel-hover px-2 py-0.5 text-xs text-gray-400">
                            {config.type}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {template.description && (
                        <p className="mb-2 text-xs text-gray-400">
                          {template.description}
                        </p>
                      )}

                      {/* Preview swatch */}
                      {config && (
                        <div
                          className="mb-3 flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium"
                          style={{
                            backgroundColor: config.bg_color || "transparent",
                            color: config.text_color || "#FFFFFF",
                            fontFamily: config.font_family || "Arial",
                            border: config.bg_color
                              ? "none"
                              : "1px dashed rgba(255,255,255,0.2)",
                          }}
                        >
                          {config.message_template?.replace(
                            /\{(\w+)\}/g,
                            "..."
                          ) || "Alert preview"}
                        </div>
                      )}

                      {/* Meta */}
                      <div className="mb-3 text-xs text-gray-500">
                        by {template.author}
                        {template.is_builtin ? (
                          <span className="ml-2 text-yellow-600">Built-in</span>
                        ) : null}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelect(template)}
                          className="flex-1 rounded-lg bg-sf-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sf-primary-dark"
                        >
                          Use Template
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExport(template)}
                          className="rounded-lg border border-panel-border p-2 text-gray-400 transition-colors hover:bg-panel-hover hover:text-white"
                          title="Export as JSON"
                        >
                          <Download className="h-4 w-4" />
                        </button>

                        {!template.is_builtin && (
                          <button
                            type="button"
                            onClick={() => handleDelete(template)}
                            className="rounded-lg border border-red-500/30 p-2 text-red-400 transition-colors hover:bg-red-500/10"
                            title="Delete template"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end border-t border-panel-border px-6 py-4">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-lg border border-panel-border px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-panel-hover"
              >
                Close
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
