/**
 * AlertEditor — Full alert configuration form.
 *
 * Allows editing all alert fields: name, type, message template,
 * animations, sound, image, styling, and advanced settings.
 * Uses React Hook Form + Zod for validation and Radix UI for
 * interactive primitives.
 */

import { useEffect, useCallback, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import * as Switch from "@radix-ui/react-switch";
import * as Dialog from "@radix-ui/react-dialog";
import * as Slider from "@radix-ui/react-slider";
import { HexColorPicker } from "react-colorful";
import {
  Save,
  Trash2,
  X,
  Upload,
  ImageIcon,
  Music,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import type { Alert, AlertType, AlertInput } from "../../api/alertApi";
import {
  uploadSound,
  uploadImage,
} from "../../api/alertApi";
import { getServerUrl } from "../../api/config";
import AlertPreview from "./AlertPreview";

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const alertSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Max 100 characters"),
  type: z.enum(["follow", "subscribe", "cheer", "raid", "donation", "custom"]),
  enabled: z.boolean(),
  message_template: z
    .string()
    .min(1, "Message template is required")
    .max(500, "Max 500 characters"),
  duration_ms: z
    .number({ error: "Must be a number" })
    .int()
    .min(1000, "Minimum 1000ms")
    .max(60000, "Maximum 60000ms"),
  animation_in: z.enum(["slideIn", "fadeIn", "bounceIn", "popIn"]),
  animation_out: z.enum(["slideOut", "fadeOut", "bounceOut", "popOut"]),
  sound_path: z.string().nullable(),
  sound_volume: z.number().min(0).max(1),
  image_path: z.string().nullable(),
  font_family: z.string().min(1),
  font_size: z
    .number({ error: "Must be a number" })
    .int()
    .min(12, "Minimum 12px")
    .max(200, "Maximum 200px"),
  text_color: z.string(),
  bg_color: z.string().nullable(),
  custom_css: z.string().nullable(),
  min_amount: z.number().min(0).nullable(),
  tts_enabled: z.boolean(),
});

type AlertFormValues = z.infer<typeof alertSchema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALERT_TYPES: { value: AlertType; label: string }[] = [
  { value: "follow", label: "Follow" },
  { value: "subscribe", label: "Subscribe" },
  { value: "cheer", label: "Cheer" },
  { value: "raid", label: "Raid" },
  { value: "donation", label: "Donation" },
  { value: "custom", label: "Custom" },
];

const ANIMATIONS_IN = [
  { value: "slideIn", label: "Slide In" },
  { value: "fadeIn", label: "Fade In" },
  { value: "bounceIn", label: "Bounce In" },
  { value: "popIn", label: "Pop In" },
];

const ANIMATIONS_OUT = [
  { value: "slideOut", label: "Slide Out" },
  { value: "fadeOut", label: "Fade Out" },
  { value: "bounceOut", label: "Bounce Out" },
  { value: "popOut", label: "Pop Out" },
];

const FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Verdana",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Impact",
  "Comic Sans MS",
  "Poppins",
  "Roboto",
  "Open Sans",
  "Montserrat",
  "Lato",
  "Oswald",
  "Raleway",
  "Nunito",
  "Inter",
  "Bangers",
  "Permanent Marker",
  "Press Start 2P",
];

