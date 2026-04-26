function flattenToMessage(f: unknown): string {
  if (!f || typeof f !== "object") return "";
  const o = f as { formErrors?: string[]; fieldErrors?: Record<string, unknown> };
  const parts: string[] = [];
  if (o.formErrors?.length) parts.push(...o.formErrors);
  if (o.fieldErrors) {
    for (const messages of Object.values(o.fieldErrors)) {
      if (Array.isArray(messages)) {
        for (const m of messages) {
          if (typeof m === "string") parts.push(m);
        }
      }
    }
  }
  return parts.filter(Boolean).join(" · ");
}

/** Normalizes API error bodies (string or Zod-style flatten) for display. */
export function messageFromApiError(data: unknown): string {
  if (data == null) return "Request failed";
  if (typeof data === "string") return data;
  if (typeof data === "object" && "error" in (data as object)) {
    const err = (data as { error: unknown }).error;
    if (typeof err === "string") return err;
    if (err && typeof err === "object") {
      const msg = flattenToMessage(err);
      if (msg) return msg;
    }
  }
  if (typeof data === "object" && ("fieldErrors" in (data as object) || "formErrors" in (data as object))) {
    const msg = flattenToMessage(data);
    if (msg) return msg;
  }
  if (typeof data === "object" && "message" in (data as object)) {
    const m = (data as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "Something went wrong. Check all fields and try again.";
}

/**
 * Read JSON from a fetch `Response` after `await fetch(...)`.
 * If the API is down, Vite often returns HTML (502) from the /api proxy — this surfaces a clear fix instead of "invalid format".
 */
export async function readResponseJson(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed) {
    if (response.status === 502 || response.status === 503) {
      throw new Error(
        "Could not reach the API (no response from port 4000). From the repo root run: npm run dev — that starts both the API and the web app. Or run: npm run dev:api in a second terminal, then use http://localhost:5173"
      );
    }
    if (!response.ok) {
      throw new Error(
        `Request failed (${response.status}). Start the API with: npm run dev:api (or npm run dev from the repo root). Set DATABASE_URL and JWT_SECRET in apps/api/.env.`
      );
    }
    return {};
  }

  if (trimmed.startsWith("<!") || trimmed.startsWith("<html")) {
    throw new Error(
      "The server sent HTML instead of data — the API is probably not running. Run from the project root: npm run dev  (starts API on :4000 and the app on :5173) or: npm run dev:api  then try again from http://localhost:5173"
    );
  }

  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error(
      "The API returned something that is not valid JSON. Check that the backend is running and apps/api/.env has DATABASE_URL and a JWT_SECRET of at least 32 characters."
    );
  }
}

/** For `catch` when `fetch()` never returns a Response (offline, CORS, wrong host). */
export function messageFromFetchFailure(err: unknown): string {
  if (err instanceof TypeError && (err.message.includes("fetch") || err.message === "Failed to fetch")) {
    return "Network error: could not reach the server. From the project root run npm run dev (or npm run dev:api) so the API listens on port 4000, and open the app at http://localhost:5173 — not a static file build unless you set VITE_API_URL.";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Request failed";
}
