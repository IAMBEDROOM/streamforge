/**
 * AlertPreview — Preview component for the alert editor.
 *
 * Triggers a test alert through the queue system using the current
 * editor form values, so the streamer can see what the alert will
 * look like on the overlay.
 */

import { useState, useCallback } from "react";
import { Eye, Check, AlertCircle, Loader2 } from "lucide-react";
import { triggerTestAlertQueue } from "../../api/alertApi";
import type { AlertType } from "../../api/alertApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlertPreviewProps {
  /** Current form values to use for the test alert. */
  formValues: {
    type?: AlertType;
    message_template?: string;
    duration_ms?: number;
    animation_in?: string;
    animation_out?: string;
    sound_path?: string | null;
    sound_volume?: number;
    image_path?: string | null;
    font_family?: string;
    font_size?: number;
    text_color?: string;
    bg_color?: string | null;
    custom_css?: string | null;
    tts_enabled?: number;
    tts_voice?: string | null;
    tts_rate?: number;
    tts_pitch?: number;
    tts_volume?: number;
  };
  /** Whether the preview button should be disabled (e.g. form is invalid). */
  disabled?: boolean;
}

type PreviewState = "idle" | "sending" | "success" | "error";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AlertPreview({
  formValues,
  disabled = false,
}: AlertPreviewProps) {
  const [state, setState] = useState<PreviewState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePreview = useCallback(async () => {
    setState("sending");
    setErrorMsg(null);

    try {
      const previewType = formValues.type || "follow";
      const previewUsername = "PreviewUser";
      const previewAmount =
        previewType === "cheer" ? 100 : previewType === "donation" ? 5 : null;

      // Build a preview message by filling in the template variables,
      // so TTS reads exactly what appears on screen.
      const previewMessage = formValues.tts_enabled
        ? (formValues.message_template || "{username} triggered an alert!")
            .replace(/\{username\}/g, previewUsername)
            .replace(/\{amount\}/g, previewAmount != null ? String(previewAmount) : "")
            .replace(/\{message\}/g, "")
            .trim()
        : null;

      await triggerTestAlertQueue({
        type: previewType,
        username: previewUsername,
        displayName: previewUsername,
        amount: previewAmount,
        message: previewMessage,
        config: {
          message_template: formValues.message_template || "{username} triggered an alert!",
          duration_ms: formValues.duration_ms || 5000,
          animation_in: formValues.animation_in as never,
          animation_out: formValues.animation_out as never,
          sound_path: formValues.sound_path,
          sound_volume: formValues.sound_volume,
          image_path: formValues.image_path,
          font_family: formValues.font_family,
          font_size: formValues.font_size,
          text_color: formValues.text_color,
          bg_color: formValues.bg_color,
          custom_css: formValues.custom_css,
          tts_enabled: formValues.tts_enabled,
          tts_voice: formValues.tts_voice,
          tts_rate: formValues.tts_rate,
          tts_pitch: formValues.tts_pitch,
          tts_volume: formValues.tts_volume,
        } as never,
      });

      setState("success");
      setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to send preview"
      );
      setState("error");
      setTimeout(() => {
        setState("idle");
        setErrorMsg(null);
      }, 3000);
    }
  }, [formValues]);

  const buttonContent = () => {
    switch (state) {
      case "sending":
        return (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending...
          </>
        );
      case "success":
        return (
          <>
            <Check className="h-4 w-4" />
            Sent!
          </>
        );
      case "error":
        return (
          <>
            <AlertCircle className="h-4 w-4" />
            Failed
          </>
        );
      default:
        return (
          <>
            <Eye className="h-4 w-4" />
            Preview
          </>
        );
    }
  };

  const buttonColors: Record<PreviewState, string> = {
    idle: "border-panel-border bg-panel-bg text-gray-300 hover:border-sf-primary hover:text-white",
    sending: "border-panel-border bg-panel-bg text-gray-400 cursor-wait",
    success: "border-green-600/50 bg-green-600/10 text-green-400",
    error: "border-red-600/50 bg-red-600/10 text-red-400",
  };

  return (
    <div>
      <button
        type="button"
        onClick={handlePreview}
        disabled={disabled || state === "sending" || state === "success"}
        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${buttonColors[state]}`}
      >
        {buttonContent()}
      </button>
      {errorMsg && (
        <p className="mt-1 text-xs text-red-400">{errorMsg}</p>
      )}
    </div>
  );
}
