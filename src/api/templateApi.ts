/**
 * Template API Client
 *
 * Typed functions for communicating with the sidecar server's alert template
 * CRUD endpoints. Follows the same pattern as alertApi.ts.
 */

import { getServerUrl } from "./config";
import type { AlertType, AnimationIn, AnimationOut } from "./alertApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The alert configuration stored inside a template's template_data field. */
export interface TemplateData {
  type: AlertType;
  name: string;
  message_template: string;
  duration_ms: number;
  animation_in: AnimationIn | null;
  animation_out: AnimationOut | null;
  sound_path: string | null;
  sound_volume: number;
  image_path: string | null;
  font_family: string;
  font_size: number;
  text_color: string;
  bg_color: string | null;
  custom_css: string;
  min_amount: number;
  tts_enabled: number; // 0 | 1
  tts_voice?: string | null;
  tts_rate?: number;
  tts_pitch?: number;
  tts_volume?: number;
}

/** A template row as returned by the server. */
export interface AlertTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  template_data: string; // JSON string — parse with JSON.parse() to get TemplateData
  is_builtin: number; // 0 | 1
  created_at: string;
  updated_at: string;
}

/** Fields accepted when creating a new template. */
export interface CreateTemplateInput {
  name: string;
  description?: string;
  author?: string;
  template_data: TemplateData;
}

/** Fields accepted when updating a template. */
export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  author?: string;
  template_data?: TemplateData;
}

/** Shape of an exported/imported JSON template file. */
export interface TemplateExportData {
  name: string;
  description: string;
  author: string;
  template_data: TemplateData;
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
// Template CRUD
// ---------------------------------------------------------------------------

/** Fetch all templates. */
export async function fetchTemplates(): Promise<AlertTemplate[]> {
  const res = await fetch(`${serverUrl()}/api/templates`);
  const data = await handleResponse<{ templates: AlertTemplate[] }>(res);
  return data.templates;
}

/** Fetch a single template by ID. */
export async function fetchTemplateById(
  id: string
): Promise<AlertTemplate> {
  const res = await fetch(`${serverUrl()}/api/templates/${id}`);
  const data = await handleResponse<{ template: AlertTemplate }>(res);
  return data.template;
}

/** Create a new user template. Returns the created template. */
export async function createTemplate(
  input: CreateTemplateInput
): Promise<AlertTemplate> {
  const res = await fetch(`${serverUrl()}/api/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await handleResponse<{ template: AlertTemplate }>(res);
  return data.template;
}

/** Update an existing user template. Returns the updated template. */
export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput
): Promise<AlertTemplate> {
  const res = await fetch(`${serverUrl()}/api/templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await handleResponse<{ template: AlertTemplate }>(res);
  return data.template;
}

/** Delete a user template. Built-in templates cannot be deleted. */
export async function deleteTemplateById(
  id: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${serverUrl()}/api/templates/${id}`, {
    method: "DELETE",
  });
  return handleResponse(res);
}
