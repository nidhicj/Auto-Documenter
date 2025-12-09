/**
 * Resolve the backend API base URL in a way that works in the browser.
 *
 * We avoid directly reading process.env because service workers and
 * content scripts don't have the Node.js globals available.
 */
export function getApiBaseUrl(): string {
  // Prefer Vite-style environment variables when available
  const viteEnv = (typeof import.meta !== 'undefined' && (import.meta as any).env)
    ? (import.meta as any).env.VITE_API_BASE_URL
    : undefined;

  // Fall back to process.env only if it exists at runtime
  const nodeEnv = typeof process !== 'undefined' && process?.env?.API_BASE_URL
    ? process.env.API_BASE_URL
    : undefined;

  return viteEnv || nodeEnv || 'http://localhost:3001';
}
