// Runtime API base — set VITE_API_URL when building for mobile (Capacitor).
// Left empty for web builds: relative /api/... paths work via Vite proxy / reverse proxy.
export const API_BASE = import.meta.env.VITE_API_URL || "";

// WebSocket base — e.g. "wss://xalle.app" for production mobile build.
// Left empty to auto-detect from location.host (web builds).
export const WS_BASE = import.meta.env.VITE_WS_URL || "";

// True when running inside a Capacitor native app (Android/iOS WebView).
export const IS_CAPACITOR = !!window.Capacitor;

// Converts relative /uploads/... and /api/... URLs to absolute for Capacitor.
export const assetUrl = (url) => {
  if (!url || !API_BASE) return url;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
};
