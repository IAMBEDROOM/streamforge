/**
 * Alert API Client
 *
 * Typed functions for communicating with the sidecar server's alert CRUD
 * endpoints and file upload endpoints. Uses the cached server URL from
 * config.ts (safe to call synchronously because App.tsx ensures the
 * server is connected before rendering pages).
 */

import { getServerUrl } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertType =
  | "follow"
  | "subscribe"
  | "cheer"
  | "raid"
  | "donation"
  | "custom";

export type AnimationIn = "slideIn" | "fadeIn" | "bounceIn" | "popIn";
export type AnimationOut = "slideOut" | "fadeOut" | "bounceOut" | "popOut";

export interface Alert {
  id: string;
  type: AlertType;
  name: string;
  enabled: number; // 0 | 1
  message_template: string | null;
  duration_ms: number;
  animation_in: AnimationIn | null;
  animation_out: AnimationOut | null;
  sound_path: string | null;
  sound_volume: number | null;
  image_path: string | null;
  font_family: string | null;
  font_size: number | null;
  text_color: string | null;
  bg_color: string | null;
  custom_css: string | null;
  min_amount: number | null;
  tts_enabled: number; // 0 | 1
  created_at: string;
  updated_at: string;
  variations?: AlertVariation[];
}

export interface AlertVariation {
  id: string;
  parent_alert_id: string;
  name: string;
  condition_type: string;
  condition_value: string;
  message_template: string | null;
  sound_path: string | null;
  sound_volume: number | null;
  image_path: string | null;
  animation_in: string | null;
  animation_out: string | null;
  custom_css: string | null;
  enabled: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

/** Fields accepted when creating or updating an alert. */
export interface AlertInput {
  type?: AlertType;
  name?: string;
  enabled?: number;
  message_template?: string;
  duration_ms?: number;
  animation_in?: AnimationIn;
  animation_out?: AnimationOut;
  sound_path?: string | null;
  sound_volume?: number;
  image_path?: string | null;
  font_family?: string;
  font_size?: number;
  text_color?: string;
  bg_color?: string | null;
  custom_css?: string | null;
  min_amount?: number | null;
  tts_enabled?: number;
}

export interface UploadResponse {
  path: string;
  filename: string;
}

export interface SoundInfo {
  filename: string;
  path: string;
  size: number;
  uploaded: string;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function serverUrl(): string {
  return getServerUrl();
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Server returned ${res.status}${body ? `: ${body}` : ""}`
    );
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Alert CRUD
// ---------------------------------------------------------------------------

/** Fetch all alerts (with variations). */
export async function fetchAlerts(): Promise<Alert[]> {
  const res = await fetch(`${serverUrl()}/api/alerts`);
  return handleResponse<Alert[]>(res);
}

/** Fetch a single alert by ID. */
export async function fetchAlertById(id: string): Promise<Alert> {
  const res = await fetch(`${serverUrl()}/api/alerts/${id}`);
  return handleResponse<Alert>(res);
}

/** Create a new alert. Returns the created alert. */
export async function createAlert(data: AlertInput): Promise<Alert> {
  const res = await fetch(`${serverUrl()}/api/alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Alert>(res);
}

/** Update an existing alert. Returns the updated alert. */
export async function updateAlert(
  id: string,
  data: AlertInput
): Promise<Alert> {
  const res = await fetch(`${serverUrl()}/api/alerts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<Alert>(res);
}

/** Delete an alert (cascades to variations). */
export async function deleteAlertById(
  id: string
): Promise<{ status: string; message: string }> {
  const res = await fetch(`${serverUrl()}/api/alerts/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}

// ---------------------------------------------------------------------------
// Test Alert
// ---------------------------------------------------------------------------

export interface TestAlertBody {
  type: AlertType;
  username?: string;
  displayName?: string;
  amount?: number | null;
  message?: string | null;
  config?: Partial<Alert>;
}

/** Trigger a test alert through the queue system. */
export async function triggerTestAlertQueue(
  body: TestAlertBody
): Promise<{
  status: string;
  alertId: string;
  queueLength: number;
}> {
  const res = await fetch(`${serverUrl()}/api/test-alert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

// ---------------------------------------------------------------------------
// File Uploads
// ---------------------------------------------------------------------------

/** Upload a sound file via multipart. Returns the server path. */
export async function uploadSound(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("sound", file);

  const res = await fetch(`${serverUrl()}/api/upload/sound`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<UploadResponse>(res);
}

/** Upload a sound by sending its local file path to the server (server copies it). */
export async function uploadSoundFromPath(
  filePath: string
): Promise<UploadResponse> {
  const res = await fetch(`${serverUrl()}/api/upload/sound/path`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath }),
  });
  return handleResponse<UploadResponse>(res);
}

/** List all uploaded sound files. */
export async function listSounds(): Promise<{ sounds: SoundInfo[] }> {
  const res = await fetch(`${serverUrl()}/api/upload/sounds`);
  return handleResponse<{ sounds: SoundInfo[] }>(res);
}

/** Delete an uploaded sound file by filename. */
export async function deleteSound(filename: string): Promise<void> {
  const res = await fetch(`${serverUrl()}/api/upload/sound/${encodeURIComponent(filename)}`, {
    method: "DELETE",
  });
  await handleResponse(res);
}

/** Upload an image file via multipart. Returns the server path. */
export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(`${serverUrl()}/api/upload/image`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<UploadResponse>(res);
}

/** Upload an image by sending its local file path to the server (server copies it). */
export async function uploadImageFromPath(
  filePath: string
): Promise<UploadResponse> {
  const res = await fetch(`${serverUrl()}/api/upload/image/path`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath }),
  });
  return handleResponse<UploadResponse>(res);
}
