/**
 * Authentication utility for managing JWT tokens
 */
const TOKEN_STORAGE_KEY = 'auth_token';
/**
 * Store authentication token
 */
export async function setAuthToken(token) {
    try {
        await chrome.storage.local.set({ [TOKEN_STORAGE_KEY]: token });
        console.log('[Auth] Token stored successfully');
    }
    catch (error) {
        console.error('[Auth] Failed to store token:', error);
        throw error;
    }
}
/**
 * Get authentication token
 */
export async function getAuthToken() {
    try {
        const result = await chrome.storage.local.get(TOKEN_STORAGE_KEY);
        return result[TOKEN_STORAGE_KEY] || null;
    }
    catch (error) {
        console.error('[Auth] Failed to get token:', error);
        return null;
    }
}
/**
 * Remove authentication token
 */
export async function clearAuthToken() {
    try {
        await chrome.storage.local.remove(TOKEN_STORAGE_KEY);
        console.log('[Auth] Token cleared');
    }
    catch (error) {
        console.error('[Auth] Failed to clear token:', error);
    }
}
/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
    const token = await getAuthToken();
    return !!token;
}
/**
 * Get Authorization header value
 */
export async function getAuthHeader() {
    const token = await getAuthToken();
    return token ? `Bearer ${token}` : null;
}
/**
 * Login and store token
 */
export async function login(email, password) {
    // API_BASE_URL will be replaced at build time by Vite define
    // @ts-ignore - process.env.API_BASE_URL is replaced at build time
    const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
    try {
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });
        if (!response.ok) {
            throw new Error(`Login failed: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.access_token) {
            await setAuthToken(data.access_token);
            return true;
        }
        return false;
    }
    catch (error) {
        // Only log detailed error if it's not a network error (backend not running)
        const isNetworkError = error instanceof TypeError &&
            (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'));
        if (isNetworkError) {
            // Backend not reachable - this is expected if backend is not running
            // Don't log as error, just throw so caller can handle gracefully
            throw error;
        }
        else {
            // Other errors (auth failures, etc.) - log as error
            console.error('[Auth] Login failed:', error);
            throw error;
        }
    }
}
