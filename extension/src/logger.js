/**
 * Structured logging system for the extension (clean version)
 *
 * - Always logs to console (DevTools)
 * - Persists only WARN/ERROR by default (INFO is console-only)
 * - Non-blocking (log calls should not affect extension behavior)
 * - Batched storage writes (reduces storage churn / quota risk)
 * - Safe meta serialization (won't crash on circular data)
 */
const STORAGE_KEY = 'browserLogs';
const MAX_LOGS = 500; // lowered from 1000 to reduce quota pressure
// Storage logging switches
const ENABLE_STORAGE_LOGGING = true; // master switch
const STORE_INFO_LOGS = false; // INFO -> console-only by default
const STORE_WARN_LOGS = true;
const STORE_ERROR_LOGS = true;
// Batching controls
const FLUSH_INTERVAL_MS = 250;
const MAX_BUFFERED = 200; // safety valve: if spam happens, don't buffer forever
// Meta safety controls
const MAX_META_CHARS = 4000; // cap meta string size to avoid storage bloat
// In-memory queue for batched writes
let buffer = [];
let flushTimer = null;
function shouldStore(level) {
    if (!ENABLE_STORAGE_LOGGING)
        return false;
    if (level === 'info')
        return STORE_INFO_LOGS;
    if (level === 'warn')
        return STORE_WARN_LOGS;
    return STORE_ERROR_LOGS;
}
function safeStringify(value) {
    try {
        const s = JSON.stringify(value);
        if (s.length > MAX_META_CHARS)
            return s.slice(0, MAX_META_CHARS) + '…[truncated]';
        return s;
    }
    catch {
        return '[meta:unserializable]';
    }
}
/**
 * Format log for console output (compact + consistent)
 */
function formatConsoleLog(source, level, phase, message, recordingId) {
    const phaseStr = phase ? `[${phase}] ` : '';
    const ridStr = recordingId ? ` [ID:${String(recordingId).slice(0, 8)}]` : '';
    return `${phaseStr}[${source}]${ridStr} ${message}`;
}
/**
 * Schedule a batched flush to chrome.storage.local
 */
function scheduleFlush() {
    if (flushTimer !== null)
        return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushNow();
    }, FLUSH_INTERVAL_MS);
}
/**
 * Flush buffered logs to storage (non-blocking from callers)
 */
async function flushNow() {
    if (!ENABLE_STORAGE_LOGGING) {
        buffer = [];
        return;
    }
    if (buffer.length === 0)
        return;
    const toWrite = buffer;
    buffer = [];
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const existing = result[STORAGE_KEY] || [];
        const merged = existing.concat(toWrite);
        // Keep only most recent MAX_LOGS
        const trimmed = merged.length > MAX_LOGS ? merged.slice(merged.length - MAX_LOGS) : merged;
        await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
    }
    catch (error) {
        // Fall back to console; storage failure shouldn't break functionality.
        console.error('[Logger] Failed to store logs:', error);
    }
}
/**
 * Internal: enqueue a log entry for storage (if configured)
 */
function enqueueForStorage(entry) {
    if (!shouldStore(entry.level))
        return;
    // Prevent unbounded buffer growth
    if (buffer.length >= MAX_BUFFERED) {
        // Drop oldest buffered entries first
        buffer = buffer.slice(buffer.length - Math.floor(MAX_BUFFERED / 2));
        buffer.push({
            timestamp: Date.now(),
            level: 'warn',
            source: 'Background',
            message: 'Log buffer overflow: dropping buffered logs',
            phase: 'LOG_DROP',
        });
    }
    buffer.push(entry);
    scheduleFlush();
}
/**
 * Log an info message (console always; storage optional via STORE_INFO_LOGS)
 */
export async function logInfo(source, message, meta, phase, recordingId) {
    const entry = {
        timestamp: Date.now(),
        level: 'info',
        source,
        message,
        phase,
        recordingId: recordingId ?? undefined,
        meta,
    };
    // Storage is non-blocking
    enqueueForStorage(entry);
    const consoleMessage = formatConsoleLog(source, 'info', phase, message, recordingId);
    if (meta !== undefined)
        console.log(consoleMessage, meta);
    else
        console.log(consoleMessage);
}
/**
 * Log a warning message (console always; stored by default)
 */
export async function logWarn(source, message, meta, phase, recordingId) {
    const entry = {
        timestamp: Date.now(),
        level: 'warn',
        source,
        message,
        phase,
        recordingId: recordingId ?? undefined,
        meta,
    };
    enqueueForStorage(entry);
    const consoleMessage = formatConsoleLog(source, 'warn', phase, message, recordingId);
    if (meta !== undefined)
        console.warn(consoleMessage, meta);
    else
        console.warn(consoleMessage);
}
/**
 * Log an error message (console always; stored by default)
 */
export async function logError(source, message, error, phase, recordingId) {
    const errorMeta = error instanceof Error
        ? { message: error.message, stack: error.stack, name: error.name }
        : error;
    const entry = {
        timestamp: Date.now(),
        level: 'error',
        source,
        message,
        phase,
        recordingId: recordingId ?? undefined,
        meta: errorMeta,
    };
    enqueueForStorage(entry);
    const consoleMessage = formatConsoleLog(source, 'error', phase, message, recordingId);
    if (errorMeta !== undefined)
        console.error(consoleMessage, errorMeta);
    else
        console.error(consoleMessage);
}
/**
 * Get all browser logs, sorted by timestamp
 */
export async function getBrowserLogs() {
    try {
        // Ensure any buffered logs are flushed before reading (best effort)
        await flushNow();
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const logs = result[STORAGE_KEY] || [];
        return logs.sort((a, b) => a.timestamp - b.timestamp);
    }
    catch (error) {
        console.error('[Logger] Failed to get logs:', error);
        return [];
    }
}
/**
 * Clear all browser logs
 */
export async function clearBrowserLogs() {
    try {
        buffer = [];
        if (flushTimer !== null) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }
        await chrome.storage.local.remove(STORAGE_KEY);
    }
    catch (error) {
        console.error('[Logger] Failed to clear logs:', error);
    }
}
/**
 * Format a log entry as a human-readable string (safe)
 */
export function formatLogEntry(entry, index) {
    const phase = entry.phase || (index !== undefined ? String(index + 1) : '');
    const level = entry.level.toUpperCase().padEnd(5);
    const source = `[${entry.source}]`.padEnd(12);
    const recordingId = entry.recordingId ? ` [${entry.recordingId.slice(0, 8)}]` : '';
    let metaStr = '';
    if (entry.meta !== undefined) {
        metaStr = ` ${safeStringify(entry.meta)}`;
    }
    return `${phase} [${level}] ${source} ${entry.message}${recordingId}${metaStr}`;
}
