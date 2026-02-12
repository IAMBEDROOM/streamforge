/**
 * TestAlertPanel — Dashboard component for testing the alert overlay.
 *
 * Provides a form to configure and send test alerts to the OBS browser
 * source overlay, plus a copyable OBS browser source URL.
 */

import { useState, useCallback } from "react";
import { Zap, Copy, Check, AlertCircle, Monitor } from "lucide-react";
import { getServerUrl } from "../api/config";
import {
  triggerTestAlert,
  type TestAlertPayload,
} from "../api/alerts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALERT_TYPES = [
  { value: "follow", label: "Follow" },
  { value: "subscribe", label: "Subscribe" },
  { value: "cheer", label: "Cheer" },
  { value: "raid", label: "Raid" },
  { value: "donation", label: "Donation" },
] as const;

const ANIMATIONS = [
  { value: "slideIn", label: "Slide In" },
  { value: "fadeIn", label: "Fade In" },
  { value: "bounceIn", label: "Bounce In" },
  { value: "popIn", label: "Pop In" },
] as const;

const DEFAULT_MESSAGES: Record<string, string> = {
  follow: "Thanks for following!",
  subscribe: "Just subscribed!",
  cheer: "Cheered 100 bits!",
  raid: "is raiding with 50 viewers!",
  donation: "Donated $5.00!",
};

type ButtonState = "idle" | "loading" | "success" | "error";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TestAlertPanel() {
  // Form state
  const [type, setType] = useState<TestAlertPayload["type"]>("follow");
  const [username, setUsername] = useState("TestUser123");
  const [message, setMessage] = useState(DEFAULT_MESSAGES.follow);
  const [animation, setAnimation] =
    useState<TestAlertPayload["animation"]>("slideIn");

  // Button state
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectedClients, setConnectedClients] = useState<number | null>(null);

  // Copy state
  const [copied, setCopied] = useState(false);

  // Derive the overlay URL from the cached server URL
  const overlayUrl = `${getServerUrl()}/overlays/alerts/`;

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleTypeChange = useCallback(
    (newType: TestAlertPayload["type"]) => {
      setType(newType);
      // Update message to match the new type's default,
      // but only if the current message is still a default
      const currentIsDefault = Object.values(DEFAULT_MESSAGES).includes(message);
      if (currentIsDefault) {
        setMessage(DEFAULT_MESSAGES[newType]);
      }
    },
    [message]
  );

  const handleSendAlert = useCallback(async () => {
    setButtonState("loading");
    setErrorMessage(null);

    try {
      const response = await triggerTestAlert({
        type,
        username,
        message,
        duration: 5000,
        animation,
      });

      setConnectedClients(response.connectedClients);
      setButtonState("success");

      // Reset to idle after 2 seconds
      setTimeout(() => setButtonState("idle"), 2000);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to send test alert"
      );
      setButtonState("error");

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setButtonState("idle");
        setErrorMessage(null);
      }, 3000);
    }
  }, [type, username, message, animation]);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(overlayUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text in a temporary input
      const input = document.createElement("input");
      input.value = overlayUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [overlayUrl]);

  // -------------------------------------------------------------------------
  // Button rendering
  // -------------------------------------------------------------------------

  function renderButtonContent() {
    switch (buttonState) {
      case "loading":
        return (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Sending...
          </>
        );
      case "success":
        return (
          <>
            <Check className="h-5 w-5" />
            Alert Sent!
          </>
        );
      case "error":
        return (
          <>
            <AlertCircle className="h-5 w-5" />
            Failed
          </>
        );
      default:
        return (
          <>
            <Zap className="h-5 w-5" />
            Send Test Alert
          </>
        );
    }
  }

  const buttonColors: Record<ButtonState, string> = {
    idle: "bg-sf-primary hover:bg-sf-primary-dark",
    loading: "bg-sf-primary/70 cursor-wait",
    success: "bg-green-600 hover:bg-green-600",
    error: "bg-red-600 hover:bg-red-600",
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="rounded-xl border border-panel-border bg-panel-surface p-6">
      <h2 className="mb-1 text-lg font-semibold text-white">
        Test Your Setup
      </h2>
      <p className="mb-6 text-sm text-gray-400">
        Send a test alert to verify your overlay is working in OBS.
      </p>

      {/* Alert Configuration Form */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Alert Type */}
        <div>
          <label
            htmlFor="alert-type"
            className="mb-1.5 block text-sm font-medium text-gray-300"
          >
            Alert Type
          </label>
          <select
            id="alert-type"
            value={type}
            onChange={(e) =>
              handleTypeChange(e.target.value as TestAlertPayload["type"])
            }
            className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary"
          >
            {ALERT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Animation */}
        <div>
          <label
            htmlFor="alert-animation"
            className="mb-1.5 block text-sm font-medium text-gray-300"
          >
            Animation
          </label>
          <select
            id="alert-animation"
            value={animation}
            onChange={(e) =>
              setAnimation(e.target.value as TestAlertPayload["animation"])
            }
            className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-sf-primary"
          >
            {ANIMATIONS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        {/* Username */}
        <div>
          <label
            htmlFor="alert-username"
            className="mb-1.5 block text-sm font-medium text-gray-300"
          >
            Username
          </label>
          <input
            id="alert-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="TestUser123"
            className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-sf-primary"
          />
        </div>

        {/* Message */}
        <div>
          <label
            htmlFor="alert-message"
            className="mb-1.5 block text-sm font-medium text-gray-300"
          >
            Message
          </label>
          <input
            id="alert-message"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Thanks for following!"
            className="w-full rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-sf-primary"
          />
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={handleSendAlert}
        disabled={buttonState === "loading" || buttonState === "success"}
        className={`mb-2 flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors sm:w-auto ${buttonColors[buttonState]}`}
      >
        {renderButtonContent()}
      </button>

      {/* Error Message */}
      {errorMessage && (
        <p className="mb-4 text-sm text-red-400">{errorMessage}</p>
      )}

      {/* Connected clients indicator */}
      {connectedClients !== null && (
        <p className="mb-4 text-xs text-gray-500">
          {connectedClients === 0 ? (
            <span className="text-yellow-500">
              No overlay clients connected — make sure your OBS browser source
              is active.
            </span>
          ) : (
            <span className="text-green-500">
              {connectedClients} overlay{" "}
              {connectedClients === 1 ? "client" : "clients"} connected.
            </span>
          )}
        </p>
      )}

      {/* Divider */}
      <div className="my-6 border-t border-panel-border" />

      {/* OBS Browser Source URL */}
      <div>
        <div className="mb-3 flex items-center gap-2 text-gray-300">
          <Monitor className="h-4 w-4" />
          <h3 className="text-sm font-medium">OBS Browser Source URL</h3>
        </div>
        <div className="flex items-stretch gap-2">
          <code className="flex-1 rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-sf-primary-light select-all">
            {overlayUrl}
          </code>
          <button
            onClick={handleCopyUrl}
            className="flex items-center gap-1.5 rounded-lg border border-panel-border bg-panel-bg px-3 py-2 text-sm text-gray-300 transition-colors hover:border-sf-primary hover:text-white"
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
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Add this URL as a Browser Source in OBS (Width: 1920, Height: 1080).
          Check "Shutdown source when not visible" and "Refresh browser when
          scene becomes active".
        </p>
      </div>
    </div>
  );
}
