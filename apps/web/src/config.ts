/**
 * In dev, default to same-origin `/api` so Vite can proxy to the API (avoids CORS and wrong ports).
 * Set VITE_API_URL in production to your deployed API (e.g. https://xxx.up.railway.app/api).
 */
export const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
  (import.meta.env.DEV ? "/api" : "http://localhost:4000/api");

/** WebSocket + HTTP polling for Socket.IO — same host as the page in dev (Vite proxies /socket.io). */
export function getSocketConnectUrl(): string {
  const fromEnv = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV && typeof window !== "undefined") return window.location.origin;
  return "http://localhost:4000";
}