const DEFAULT_VALUES: AlertFormValues = {
  name: "",
  type: "follow",
  enabled: true,
  message_template: "{username} just followed!",
  duration_ms: 5000,
  animation_in: "fadeIn",
  animation_out: "fadeOut",
  sound_path: null,
  sound_volume: 0.8,
  image_path: null,
  font_family: "Arial",
  font_size: 24,
  text_color: "#FFFFFF",
  bg_color: null,
  custom_css: null,
  min_amount: null,
  tts_enabled: false,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AlertEditorProps {
  /** The alert being edited, or null for create mode. */
  alert: Alert | null;
  /** Whether the editor is in "create new" mode. */
  isCreating: boolean;
  /** Called after a successful save (create or update). */
  onSave: (data: AlertInput) => Promise<void>;
  /** Called when user confirms deletion. */
  onDelete: (id: string) => Promise<void>;
  /** Called when dirty state changes (unsaved changes). */
  onDirtyChange?: (dirty: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert an Alert DB record to form values. */
function alertToFormValues(alert: Alert): AlertFormValues {
  return {
    name: alert.name,
    type: alert.type,
    enabled: alert.enabled === 1,
    message_template: alert.message_template || "",
    duration_ms: alert.duration_ms,
    animation_in: (alert.animation_in as AlertFormValues["animation_in"]) || "fadeIn",
    animation_out: (alert.animation_out as AlertFormValues["animation_out"]) || "fadeOut",
    sound_path: alert.sound_path,
    sound_volume: alert.sound_volume ?? 0.8,
    image_path: alert.image_path,
    font_family: alert.font_family || "Arial",
    font_size: alert.font_size ?? 24,
    text_color: alert.text_color || "#FFFFFF",
    bg_color: alert.bg_color,
    custom_css: alert.custom_css,
    min_amount: alert.min_amount,
    tts_enabled: alert.tts_enabled === 1,
  };
}

/** Convert form values to API input shape. */
function formValuesToInput(values: AlertFormValues): AlertInput {
  return {
    ...values,
    enabled: values.enabled ? 1 : 0,
    tts_enabled: values.tts_enabled ? 1 : 0,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Labelled form field wrapper. */
function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-300">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      )}
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

/** Inline color picker with swatch toggle. */
function ColorField({
  value,
  onChange,
  nullable,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  nullable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const displayColor = value || "#000000";

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="h-8 w-8 shrink-0 rounded-md border border-panel-border"
          style={{ backgroundColor: displayColor }}
        />
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={nullable ? "Transparent" : "#FFFFFF"}
          className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-1.5 text-sm text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-sf-primary"
        />
        {nullable && value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Clear
          </button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-2 rounded-lg border border-panel-border bg-panel-surface p-3 shadow-xl">
          <HexColorPicker color={displayColor} onChange={onChange} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full rounded-md bg-panel-hover px-3 py-1 text-xs text-gray-300 hover:text-white"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function AlertEditor({
  alert,
  isCreating,
  onSave,
  onDelete,
  onDirtyChange,
}: AlertEditorProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [soundFilename, setSoundFilename] = useState<string | null>(null);
  const [imageFilename, setImageFilename] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isDirty },
  } = useForm<AlertFormValues>({
    resolver: zodResolver(alertSchema),
    defaultValues: alert ? alertToFormValues(alert) : DEFAULT_VALUES,
  });

  // Watch all values for the preview component
  const watchedValues = watch();

  // Sync dirty state to parent
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Reset form when the alert prop changes (different alert selected)
  useEffect(() => {
    if (alert) {
      reset(alertToFormValues(alert));
      setSoundFilename(
        alert.sound_path ? alert.sound_path.split("/").pop() || null : null
      );
      setImageFilename(
        alert.image_path ? alert.image_path.split("/").pop() || null : null
      );
    } else if (isCreating) {
      reset(DEFAULT_VALUES);
      setSoundFilename(null);
      setImageFilename(null);
    }
  }, [alert, isCreating, reset]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const onSubmit = useCallback(
    async (values: AlertFormValues) => {
      setIsSaving(true);
      try {
        await onSave(formValuesToInput(values));
        reset(values); // Reset dirty state after save
      } catch {
        // Error handled by parent
      } finally {
        setIsSaving(false);
      }
    },
    [onSave, reset]
  );

  const handleDelete = useCallback(async () => {
    if (!alert) return;
    setIsDeleting(true);
    try {
      await onDelete(alert.id);
      setDeleteDialogOpen(false);
    } catch {
      // Error handled by parent
    } finally {
      setIsDeleting(false);
    }
  }, [alert, onDelete]);

  const handleChooseSound = useCallback(async () => {
    setUploadError(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg"] }],
      });

      if (selected) {
        // Tauri v2 open() returns a string path or null
        const filePath = typeof selected === "string" ? selected : (selected as { path?: string })?.path;
        if (!filePath) return;

        // Read the file and create a File object for upload
        const response = await fetch(`asset://localhost/${filePath}`);
        const blob = await response.blob();
        const filename = filePath.split(/[/\\]/).pop() || "sound.mp3";
        const file = new File([blob], filename, { type: blob.type });

        const result = await uploadSound(file);
        setValue("sound_path", result.path, { shouldDirty: true });
        setSoundFilename(result.filename);
      }
    } catch (err) {
      // If Tauri dialog fails (e.g. running in browser dev mode), show error
      setUploadError(
        `Sound upload failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }, [setValue]);

  const handleChooseImage = useCallback(async () => {
    setUploadError(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
        ],
      });

      if (selected) {
        const filePath = typeof selected === "string" ? selected : (selected as { path?: string })?.path;
        if (!filePath) return;

        const response = await fetch(`asset://localhost/${filePath}`);
        const blob = await response.blob();
        const filename = filePath.split(/[/\\]/).pop() || "image.png";
        const file = new File([blob], filename, { type: blob.type });

        const result = await uploadImage(file);
        setValue("image_path", result.path, { shouldDirty: true });
        setImageFilename(result.filename);
      }
    } catch (err) {
      setUploadError(
        `Image upload failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    }
  }, [setValue]);

  const clearSound = useCallback(() => {
    setValue("sound_path", null, { shouldDirty: true });
    setSoundFilename(null);
  }, [setValue]);

  const clearImage = useCallback(() => {
    setValue("image_path", null, { shouldDirty: true });
    setImageFilename(null);
  }, [setValue]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {isCreating ? "New Alert" : "Edit Alert"}
        </h2>
        {isDirty && (
          <span className="text-xs text-yellow-400">Unsaved changes</span>
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Basic Settings */}
      {/* ----------------------------------------------------------------- */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Basic Settings
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Name */}
          <Field label="Name" error={errors.name?.message}>
            <input
              {...register("name")}
              type="text"
              placeholder="e.g. New Follower Alert"
              className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-sf-primary"
            />
          </Field>

          {/* Type */}
          <Field label="Type">
            <select
              {...register("type")}
              disabled={!isCreating}
              className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary disabled:opacity-50"
            >
              {ALERT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Enabled toggle */}
        <div className="flex items-center gap-3">
          <Controller
            name="enabled"
            control={control}
            render={({ field }) => (
              <Switch.Root
                checked={field.value}
                onCheckedChange={field.onChange}
                className="relative h-6 w-11 rounded-full bg-gray-700 transition-colors data-[state=checked]:bg-sf-primary"
              >
                <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
              </Switch.Root>
            )}
          />
          <span className="text-sm text-gray-300">Enabled</span>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Message */}
      {/* ----------------------------------------------------------------- */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Message
        </h3>

        <Field
          label="Message Template"
          error={errors.message_template?.message}
          hint="Variables: {username}, {amount}, {message}"
        >
          <textarea
            {...register("message_template")}
            rows={3}
            placeholder="{username} just followed!"
            className="w-full resize-y rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-sf-primary"
          />
        </Field>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Animations */}
      {/* ----------------------------------------------------------------- */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Animations
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Animation In">
            <select
              {...register("animation_in")}
              className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary"
            >
              {ANIMATIONS_IN.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Animation Out">
            <select
              {...register("animation_out")}
              className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary"
            >
              {ANIMATIONS_OUT.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Sound */}
      {/* ----------------------------------------------------------------- */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Sound
        </h3>

        <div className="flex items-center gap-3">
          <Music className="h-4 w-4 shrink-0 text-gray-500" />
          {watchedValues.sound_path ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">
                {soundFilename || watchedValues.sound_path}
              </span>
              <button
                type="button"
                onClick={clearSound}
                className="rounded p-1 text-gray-500 hover:bg-panel-hover hover:text-gray-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-sm text-gray-500 italic">No sound</span>
          )}
          <button
            type="button"
            onClick={handleChooseSound}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-panel-border bg-panel-bg px-3 py-1.5 text-sm text-gray-300 transition-colors hover:border-sf-primary hover:text-white"
          >
            <Upload className="h-3.5 w-3.5" />
            Choose File
          </button>
        </div>

        {/* Volume */}
        <Field label={`Volume: ${Math.round(watchedValues.sound_volume * 100)}%`}>
          <Controller
            name="sound_volume"
            control={control}
            render={({ field }) => (
              <Slider.Root
                value={[field.value]}
                onValueChange={([v]) => field.onChange(v)}
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
            )}
          />
        </Field>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Image */}
      {/* ----------------------------------------------------------------- */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Image
        </h3>

        <div className="flex items-center gap-3">
          <ImageIcon className="h-4 w-4 shrink-0 text-gray-500" />
          {watchedValues.image_path ? (
            <div className="flex items-center gap-3">
              {/* Thumbnail preview */}
              <img
                src={`${getServerUrl()}${watchedValues.image_path}`}
                alt="Alert image"
                className="h-10 w-10 rounded-md border border-panel-border object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <span className="text-sm text-gray-300">
                {imageFilename || watchedValues.image_path}
              </span>
              <button
                type="button"
                onClick={clearImage}
                className="rounded p-1 text-gray-500 hover:bg-panel-hover hover:text-gray-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-sm text-gray-500 italic">No image</span>
          )}
          <button
            type="button"
            onClick={handleChooseImage}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-panel-border bg-panel-bg px-3 py-1.5 text-sm text-gray-300 transition-colors hover:border-sf-primary hover:text-white"
          >
            <Upload className="h-3.5 w-3.5" />
            Choose File
          </button>
        </div>
      </section>

      {/* Upload error message */}
      {uploadError && (
        <p className="text-sm text-red-400">{uploadError}</p>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Styling */}
      {/* ----------------------------------------------------------------- */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Styling
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Font Family */}
          <Field label="Font Family">
            <select
              {...register("font_family")}
              className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>

          {/* Font Size */}
          <Field label="Font Size (px)" error={errors.font_size?.message}>
            <input
              {...register("font_size", { valueAsNumber: true })}
              type="number"
              min={12}
              max={200}
              className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary"
            />
          </Field>

          {/* Text Color */}
          <Field label="Text Color">
            <Controller
              name="text_color"
              control={control}
              render={({ field }) => (
                <ColorField
                  value={field.value}
                  onChange={(v) => field.onChange(v || "#FFFFFF")}
                />
              )}
            />
          </Field>

          {/* Background Color */}
          <Field label="Background Color" hint="Leave empty for transparent">
            <Controller
              name="bg_color"
              control={control}
              render={({ field }) => (
                <ColorField
                  value={field.value}
                  onChange={field.onChange}
                  nullable
                />
              )}
            />
          </Field>
        </div>
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Advanced (Collapsible) */}
      {/* ----------------------------------------------------------------- */}
      <section>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-gray-300"
        >
          {showAdvanced ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Advanced
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Duration */}
              <Field
                label="Duration (ms)"
                error={errors.duration_ms?.message}
              >
                <input
                  {...register("duration_ms", { valueAsNumber: true })}
                  type="number"
                  min={1000}
                  max={60000}
                  step={100}
                  className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary"
                />
              </Field>

              {/* Min Amount */}
              <Field
                label="Minimum Amount"
                hint="For cheers/donations only"
                error={errors.min_amount?.message}
              >
                <Controller
                  name="min_amount"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="number"
                      min={0}
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? null
                            : Number(e.target.value)
                        )
                      }
                      placeholder="0"
                      className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-sf-primary"
                    />
                  )}
                />
              </Field>
            </div>

            {/* TTS */}
            <div className="flex items-center gap-3">
              <Controller
                name="tts_enabled"
                control={control}
                render={({ field }) => (
                  <Switch.Root
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="relative h-6 w-11 rounded-full bg-gray-700 transition-colors data-[state=checked]:bg-sf-primary"
                  >
                    <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
                  </Switch.Root>
                )}
              />
              <div>
                <span className="text-sm text-gray-300">
                  Text-to-Speech
                </span>
                <p className="text-xs text-gray-500">
                  Read donation messages aloud
                </p>
              </div>
            </div>

            {/* Custom CSS */}
            <Field label="Custom CSS" hint="Advanced: override alert styles">
              <Controller
                name="custom_css"
                control={control}
                render={({ field }) => (
                  <textarea
                    value={field.value || ""}
                    onChange={(e) =>
                      field.onChange(e.target.value || null)
                    }
                    rows={4}
                    placeholder=".alert-container { /* your CSS here */ }"
                    className="w-full resize-y rounded-lg border border-panel-border bg-panel-bg px-3 py-2 font-mono text-xs text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-sf-primary"
                  />
                )}
              />
            </Field>
          </div>
        )}
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Actions */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center gap-3 border-t border-panel-border pt-4">
        {/* Preview */}
        <AlertPreview
          formValues={{
            type: watchedValues.type,
            message_template: watchedValues.message_template,
            duration_ms: watchedValues.duration_ms,
            animation_in: watchedValues.animation_in,
            animation_out: watchedValues.animation_out,
            sound_path: watchedValues.sound_path,
            sound_volume: watchedValues.sound_volume,
            image_path: watchedValues.image_path,
            font_family: watchedValues.font_family,
            font_size: watchedValues.font_size,
            text_color: watchedValues.text_color,
            bg_color: watchedValues.bg_color,
            custom_css: watchedValues.custom_css,
            tts_enabled: watchedValues.tts_enabled ? 1 : 0,
          }}
        />

        {/* Save */}
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-sf-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sf-primary-dark disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Saving..." : "Save"}
        </button>

        {/* Delete */}
        {!isCreating && alert && (
          <Dialog.Root
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          >
            <Dialog.Trigger asChild>
              <button
                type="button"
                className="ml-auto flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </Dialog.Trigger>

            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=open]:fade-in" />
              <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-panel-border bg-panel-surface p-6 shadow-2xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <Dialog.Title className="text-base font-semibold text-white">
                      Delete Alert
                    </Dialog.Title>
                    <Dialog.Description className="text-sm text-gray-400">
                      This action cannot be undone.
                    </Dialog.Description>
                  </div>
                </div>

                <p className="mb-6 text-sm text-gray-300">
                  Are you sure you want to delete{" "}
                  <strong className="text-white">{alert.name}</strong>? This
                  will also remove all its variations.
                </p>

                <div className="flex justify-end gap-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-lg border border-panel-border px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-panel-hover"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </div>
    </form>
  );
}
