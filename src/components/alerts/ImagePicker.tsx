/**
 * ImagePicker — Browsable image library with upload, preview, and delete.
 *
 * Displays all uploaded images in a grid, allows uploading new images via
 * Tauri's native file dialog, selecting an image for an alert, previewing
 * the selected image at full size, and deleting unused images.
 */

import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Upload, Trash2, X } from "lucide-react";
import type { ImageInfo } from "../../api/alertApi";
import {
  listImages,
  uploadImageFromPath,
  deleteImage as deleteImageApi,
} from "../../api/alertApi";
import { getServerUrl } from "../../api/config";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ImagePickerProps {
  /** Currently selected image path (e.g. "/images/abc.png"), or null. */
  value: string | null;
  /** Called when the user selects or clears an image. */
  onChange: (path: string | null) => void;
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

export default function ImagePicker({ value, onChange }: ImagePickerProps) {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // -----------------------------------------------------------------------
  // Fetch images on mount
  // -----------------------------------------------------------------------

  const fetchImages = useCallback(async () => {
    try {
      const data = await listImages();
      setImages(data.images);
    } catch (err) {
      console.error("Failed to fetch images:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  // -----------------------------------------------------------------------
  // Upload
  // -----------------------------------------------------------------------

  const handleUpload = useCallback(async () => {
    setError(null);
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "webp"] },
        ],
      });

      if (!selected) return;

      const filePath =
        typeof selected === "string"
          ? selected
          : (selected as { path?: string })?.path;
      if (!filePath) return;

      setUploading(true);

      // Send the local path to the server — the sidecar copies it directly
      const result = await uploadImageFromPath(filePath);

      // Auto-select the newly uploaded image
      onChange(result.path);
      await fetchImages();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(`Upload failed: ${msg}`);
      console.error("Image upload failed:", err);
    } finally {
      setUploading(false);
    }
  }, [onChange, fetchImages]);

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------

  const handleDelete = useCallback(
    async (filename: string, imagePath: string) => {
      if (!window.confirm("Delete this image file? This cannot be undone.")) {
        return;
      }

      setDeleting(filename);
      try {
        await deleteImageApi(filename);

        // If the deleted image was currently selected, clear it
        if (value === imagePath) {
          onChange(null);
        }

        await fetchImages();
      } catch (err) {
        console.error("Delete failed:", err);
        setError("Failed to delete image file.");
      } finally {
        setDeleting(null);
      }
    },
    [value, onChange, fetchImages]
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-300">
          Alert Image / GIF
        </label>
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading}
          className="flex items-center gap-1.5 rounded-lg border border-panel-border bg-panel-bg px-3 py-1.5 text-sm text-gray-300 transition-colors hover:border-sf-primary hover:text-white disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading..." : "Upload Image"}
        </button>
      </div>

      {/* Error message */}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Selected image preview */}
      {value && (
        <div className="relative overflow-hidden rounded-lg border-2 border-sf-primary bg-panel-bg">
          <img
            src={`${getServerUrl()}${value}`}
            alt="Selected alert image"
            className="mx-auto h-48 w-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 rounded bg-red-600/80 p-1 text-white transition-colors hover:bg-red-600"
            title="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Image grid */}
      <div className="max-h-80 overflow-y-auto rounded-lg border border-panel-border bg-panel-bg p-2">
        {loading ? (
          <p className="px-3 py-4 text-center text-sm text-gray-500">
            Loading images...
          </p>
        ) : images.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-500 italic">
            No images uploaded yet. Click "Upload Image" to add one.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {images.map((image) => {
              const isSelected = value === image.path;
              const isBeingDeleted = deleting === image.filename;

              return (
                <div
                  key={image.filename}
                  className={`group relative cursor-pointer overflow-hidden rounded-md border transition-all ${
                    isSelected
                      ? "border-sf-primary ring-1 ring-sf-primary"
                      : "border-panel-border hover:border-gray-500"
                  } ${isBeingDeleted ? "opacity-50" : ""}`}
                  onClick={() => onChange(image.path)}
                  role="option"
                  aria-selected={isSelected}
                >
                  {/* Thumbnail */}
                  <div className="aspect-square bg-gray-900">
                    <img
                      src={`${getServerUrl()}${image.path}`}
                      alt={image.filename}
                      className="h-full w-full object-cover transition-opacity group-hover:opacity-80"
                      loading="lazy"
                      onError={(e) => {
                        // Replace broken image with placeholder
                        const el = e.target as HTMLImageElement;
                        el.style.display = "none";
                        el.parentElement!.classList.add(
                          "flex",
                          "items-center",
                          "justify-center"
                        );
                        const icon = document.createElement("div");
                        icon.innerHTML =
                          '<svg class="h-8 w-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>';
                        el.parentElement!.appendChild(icon);
                      }}
                    />
                  </div>

                  {/* Delete button — visible on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(image.filename, image.path);
                    }}
                    disabled={isBeingDeleted}
                    className="absolute right-1 top-1 rounded bg-red-600/80 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600 disabled:opacity-50"
                    title="Delete image"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>

                  {/* File size badge */}
                  <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-gray-300">
                    {formatFileSize(image.size)}
                  </div>

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute left-1 top-1 rounded bg-sf-primary px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Selected
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clear selection */}
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-sm text-gray-500 transition-colors hover:text-gray-300"
        >
          Clear selected image
        </button>
      )}
    </div>
  );
}
