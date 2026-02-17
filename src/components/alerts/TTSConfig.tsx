/**
 * TTSConfig — Text-to-speech configuration section for the alert editor.
 *
 * Collapsible panel with enable/disable toggle, voice selection,
 * rate, pitch, and volume sliders. Uses the browser's Web Speech API
 * for voice enumeration (where available) plus common fallback names.
 */

import { useState, useEffect } from "react";
import { Volume2, ChevronDown, ChevronRight } from "lucide-react";
import * as Switch from "@radix-ui/react-switch";
import * as Slider from "@radix-ui/react-slider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TTSConfigProps {
  /** Whether TTS is enabled for this alert. */
  enabled: boolean;
  /** Current TTS voice name (null = browser default). */
  voice: string | null;
  /** Speech rate (0.5–2.0). */
  rate: number;
  /** Speech pitch (0.5–2.0). */
  pitch: number;
  /** Speech volume (0.0–1.0). */
  volume: number;
  /** Called when any TTS setting changes. */
  onChange: (changes: {
    tts_enabled?: boolean;
    tts_voice?: string | null;
    tts_rate?: number;
    tts_pitch?: number;
    tts_volume?: number;
  }) => void;
}

// ---------------------------------------------------------------------------
// Common voice options (fallback when browser voices unavailable)
// ---------------------------------------------------------------------------

const COMMON_VOICES = [
  { name: "Default (browser)", value: "" },
  { name: "Microsoft David Desktop", value: "Microsoft David Desktop" },
  { name: "Microsoft Zira Desktop", value: "Microsoft Zira Desktop" },
  { name: "Microsoft Mark", value: "Microsoft Mark" },
  { name: "Google US English", value: "Google US English" },
  { name: "Google UK English Female", value: "Google UK English Female" },
  { name: "Google UK English Male", value: "Google UK English Male" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TTSConfig({
  enabled,
  voice,
  rate,
  pitch,
  volume,
  onChange,
}: TTSConfigProps) {
  const [expanded, setExpanded] = useState(false);
  const [voices, setVoices] = useState(COMMON_VOICES);

  // Try to load real browser voices (works in the dashboard if Speech API
  // is available — won't work in all environments but degrades gracefully).
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    function loadVoices() {
      const synth = window.speechSynthesis;
      const available = synth.getVoices();
      if (available.length > 0) {
        const voiceOptions = [
          { name: "Default (browser)", value: "" },
          ...available.map((v) => ({
            name: v.name + (v.lang ? ` (${v.lang})` : ""),
            value: v.name,
          })),
        ];
        setVoices(voiceOptions);
      }
    }

    loadVoices();

    // Some browsers load voices asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  return (
    <div className="border-t border-panel-border pt-4 mt-4">
      {/* Header row: toggle + expand button */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-300 transition-colors hover:text-blue-400"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Volume2 className="h-4 w-4" />
          Text-to-Speech
        </button>

        <Switch.Root
          checked={enabled}
          onCheckedChange={(checked) =>
            onChange({ tts_enabled: checked })
          }
          className="relative h-6 w-11 rounded-full bg-gray-700 transition-colors data-[state=checked]:bg-sf-primary"
        >
          <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[22px]" />
        </Switch.Root>
      </div>

      {/* Expanded settings (only when enabled AND expanded) */}
      {enabled && expanded && (
        <div className="mt-4 space-y-5 pl-6">
          <p className="text-xs text-gray-500">
            Read donation messages aloud using the browser's built-in
            text-to-speech engine.
          </p>

          {/* Voice Selection */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Voice
            </label>
            <select
              value={voice || ""}
              onChange={(e) =>
                onChange({ tts_voice: e.target.value || null })
              }
              className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary"
            >
              {voices.map((v) => (
                <option key={v.value || "__default"} value={v.value}>
                  {v.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Available voices depend on the browser and OS running the overlay
            </p>
          </div>

          {/* Speed / Rate */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Speed: {rate.toFixed(1)}x
            </label>
            <Slider.Root
              value={[rate]}
              onValueChange={([v]) => onChange({ tts_rate: v })}
              min={0.5}
              max={2.0}
              step={0.1}
              className="relative flex h-5 w-full touch-none items-center"
            >
              <Slider.Track className="relative h-1 w-full grow rounded-full bg-gray-700">
                <Slider.Range className="absolute h-full rounded-full bg-sf-primary" />
              </Slider.Track>
              <Slider.Thumb className="block h-4 w-4 rounded-full bg-white shadow focus:outline-none focus:ring-2 focus:ring-sf-primary" />
            </Slider.Root>
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>Slow (0.5x)</span>
              <span>Fast (2.0x)</span>
            </div>
          </div>

          {/* Pitch */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Pitch: {pitch.toFixed(1)}
            </label>
            <Slider.Root
              value={[pitch]}
              onValueChange={([v]) => onChange({ tts_pitch: v })}
              min={0.5}
              max={2.0}
              step={0.1}
              className="relative flex h-5 w-full touch-none items-center"
            >
              <Slider.Track className="relative h-1 w-full grow rounded-full bg-gray-700">
                <Slider.Range className="absolute h-full rounded-full bg-sf-primary" />
              </Slider.Track>
              <Slider.Thumb className="block h-4 w-4 rounded-full bg-white shadow focus:outline-none focus:ring-2 focus:ring-sf-primary" />
            </Slider.Root>
            <div className="mt-1 flex justify-between text-xs text-gray-500">
              <span>Low (0.5)</span>
              <span>High (2.0)</span>
            </div>
          </div>

          {/* Volume */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-300">
              Volume: {Math.round(volume * 100)}%
            </label>
            <Slider.Root
              value={[volume * 100]}
              onValueChange={([v]) => onChange({ tts_volume: v / 100 })}
              min={0}
              max={100}
              step={1}
              className="relative flex h-5 w-full touch-none items-center"
            >
              <Slider.Track className="relative h-1 w-full grow rounded-full bg-gray-700">
                <Slider.Range className="absolute h-full rounded-full bg-sf-primary" />
              </Slider.Track>
              <Slider.Thumb className="block h-4 w-4 rounded-full bg-white shadow focus:outline-none focus:ring-2 focus:ring-sf-primary" />
            </Slider.Root>
          </div>

          {/* Info notice */}
          <div className="rounded-lg border border-yellow-700/50 bg-yellow-900/20 p-3">
            <p className="text-xs leading-relaxed text-yellow-200/80">
              <strong>Note:</strong> Using the browser's built-in TTS engine.
              Voice quality and availability vary by browser/OS. Cloud TTS
              (Google, Amazon Polly) will be available in a future update for
              higher quality voices.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
