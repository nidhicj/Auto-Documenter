/**
 * Structured logging system for the extension
 * 
 * Logs are ALWAYS output to console (visible in browser DevTools):
 * - Popup logs: Right-click popup → Inspect → Console tab
 * - Background logs: chrome://extensions/ → Find extension → Click "service worker" → Console tab
 * - Content logs: Open web page → F12 → Console tab
 * 
 * Logs are also stored in chrome.storage.local (can be disabled by setting ENABLE_STORAGE_LOGGING = false)
 * for viewing in the popup log viewer.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export type LogSource = 'Popup' | 'Background' | 'Record' | 'Content';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  source: LogSource;
  message: string;
  phase?: string; // for ordered steps like "R1", "R2", "R_STOP_1"
  recordingId?: string | null;
  meta?: any;
}

const STORAGE_KEY = 'browserLogs';
const MAX_LOGS = 1000; // Limit to prevent storage bloat

// Set to false to disable storage logging (console only)
const ENABLE_STORAGE_LOGGING = true;

/**
 * Internal function to append a log entry to storage
 */
async function appendLog(entry: LogEntry): Promise<void> {
  if (!ENABLE_STORAGE_LOGGING) {
    return; // Skip storage if disabled
  }
  
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const logs: LogEntry[] = result[STORAGE_KEY] || [];
    
    logs.push(entry);
    
    // Keep only the most recent MAX_LOGS entries
    if (logs.length > MAX_LOGS) {
      logs.splice(0, logs.length - MAX_LOGS);
    }
    
    await chrome.storage.local.set({ [STORAGE_KEY]: logs });
  } catch (error) {
    // Fallback to console if storage fails
    console.error('[Logger] Failed to store log entry:', error, entry);
  }
}

/**
 * Format log for console output with better visibility
 */
function formatConsoleLog(source: LogSource, level: LogLevel, phase: string | undefined, message: string, data?: any): string {
  const phaseStr = phase ? `[${phase}] ` : '';
  const recordingIdStr = data?.recordingId ? ` [ID:${String(data.recordingId).slice(0, 8)}]` : '';
  return `${phaseStr}[${source}]${recordingIdStr} ${message}`;
}

/**
 * Log an info message
 */
export async function logInfo(
  source: LogSource,
  message: string,
  meta?: any,
  phase?: string,
  recordingId?: string | null
): Promise<void> {
  const entry: LogEntry = {
    timestamp: Date.now(),
    level: 'info',
    source,
    message,
    phase,
    recordingId: recordingId ?? undefined,
    meta,
  };
  
  await appendLog(entry);
  // Always output to console for terminal/DevTools visibility
  const consoleMessage = formatConsoleLog(source, 'info', phase, message, { recordingId });
  if (meta) {
    console.log(consoleMessage, meta);
  } else {
    console.log(consoleMessage);
  }
}

/**
 * Log a warning message
 */
export async function logWarn(
  source: LogSource,
  message: string,
  meta?: any,
  phase?: string,
  recordingId?: string | null
): Promise<void> {
  const entry: LogEntry = {
    timestamp: Date.now(),
    level: 'warn',
    source,
    message,
    phase,
    recordingId: recordingId ?? undefined,
    meta,
  };
  
  await appendLog(entry);
  // Always output to console for terminal/DevTools visibility
  const consoleMessage = formatConsoleLog(source, 'warn', phase, message, { recordingId });
  if (meta) {
    console.warn(consoleMessage, meta);
  } else {
    console.warn(consoleMessage);
  }
}

/**
 * Log an error message
 */
export async function logError(
  source: LogSource,
  message: string,
  error?: any,
  phase?: string,
  recordingId?: string | null
): Promise<void> {
  const errorMeta = error instanceof Error
    ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      }
    : error;
  
  const entry: LogEntry = {
    timestamp: Date.now(),
    level: 'error',
    source,
    message,
    phase,
    recordingId: recordingId ?? undefined,
    meta: errorMeta,
  };
  
  await appendLog(entry);
  // Always output to console for terminal/DevTools visibility
  const consoleMessage = formatConsoleLog(source, 'error', phase, message, { recordingId });
  if (errorMeta) {
    console.error(consoleMessage, errorMeta);
  } else {
    console.error(consoleMessage);
  }
}

/**
 * Get all browser logs, sorted by timestamp
 */
export async function getBrowserLogs(): Promise<LogEntry[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const logs: LogEntry[] = result[STORAGE_KEY] || [];
    return logs.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('[Logger] Failed to get logs:', error);
    return [];
  }
}

/**
 * Clear all browser logs
 */
export async function clearBrowserLogs(): Promise<void> {
  try {
    await chrome.storage.local.remove(STORAGE_KEY);
  } catch (error) {
    console.error('[Logger] Failed to clear logs:', error);
  }
}

/**
 * Format a log entry as a human-readable string
 */
export function formatLogEntry(entry: LogEntry, index?: number): string {
  const phase = entry.phase || (index !== undefined ? String(index + 1) : '');
  const level = entry.level.toUpperCase().padEnd(5);
  const source = `[${entry.source}]`.padEnd(12);
  const recordingId = entry.recordingId ? ` [${entry.recordingId.slice(0, 8)}]` : '';
  const metaStr = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
  
  return `${phase} [${level}] ${source} ${entry.message}${recordingId}${metaStr}`;
}

