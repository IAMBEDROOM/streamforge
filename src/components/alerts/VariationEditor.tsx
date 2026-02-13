/**
 * VariationEditor — Modal form for creating or editing an alert variation.
 *
 * Provides fields for:
 *   - Name, condition type/value, priority, enabled toggle
 *   - Override fields (sound, image, animation, message, custom CSS)
 *     with clear "leave empty to use parent" messaging
 *
 * Reuses SoundPicker and ImagePicker from the parent alert editor.
 */

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import * as Slider from "@radix-ui/react-slider";
import { X, Save, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import type {
  AlertType,
  AlertVariation,
  AlertVariationInput,
  AnimationIn,
  AnimationOut,
} from "../../api/alertApi";
import SoundPicker from "./SoundPicker";
import ImagePicker from "./ImagePicker";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VariationEditorProps {
  /** Existing variation to edit, or partial object for creation. */
  variation: Partial<AlertVariation>;
  /** Parent alert type — used to configure condition options. */
  alertType: AlertType;
  /** Called when the user saves. Should throw on error. */
  onSave: (data: AlertVariationInput) => Promise<void>;
  /** Called when the user cancels. */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONDITION_OPTIONS: Record<
  string,
  { value: AlertVariation["condition_type"]; label: string }[]
> = {
  subscribe: [
    { value: "tier", label: "Subscription Tier" },
    { value: "amount", label: "Amount" },
    { value: "custom", label: "Custom" },
  ],
  cheer: [
    { value: "amount", label: "Bit Amount" },
    { value: "custom", label: "Custom" },
  ],
  donation: [
    { value: "amount", label: "Donation Amount" },
    { value: "custom", label: "Custom" },
  ],
  raid: [
    { value: "amount", label: "Raider Count" },
    { value: "custom", label: "Custom" },
  ],
  follow: [{ value: "custom", label: "Custom" }],
  custom: [{ value: "custom", label: "Custom" }],
};

const ANIMATIONS_IN: { value: AnimationIn; label: string }[] = [
  { value: "slideIn", label: "Slide In" },
  { value: "fadeIn", label: "Fade In" },
  { value: "bounceIn", label: "Bounce In" },
  { value: "popIn", label: "Pop In" },
];

const ANIMATIONS_OUT: { value: AnimationOut; label: string }[] = [
  { value: "slideOut", label: "Slide Out" },
  { value: "fadeOut", label: "Fade Out" },
  { value: "bounceOut", label: "Bounce Out" },
  { value: "popOut", label: "Pop Out" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getConditionValueLabel(conditionType: string): string {
  switch (conditionType) {
    case "tier":
      return "Tier Number";
    case "amount":
      return "Minimum Amount";
    case "custom":
      return "Custom Value";
    default:
      return "Value";
  }
}

function getConditionValuePlaceholder(conditionType: string): string {
  switch (conditionType) {
    case "tier":
      return "e.g. 1, 2, or 3";
    case "amount":
      return "e.g. 100, 500, 1000";
    case "custom":
      return "e.g. fieldName:value";
    default:
      return "";
  }
}

function getConditionValueHint(conditionType: string): string {
  switch (conditionType) {
    case "tier":
      return "Exact tier match (1 = Tier 1, 2 = Tier 2, 3 = Tier 3)";
    case "amount":
      return "Triggers when the amount is >= this value";
    case "custom":
      return "Free-form condition for custom matching";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VariationEditor({
  variation,
  alertType,
  onSave,
  onCancel,
}: VariationEditorProps) {
  const isEditing = !!variation.id;

  // Form state — start from the variation data
  const [name, setName] = useState(variation.name ?? "");
  const [conditionType, setConditionType] = useState<
    AlertVariation["condition_type"]
  >(variation.condition_type ?? "custom");
  const [conditionValue, setConditionValue] = useState(
    variation.condition_value ?? ""
  );
  const [priority, setPriority] = useState(variation.priority ?? 1);
  const [enabled, setEnabled] = useState(variation.enabled !== 0);

  // Override fields (null = use parent)
  const [messageTemplate, setMessageTemplate] = useState<string | null>(
    variation.message_template ?? null
  );
  const [soundPath, setSoundPath] = useState<string | null>(
    variation.sound_path ?? null
  );
  const [soundVolume, setSoundVolume] = useState<number | null>(
    variation.sound_volume ?? null
  );
  const [imagePath, setImagePath] = useState<string | null>(
    variation.image_path ?? null
  );
  const [animationIn, setAnimationIn] = useState<AnimationIn | null>(
    (variation.animation_in as AnimationIn) ?? null
  );
  const [animationOut, setAnimationOut] = useState<AnimationOut | null>(
    (variation.animation_out as AnimationOut) ?? null
  );
  const [customCss, setCustomCss] = useState<string | null>(
    variation.custom_css ?? null
  );

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showOverrides, setShowOverrides] = useState(
    // Auto-expand overrides if any are set
    !!(
      variation.message_template ||
      variation.sound_path ||
      variation.image_path ||
      variation.animation_in ||
      variation.animation_out ||
      variation.custom_css ||
      variation.sound_volume !== null
    )
  );

  const conditionOptions = CONDITION_OPTIONS[alertType] ?? CONDITION_OPTIONS.custom;

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    // Basic validation
    if (!name.trim()) {
      setSaveError("Name is required");
      return;
    }
    if (!conditionValue.trim()) {
      setSaveError("Condition value is required");
      return;
    }

    const data: AlertVariationInput = {
      name: name.trim(),
      condition_type: conditionType,
      condition_value: conditionValue.trim(),
      priority,
      enabled: enabled ? 1 : 0,
      message_template: messageTemplate,
      sound_path: soundPath,
      sound_volume: soundVolume,
      image_path: imagePath,
      animation_in: animationIn,
      animation_out: animationOut,
      custom_css: customCss,
    };

    setIsSaving(true);
    try {
      await onSave(data);
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save variation"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-panel-border bg-panel-surface shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-panel-border px-6 py-4">
            <Dialog.Title className="text-lg font-semibold text-white">
              {isEditing ? "Edit Variation" : "New Variation"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-panel-hover hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-5">
              {/* ---- Core Fields ---- */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Name */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Variation Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Tier 3 Sub, 1000+ Bits"
                    className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-sf-primary"
                  />
                </div>

                {/* Condition Type */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Condition Type
                  </label>
                  <select
                    value={conditionType}
                    onChange={(e) =>
                      setConditionType(
                        e.target.value as AlertVariation["condition_type"]
                      )
                    }
                    className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary"
                  >
                    {conditionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Condition Value */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    {getConditionValueLabel(conditionType)}
                  </label>
                  <input
                    type={conditionType === "tier" || conditionType === "amount" ? "number" : "text"}
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                    placeholder={getConditionValuePlaceholder(conditionType)}
                    min={conditionType === "tier" ? 1 : conditionType === "amount" ? 0 : undefined}
                    className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-sf-primary"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {getConditionValueHint(conditionType)}
                  </p>
                </div>

                {/* Priority */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-300">
                    Priority
                  </label>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                    min={0}
                    className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Higher priority variations are checked first
                  </p>
                </div>

                {/* Enabled */}
                <div className="flex items-center gap-3 self-end pb-1">
                  <Switch.Root
                    checked={enabled}
                    onCheckedChange={setEnabled}
                    className="relative h-6 w-11 rounded-full bg-gray-700 transition-colors data-[state=checked]:bg-sf-primary"
                  >
                    <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
                  </Switch.Root>
                  <span className="text-sm text-gray-300">Enabled</span>
                </div>
              </div>

              {/* ---- Override Section ---- */}
              <div className="border-t border-panel-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowOverrides(!showOverrides)}
                  className="flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors hover:text-gray-200"
                >
                  {showOverrides ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Override Settings
                  <span className="text-xs font-normal text-gray-600">
                    (leave empty to use parent alert values)
                  </span>
                </button>

                {showOverrides && (
                  <div className="mt-4 space-y-4">
                    {/* Message Template Override */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">
                          Message Template
                        </label>
                        {messageTemplate !== null && (
                          <button
                            type="button"
                            onClick={() => setMessageTemplate(null)}
                            className="text-xs text-gray-500 hover:text-gray-300"
                          >
                            Clear (use parent)
                          </button>
                        )}
                      </div>
                      <textarea
                        value={messageTemplate ?? ""}
                        onChange={(e) =>
                          setMessageTemplate(e.target.value || null)
                        }
                        rows={2}
                        placeholder="Leave empty to use parent's message template"
                        className="w-full resize-y rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-sf-primary"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Variables: {"{username}"}, {"{amount}"}, {"{message}"}
                      </p>
                    </div>

                    {/* Animation Overrides */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-300">
                            Animation In
                          </label>
                          {animationIn !== null && (
                            <button
                              type="button"
                              onClick={() => setAnimationIn(null)}
                              className="text-xs text-gray-500 hover:text-gray-300"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <select
                          value={animationIn ?? ""}
                          onChange={(e) =>
                            setAnimationIn(
                              (e.target.value as AnimationIn) || null
                            )
                          }
                          className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary"
                        >
                          <option value="">Use parent</option>
                          {ANIMATIONS_IN.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-300">
                            Animation Out
                          </label>
                          {animationOut !== null && (
                            <button
                              type="button"
                              onClick={() => setAnimationOut(null)}
                              className="text-xs text-gray-500 hover:text-gray-300"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <select
                          value={animationOut ?? ""}
                          onChange={(e) =>
                            setAnimationOut(
                              (e.target.value as AnimationOut) || null
                            )
                          }
                          className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary"
                        >
                          <option value="">Use parent</option>
                          {ANIMATIONS_OUT.map((a) => (
                            <option key={a.value} value={a.value}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Sound Override */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">
                          Sound
                        </label>
                        {soundPath !== null && (
                          <button
                            type="button"
                            onClick={() => {
                              setSoundPath(null);
                              setSoundVolume(null);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-300"
                          >
                            Clear (use parent)
                          </button>
                        )}
                      </div>
                      <SoundPicker
                        value={soundPath}
                        onChange={(path) => {
                          setSoundPath(path);
                          // If selecting a sound and no volume override, default to 0.8
                          if (path && soundVolume === null) {
                            setSoundVolume(0.8);
                          }
                        }}
                        volume={soundVolume ?? 0.8}
                      />
                      {soundPath && (
                        <div className="mt-2">
                          <label className="mb-1 block text-xs text-gray-400">
                            Volume: {Math.round((soundVolume ?? 0.8) * 100)}%
                          </label>
                          <Slider.Root
                            value={[soundVolume ?? 0.8]}
                            onValueChange={([v]) => setSoundVolume(v)}
                            min={0}
                            max={1}
                            step={0.01}
                            className="relative flex h-5 w-full touch-none select-none items-center"
                          >
                            <Slider.Track className="relative h-1.5 w-full grow rounded-full bg-gray-700">
                              <Slider.Range className="absolute h-full rounded-full bg-sf-primary" />
                            </Slider.Track>
                            <Slider.Thumb className="block h-4 w-4 rounded-full bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-sf-primary" />
                          </Slider.Root>
                        </div>
                      )}
                    </div>

                    {/* Image Override */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">
                          Image
                        </label>
                        {imagePath !== null && (
                          <button
                            type="button"
                            onClick={() => setImagePath(null)}
                            className="text-xs text-gray-500 hover:text-gray-300"
                          >
                            Clear (use parent)
                          </button>
                        )}
                      </div>
                      <ImagePicker
                        value={imagePath}
                        onChange={(path) => setImagePath(path)}
                      />
                    </div>

                    {/* Custom CSS Override */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-300">
                          Custom CSS
                        </label>
                        {customCss !== null && (
                          <button
                            type="button"
                            onClick={() => setCustomCss(null)}
                            className="text-xs text-gray-500 hover:text-gray-300"
                          >
                            Clear (use parent)
                          </button>
                        )}
                      </div>
                      <textarea
                        value={customCss ?? ""}
                        onChange={(e) =>
                          setCustomCss(e.target.value || null)
                        }
                        rows={3}
                        placeholder="Leave empty to use parent's CSS"
                        className="w-full resize-y rounded-lg border border-panel-border bg-panel-bg px-3 py-2 font-mono text-xs text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-sf-primary"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Error */}
              {saveError && (
                <p className="text-sm text-red-400">{saveError}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-panel-border px-6 py-4">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-panel-border px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-panel-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-sf-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sf-primary-dark disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving ? "Saving..." : "Save Variation"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
