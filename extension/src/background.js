import { recordEvent, startRecording, stopRecording, getRecordingStatus, cleanupOldScreenshotData, } from './record';
import { checkConnectionAndProcessQueue } from './offlineQueue';
import { logInfo, logError, logWarn } from './logger';
import { isAuthenticated, login } from './auth';
// Fire-and-forget logging so we don't block the service worker message pipeline
function safeInfo(message, data, code) {
    void logInfo('Background', message, data, code).catch(() => { });
}
function safeWarn(message, data, code) {
    void logWarn('Background', message, data, code).catch(() => { });
}
// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        try {
            const from = sender?.tab?.id ? `tab-${sender.tab.id}` : 'popup';
            switch (message.type) {
                case 'DOM_EVENT': {
                    const event = message.event;
                    // Recording DOM events is high-frequency. No per-event logs here.
                    recordEvent(event).catch(async (error) => {
                        // This is important—keep it.
                        await logError('Background', 'recordEvent() failed', error, 'R_DOM_ERR');
                    });
                    sendResponse({ success: true });
                    return;
                }
                case 'START_RECORDING': {
                    safeInfo('Handling START_RECORDING', { from }, 'R_START');
                    try {
                        await startRecording();
                        safeInfo('startRecording() completed', undefined, 'R_START_OK');
                        sendResponse({ success: true });
                    }
                    catch (error) {
                        await logError('Background', 'startRecording() failed', error, 'R_START_ERR');
                        sendResponse({
                            success: false,
                            error: error?.message ||
                                (error instanceof Error ? error.toString() : String(error)) ||
                                'Unknown error occurred',
                        });
                    }
                    return;
                }
                case 'STOP_RECORDING': {
                    safeInfo('Handling STOP_RECORDING', { from }, 'R_STOP');
                    try {
                        await stopRecording();
                        safeInfo('stopRecording() completed', undefined, 'R_STOP_OK');
                        sendResponse({ success: true });
                    }
                    catch (error) {
                        await logError('Background', 'stopRecording() failed', error, 'R_STOP_ERR');
                        sendResponse({
                            success: false,
                            error: error?.message ||
                                (error instanceof Error ? error.toString() : String(error)) ||
                                'Unknown error occurred',
                        });
                    }
                    return;
                }
                case 'GET_RECORDING_STATUS': {
                    sendResponse({ isRecording: getRecordingStatus() });
                    return;
                }
                default: {
                    // Unknown message types are worth logging once.
                    safeWarn('Unknown message type', { type: message?.type, from }, 'R_UNKNOWN');
                    sendResponse({ success: false, error: `Unknown message type: ${message?.type}` });
                    return;
                }
            }
        }
        catch (error) {
            // Keep one hard error log for truly unexpected failures.
            console.error('[Background] Unexpected error in message handler:', error);
            sendResponse({ success: false, error: error?.message || 'Unexpected error occurred' });
        }
    })();
    return true; // async response
});
// Attempt to authenticate on startup (dev/testing only)
async function ensureAuthenticated() {
    try {
        const authenticated = await isAuthenticated();
        if (authenticated)
            return;
        try {
            const success = await login('test@example.com', 'password');
            if (success)
                safeInfo('Auto-login successful', undefined, 'AUTH_OK');
        }
        catch (error) {
            // If backend isn't reachable, don't spam logs.
            const isNetworkError = error instanceof TypeError &&
                (String(error.message).includes('Failed to fetch') ||
                    String(error.message).includes('NetworkError'));
            if (!isNetworkError) {
                safeWarn('Auto-login failed', { message: error?.message || String(error) }, 'AUTH_FAIL');
            }
        }
    }
    catch {
        // Deliberately silent: auth check should never block startup.
    }
}
// Wrapper to ensure authentication before processing queue
async function checkConnectionAndProcessQueueWithAuth() {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            try {
                await login('test@example.com', 'password');
            }
            catch {
                // Silently fail — queue will retry later
            }
        }
        await checkConnectionAndProcessQueue();
    }
    catch (error) {
        // Queue processing failures matter, but keep it compact.
        await logError('Background', 'Queue processing failed', error, 'QUEUE_ERR');
    }
}
// Startup hooks
chrome.runtime.onStartup.addListener(() => {
    cleanupOldScreenshotData();
    void checkConnectionAndProcessQueueWithAuth();
});
chrome.runtime.onInstalled.addListener(() => {
    cleanupOldScreenshotData();
    void checkConnectionAndProcessQueueWithAuth();
});
// Cleanup on service worker startup
cleanupOldScreenshotData();
// Ensure authentication on startup
void ensureAuthenticated();
// Listen for tab navigation to capture navigation events
chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.frameId === 0 && getRecordingStatus()) {
        const event = {
            type: 'navigation',
            target: { tagName: 'BODY', selector: 'body' },
            url: details.url,
            timestamp: Date.now(),
        };
        recordEvent(event).catch(async (error) => {
            await logError('Background', 'recordEvent(navigation) failed', error, 'NAV_ERR');
        });
    }
});
// Periodic check for offline queue (every 30 seconds)
setInterval(() => {
    void checkConnectionAndProcessQueueWithAuth();
}, 30000);
// One init log is fine.
safeInfo('Service worker initialized', undefined, 'INIT');
