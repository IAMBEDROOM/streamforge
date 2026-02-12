/**
 * BrowserSourceUrl — Displays a browser source URL with copy and open buttons.
 *
 * Used in the Dashboard to show OBS browser source URLs for overlays.
 */

import { useState, useCallback } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";

interface BrowserSourceUrlProps {
  /** Label displayed above the URL (e.g. "Alert Overlay") */
  label: string;
  /** The overlay path (e.g. "/overlays/alerts/") */
  path: string;
  /** Base server URL (e.g. "http://localhost:39283") */
  serverUrl: string;
}

export default function BrowserSourceUrl({
  label,
  path,
  serverUrl,
}: BrowserSourceUrlProps) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${serverUrl}${path}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments where clipboard API is unavailable
      const input = document.createElement("input");
      input.value = fullUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [fullUrl]);

  const handleOpen = useCallback(async () => {
    try {
      await open(fullUrl);
    } catch {
      // Fallback if Tauri shell plugin is unavailable (e.g. dev browser)
      window.open(fullUrl, "_blank", "noopener,noreferrer");
    }
  }, [fullUrl]);

  return (
    <div className="rounded-lg border border-panel-border bg-panel-bg p-4">
      <p className="mb-2 text-sm font-medium text-gray-300">{label}</p>
      <div className="flex items-stretch gap-2">
        <code className="flex flex-1 items-center rounded-lg border border-panel-border bg-panel-surface px-3 py-2 text-sm text-sf-primary-light select-all">
          {fullUrl}
        </code>
        <button
          onClick={handleCopy}
          title={copied ? "Copied!" : "Copy URL"}
          className="flex items-center gap-1.5 rounded-lg border border-panel-border bg-panel-surface px-3 py-2 text-sm text-gray-300 transition-colors hover:border-sf-primary hover:text-white"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy
            </>
          )}
        </button>
        <button
          onClick={handleOpen}
          title="Open in browser to test"
          className="flex items-center gap-1.5 rounded-lg border border-panel-border bg-panel-surface px-3 py-2 text-sm text-gray-300 transition-colors hover:border-sf-primary hover:text-white"
        >
          <ExternalLink className="h-4 w-4" />
          Test
        </button>
      </div>
    </div>
  );
}
