/**
 * SoundPicker — Browsable sound library with upload, preview, and delete.
 *
 * Displays all uploaded sounds, allows previewing via Howler.js,
 * uploading new sounds via Tauri's native file dialog, selecting
 * a sound for an alert, and deleting unused sounds.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Howl } from "howler";
import { Volume2, Upload, Trash2, Play, Square } from "lucide-react";
import type { SoundInfo } from "../../api/alertApi";
import {
  listSounds,
  uploadSoundFromPath,
  deleteSound as deleteSoundApi,
} from "../../api/alertApi";
import { getServerUrl } from "../../api/config";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SoundPickerProps {
  /** Currently selected sound path (e.g. "/sounds/abc.mp3"), or null. */
  value: string | null;
  /** Called when the user selects or clears a sound. */
  onChange: (path: string | null) => void;
  /** Current volume (0–1) used for preview playback. */
  volume: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format bytes into a human-readable string. */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SoundPicker({ value, onChange, volume }: SoundPickerProps) {
  const [sounds, setSounds] = useState<SoundInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [playingPath, setPlayingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const howlRef = useRef<Howl | null>(null);

  // -----------------------------------------------------------------------
  // Fetch sounds on mount
  // -----------------------------------------------------------------------

  const fetchSounds = useCallback(async () => {
    try {
      const data = await listSounds();
      setSounds(data.sounds);
    } catch (err) {
      console.error("Failed to fetch sounds:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSounds();
  }, [fetchSounds]);

  // Clean up Howl instance on unmount
  useEffect(() => {
    return () => {
      if (howlRef.current) {
        howlRef.current.stop();
        howlRef.current.unload();
        howlRef.current = null;
      }
    };
  }, []);

  // -----------------------------------------------------------------------
  // Upload
  // -----------------------------------------------------------------------

  const handleUpload = useCallback(async () => {
    setError(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Audio", extensions: ["mp3", "wav", "ogg"] }],
      });

      if (!selected) return;

      const filePath =
        typeof selected === "string"
          ? selected
          : (selected as { path?: string })?.path;
      if (!filePath) return;

      setUploading(true);

      // Send the local path to the server — the sidecar copies it directly
      const result = await uploadSoundFromPath(filePath);

      // Auto-select the newly uploaded sound
      onChange(result.path);
      await fetchSounds();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(`Upload failed: ${msg}`);
      console.error("Sound upload failed:", err);
    } finally {
      setUploading(false);
    }
  }, [onChange, fetchSounds]);

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  const handleDelete = useCallback(
    async (filename: string, soundPath: string) => {
      if (!window.confirm("Delete this sound file? This cannot be undone.")) {
        return;
      }

      setDeleting(filename);
      try {
        await deleteSoundApi(filename);

        // If the deleted sound was currently selected, clear it
        if (value === soundPath) {
          onChange(null);
        }

        // Stop preview if it was playing the deleted sound
        if (playingPath === soundPath && howlRef.current) {
          howlRef.current.stop();
          howlRef.current.unload();
          howlRef.current = null;
          setPlayingPath(null);
        }

        await fetchSounds();
      } catch (err) {
        console.error("Delete failed:", err);
        setError("Failed to delete sound file.");
      } finally {
        setDeleting(null);
      }
    },
    [value, playingPath, onChange, fetchSounds]
  );

  // -----------------------------------------------------------------------
  // Preview playback
  // -----------------------------------------------------------------------

  const handlePreview = useCallback(
    (soundPath: string) => {
      // Stop any currently playing sound
      if (howlRef.current) {
        howlRef.current.stop();
        howlRef.current.unload();
        howlRef.current = null;
      }

      // If clicking the same sound that's playing, just stop it
      if (playingPath === soundPath) {
        setPlayingPath(null);
        return;
      }

      const url = `${getServerUrl()}${soundPath}`;
      const howl = new Howl({
        src: [url],
        volume: volume,
        onend: () => {
          setPlayingPath(null);
        },
        onloaderror: (_id: number, err: unknown) => {
          console.error("Sound load error:", err);
          setPlayingPath(null);
        },
        onplayerror: (_id: number, err: unknown) => {
          console.error("Sound play error:", err);
          setPlayingPath(null);
        },
      });

      howlRef.current = howl;
      howl.play();
      setPlayingPath(soundPath);
    },
    [playingPath, volume]
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-300">
          Alert Sound
        </label>
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg border border-panel-border bg-panel-bg px-3 py-1.5 text-sm text-gray-300 transition-colors hover:border-sf-primary hover:text-white disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading..." : "Upload Sound"}
        </button>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {/* Sound list */}
      <div className="max-h-64 overflow-y-auto rounded-lg border border-panel-border bg-panel-bg">
        {loading ? (
          <p className="px-3 py-4 text-center text-sm text-gray-500">
            Loading sounds...
          </p>
        ) : sounds.length === 0 ? (
          <p className="px-3 py-4 text-center text-sm text-gray-500 italic">
            No sounds uploaded yet. Click "Upload Sound" to add one.
          </p>
        ) : (
          <ul className="divide-y divide-panel-border">
            {sounds.map((sound) => {
              const isSelected = value === sound.path;
              const isPlaying = playingPath === sound.path;
              const isBeingDeleted = deleting === sound.filename;

              return (
                <li
                  key={sound.filename}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors hover:bg-panel-hover ${
                    isSelected
                      ? "bg-sf-primary/15 border-l-2 border-l-sf-primary"
                      : ""
                  }`}
                  onClick={() => onChange(sound.path)}
                  role="option"
                  aria-selected={isSelected}
                >
                  {/* Icon */}
                  <Volume2
                    className={`h-4 w-4 shrink-0 ${
                      isSelected ? "text-sf-primary" : "text-gray-500"
                    }`}
                  />

                  {/* Filename + size */}
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm ${
                        isSelected ? "text-white font-medium" : "text-gray-300"
                      }`}
                    >
                      {sound.filename}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(sound.size)}
                    </p>
                  </div>

                  {/* Preview button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(sound.path);
                    }}
                    className={`rounded p-1.5 transition-colors ${
                      isPlaying
                        ? "bg-sf-primary/20 text-sf-primary"
                        : "text-gray-500 hover:bg-panel-hover hover:text-gray-300"
                    }`}
                    title={isPlaying ? "Stop preview" : "Preview sound"}
                  >
                    {isPlaying ? (
                      <Square className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(sound.filename, sound.path);
                    }}
                    disabled={isBeingDeleted}
                    className="rounded p-1.5 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
                    title="Delete sound"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Clear selection */}
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange(null);
            // Stop preview if it was playing the cleared sound
            if (howlRef.current && playingPath === value) {
              howlRef.current.stop();
              howlRef.current.unload();
              howlRef.current = null;
              setPlayingPath(null);
            }
          }}
          className="text-sm text-gray-500 transition-colors hover:text-gray-300"
        >
          Clear selected sound
        </button>
      )}
    </div>
  );
}
