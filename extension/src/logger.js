const LOG_KEY = 'browserLogs';
const MAX_LOG_ENTRIES = 200;
function createEntry(level, source, message, meta) {
    return {
        timestamp: Date.now(),
        level,
        source,
        message,
        meta,
    };
}
async function persistEntry(entry) {
    if (!chrome?.storage?.local) {
        return;
    }
    try {
        const stored = await chrome.storage.local.get(LOG_KEY);
        const existing = Array.isArray(stored[LOG_KEY]) ? stored[LOG_KEY] : [];
        const updated = [...existing, entry].slice(-MAX_LOG_ENTRIES);
        await chrome.storage.local.set({ [LOG_KEY]: updated });
    }
    catch (error) {
        console.error('[Logger] Failed to persist log entry:', error);
    }
}
export function logInfo(source, message, meta) {
    if (meta !== undefined) {
        console.log(`[${source}] ${message}`, meta);
    }
    else {
        console.log(`[${source}] ${message}`);
    }
}
export function logWarn(source, message, meta) {
    if (meta !== undefined) {
        console.warn(`[${source}] ${message}`, meta);
    }
    else {
        console.warn(`[${source}] ${message}`);
    }
    const entry = createEntry('warn', source, message, meta);
    void persistEntry(entry);
}
export function logError(source, message, meta) {
    if (meta !== undefined) {
        console.error(`[${source}] ${message}`, meta);
    }
    else {
        console.error(`[${source}] ${message}`);
    }
    const entry = createEntry('error', source, message, meta);
    void persistEntry(entry);
}
export function logChromeRuntimeError(context) {
    if (chrome?.runtime?.lastError) {
        const error = chrome.runtime.lastError;
        logError('ChromeRuntime', `${context} - ${error.message}`, {
            stack: error?.stack,
            details: error,
        });
    }
}
export function logBrowserMetadata(source = 'Background') {
    if (chrome?.runtime?.getPlatformInfo) {
        chrome.runtime.getPlatformInfo((info) => {
            logInfo(source, 'Platform info', info);
            logChromeRuntimeError('getPlatformInfo');
        });
    }
    else {
        logInfo(source, 'Platform info API unavailable');
    }
    const runtimeWithBrowserInfo = chrome?.runtime;
    if (runtimeWithBrowserInfo?.getBrowserInfo) {
        runtimeWithBrowserInfo.getBrowserInfo((info) => {
            logInfo(source, 'Browser info', info);
            logChromeRuntimeError('getBrowserInfo');
        });
    }
    else {
        logInfo(source, 'Browser info API unavailable');
    }
    try {
        const manifest = chrome?.runtime?.getManifest?.();
        if (manifest) {
            logInfo(source, 'Manifest metadata', manifest);
        }
    }
    catch (error) {
        logWarn('Logger', 'Failed to read manifest metadata', error);
    }
}
export async function getBrowserLogs() {
    if (!chrome?.storage?.local) {
        return [];
    }
    try {
        const stored = await chrome.storage.local.get(LOG_KEY);
        return Array.isArray(stored[LOG_KEY]) ? stored[LOG_KEY] : [];
    }
    catch (error) {
        console.error('[Logger] Failed to read browser logs:', error);
        return [];
    }
}
export async function clearBrowserLogs() {
    if (!chrome?.storage?.local) {
        return;
    }
    try {
        await chrome.storage.local.set({ [LOG_KEY]: [] });
    }
    catch (error) {
        console.error('[Logger] Failed to clear browser logs:', error);
    }
}
