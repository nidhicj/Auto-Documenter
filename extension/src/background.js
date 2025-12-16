import { recordEvent, startRecording, stopRecording, getRecordingStatus, cleanupOldScreenshotData } from './record';
import { checkConnectionAndProcessQueue } from './offlineQueue';
import { logInfo, logError, logWarn } from './logger';
import { isAuthenticated, login } from './auth';
// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Wrap in async function to handle properly
    (async () => {
        try {
            await logInfo('Background', 'Received runtime message', { type: message.type, from: sender?.tab?.id ? `tab-${sender.tab.id}` : 'popup' }, 'R2.1');
            // console.log('[Background] Message received:', {
            //   type: message.type,
            //   sender: sender.tab?.id ? `tab-${sender.tab.id}` : 'popup',
            //   url: sender.tab?.url,
            // });
            if (message.type === 'DOM_EVENT') {
                const event = message.event;
                // console.log('[Background] DOM_EVENT received:', event.type, event.target?.selector);
                recordEvent(event).catch((error) => {
                    console.error('[Background] Error recording DOM event:', error);
                });
                sendResponse({ success: true });
            }
            else if (message.type === 'START_RECORDING') {
                await logInfo('Background', 'Handling START_RECORDING', { from: sender?.tab?.id ? `tab-${sender.tab.id}` : 'popup' }, 'R2.2');
                // console.log('[Background] START_RECORDING message received, calling startRecording()...');
                try {
                    await startRecording();
                    await logInfo('Background', 'startRecording() completed', undefined, 'R3.1');
                    // console.log('[Background] startRecording() completed successfully');
                    sendResponse({ success: true });
                }
                catch (error) {
                    await logError('Background', 'startRecording() failed', error, 'R3.1_ERR');
                    console.error('[Background] startRecording() failed:', error);
                    console.error('[Background] Error details:', {
                        message: error?.message || String(error),
                        stack: error?.stack,
                        name: error?.name,
                        error: error,
                    });
                    const errorMessage = error?.message || (error instanceof Error ? error.toString() : String(error)) || 'Unknown error occurred';
                    sendResponse({ success: false, error: errorMessage });
                }
            }
            else if (message.type === 'STOP_RECORDING') {
                await logInfo('Background', 'Handling STOP_RECORDING', { from: sender?.tab?.id ? `tab-${sender.tab.id}` : 'popup' }, 'R_STOP_2.1');
                // console.log('[Background] STOP_RECORDING message received');
                try {
                    await stopRecording();
                    await logInfo('Background', 'stopRecording() completed', undefined, 'R_STOP_2.2');
                    // console.log('[Background] stopRecording() completed successfully');
                    sendResponse({ success: true });
                }
                catch (error) {
                    await logError('Background', 'stopRecording() failed', error, 'R_STOP_2.2_ERR');
                    console.error('[Background] stopRecording() failed:', error);
                    const errorMessage = error?.message || (error instanceof Error ? error.toString() : String(error)) || 'Unknown error occurred';
                    sendResponse({ success: false, error: errorMessage });
                }
            }
            else if (message.type === 'GET_RECORDING_STATUS') {
                const status = getRecordingStatus();
                // console.log('[Background] GET_RECORDING_STATUS requested, returning:', status);
                sendResponse({ isRecording: status });
            }
            else {
                await logWarn('Background', 'Unknown message type', { type: message.type }, undefined);
                console.warn('[Background] Unknown message type:', message.type);
                sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
            }
        }
        catch (error) {
            console.error('[Background] Unexpected error in message handler:', error);
            sendResponse({ success: false, error: error?.message || 'Unexpected error occurred' });
        }
    })();
    return true; // Indicate we will send response asynchronously
});
// Process offline queue on startup
chrome.runtime.onStartup.addListener(() => {
    cleanupOldScreenshotData();
    checkConnectionAndProcessQueueWithAuth();
});
// Process offline queue when extension is installed/updated
chrome.runtime.onInstalled.addListener(() => {
    cleanupOldScreenshotData();
    checkConnectionAndProcessQueueWithAuth();
});
// Cleanup on service worker startup
cleanupOldScreenshotData();
// Attempt to authenticate on startup (for development/testing)
async function ensureAuthenticated() {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            // console.log('[Background] Not authenticated, attempting auto-login...');
            // Try to auto-login with a default user for development
            // In production, this would be handled through a proper login flow
            try {
                // Using a default test user - in production, this would come from user input
                const success = await login('test@example.com', 'password');
                if (success) {
                    // console.log('[Background] Auto-login successful');
                    await logInfo('Background', 'Auto-login successful', undefined, 'AUTH_1');
                }
                else {
                    console.log('[Background] Auto-login failed - user must authenticate manually');
                    // Don't log as warning - this is expected if backend is not configured
                }
            }
            catch (error) {
                // Check if it's a network error (backend not running)
                const isNetworkError = error instanceof TypeError &&
                    (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'));
                // if (isNetworkError) {
                // Backend is likely not running - this is OK, don't log as error
                // console.log('[Background] Auto-login skipped - backend not reachable (this is OK if backend is not running)');
                // } else {
                // Other errors (auth failures, etc.) - log as warning
                // console.warn('[Background] Auto-login failed:', error instanceof Error ? error.message : String(error));
                // await logWarn('Background', 'Auto-login failed', error, 'AUTH_1_ERR');
                // }
                // Don't throw - allow extension to work without auth initially
                // User can authenticate later through popup or when needed
            }
        } //else {
        // console.log('[Background] Already authenticated');
        // }
    }
    catch (error) {
        console.error('[Background] Error checking authentication:', error);
        // Don't block extension startup
    }
}
// Ensure authentication on startup
ensureAuthenticated();
// Wrapper to ensure authentication before processing queue
// This handles the case where backend wasn't running at startup
async function checkConnectionAndProcessQueueWithAuth() {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
        console.log('[Background] Not authenticated before queue processing, attempting auto-login...');
        try {
            const success = await login('test@example.com', 'password');
            if (success) {
                console.log('[Background] Auto-login successful before queue processing');
            }
        }
        catch (error) {
            // Silently fail - queue will retry later
        }
    }
    // Now process the queue
    await checkConnectionAndProcessQueue();
}
// Listen for tab navigation to capture navigation events
chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.frameId === 0 && getRecordingStatus()) {
        // Main frame navigation
        const event = {
            type: 'navigation',
            target: {
                tagName: 'BODY',
                selector: 'body',
            },
            url: details.url,
            timestamp: Date.now(),
        };
        recordEvent(event).catch(console.error);
    }
});
// Periodic check for offline queue (every 30 seconds)
// setInterval(() => {
//   checkConnectionAndProcessQueueWithAuth();
// }, 30000);
console.log('[Background] Service worker initialized');
