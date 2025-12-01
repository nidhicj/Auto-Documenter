import { logInfo, logWarn, logError } from './logger';
// Chrome limits captureVisibleTab to ~2 calls per second
// Use 1000ms (1 second) to be safe and avoid quota errors
const SCREENSHOT_THROTTLE_MS = 1000;
let lastScreenshotTime = 0;
let screenshotQueue = [];
let pendingScreenshot = null;
/**
 * Capture screenshot with throttling (max 1 per second to avoid Chrome quota)
 * Chrome limits captureVisibleTab to ~2 calls per second
 */
export async function captureScreenshot(stepIndex, domEvent, force = false) {
    const now = Date.now();
    const timeSinceLastScreenshot = now - lastScreenshotTime;
    // Throttle: skip if too soon (unless forced)
    if (!force && timeSinceLastScreenshot < SCREENSHOT_THROTTLE_MS) {
        logInfo('Screenshot', 'Throttled capture attempt', {
            timeSinceLastScreenshot,
            threshold: SCREENSHOT_THROTTLE_MS,
        });
        return null;
    }
    // If there's already a pending screenshot, wait for it to complete
    if (pendingScreenshot) {
        logInfo('Screenshot', 'Waiting for pending screenshot to complete');
        try {
            await pendingScreenshot;
        }
        catch (e) {
            // Ignore errors from previous screenshot
        }
        // Re-check throttle after waiting
        const newNow = Date.now();
        const newTimeSinceLastScreenshot = newNow - lastScreenshotTime;
        if (!force && newTimeSinceLastScreenshot < SCREENSHOT_THROTTLE_MS) {
            console.log(`[Screenshot] Still throttled after waiting (${newTimeSinceLastScreenshot}ms < ${SCREENSHOT_THROTTLE_MS}ms)`);
            return null;
        }
    }
    // Create a promise for this screenshot to prevent concurrent captures
    pendingScreenshot = (async () => {
        try {
            // Get current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab.id) {
                logError('Screenshot', 'No active tab found for capture');
                return null;
            }
            // Get window ID - try tab.windowId first, then fallback to current window
            let windowId;
            if (tab.windowId) {
                windowId = tab.windowId;
            }
            else {
                try {
                    const window = await chrome.windows.getCurrent();
                    windowId = window.id;
                }
                catch (e) {
                    // If we can't get window, try to get it from the tab's window
                    const tabInfo = await chrome.tabs.get(tab.id);
                    if (tabInfo.windowId) {
                        windowId = tabInfo.windowId;
                    }
                    else {
                        throw new Error('Could not determine window ID');
                    }
                }
            }
            // Capture visible tab
            // Note: activeTab permission is active when extension is invoked (user clicked icon)
            // Chrome limits captureVisibleTab to ~2 calls per second
            let dataUrl;
            try {
                dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
                    format: 'png',
                    quality: 90,
                });
            }
            catch (captureError) {
                // Handle quota exceeded error
                if (captureError.message && captureError.message.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND')) {
                    logWarn('Screenshot', 'Quota exceeded while capturing, waiting before retry');
                    // Wait a bit longer before retrying
                    await new Promise(resolve => setTimeout(resolve, SCREENSHOT_THROTTLE_MS));
                    // Update last screenshot time to prevent immediate retry
                    lastScreenshotTime = Date.now();
                    // Retry once
                    try {
                        dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
                            format: 'png',
                            quality: 90,
                        });
                    }
                    catch (retryError) {
                        logError('Screenshot', 'Retry capture failed after quota delay', retryError);
                        throw retryError;
                    }
                }
                else if (captureError.message && captureError.message.includes('activeTab')) {
                    logWarn('Screenshot', 'activeTab permission not active, trying fallback capture');
                    // Try again with explicit window ID from tab
                    const tabInfo = await chrome.tabs.get(tab.id);
                    if (tabInfo.windowId) {
                        dataUrl = await chrome.tabs.captureVisibleTab(tabInfo.windowId, {
                            format: 'png',
                            quality: 90,
                        });
                    }
                    else {
                        throw captureError;
                    }
                }
                else {
                    throw captureError;
                }
            }
            const captureTime = Date.now();
            lastScreenshotTime = captureTime;
            const screenshotData = {
                stepIndex,
                screenshotBase64: dataUrl,
                domEvent,
                timestamp: captureTime,
            };
            // Store locally for offline support
            await storeScreenshotLocally(screenshotData);
            return screenshotData;
        }
        catch (error) {
            logError('Screenshot', 'Capture failed', error);
            return null;
        }
        finally {
            // Clear pending screenshot after a delay to ensure proper throttling
            setTimeout(() => {
                pendingScreenshot = null;
            }, SCREENSHOT_THROTTLE_MS);
        }
    })();
    return pendingScreenshot;
}
/**
 * Store screenshot in chrome.storage.local for offline support
 * Note: Chrome storage has a ~10MB quota, so we limit stored screenshots
 */
const MAX_STORED_SCREENSHOTS = 50; // Limit to prevent quota exceeded errors
async function storeScreenshotLocally(screenshot) {
    try {
        const { pendingScreenshots = [] } = await chrome.storage.local.get('pendingScreenshots');
        // Limit the number of stored screenshots to prevent quota exceeded errors
        // Keep only the most recent screenshots
        const updatedScreenshots = [...pendingScreenshots, screenshot];
        if (updatedScreenshots.length > MAX_STORED_SCREENSHOTS) {
            // Remove oldest screenshots, keep only the most recent ones
            const removed = updatedScreenshots.length - MAX_STORED_SCREENSHOTS;
            updatedScreenshots.splice(0, removed);
            logInfo('Screenshot', 'Removed old screenshots to prevent quota exceeded', { removed });
        }
        await chrome.storage.local.set({ pendingScreenshots: updatedScreenshots });
        logInfo('Screenshot', 'Stored screenshot locally', { total: updatedScreenshots.length });
    }
    catch (error) {
        // If quota exceeded, try to clean up old screenshots
        if (error.message && error.message.includes('quota')) {
            logWarn('Screenshot', 'Quota exceeded while storing screenshots, cleaning up old entries');
            try {
                // Keep only the 10 most recent screenshots
                const { pendingScreenshots = [] } = await chrome.storage.local.get('pendingScreenshots');
                const recentScreenshots = pendingScreenshots.slice(-10);
                recentScreenshots.push(screenshot);
                await chrome.storage.local.set({ pendingScreenshots: recentScreenshots.slice(-10) });
                logInfo('Screenshot', 'Cleaned up stored screenshots and added new entry');
            }
            catch (cleanupError) {
                logError('Screenshot', 'Failed to clean up stored screenshots', cleanupError);
                // If still failing, don't store locally - screenshots will be lost if offline
                // but at least recording can continue
            }
        }
        else {
            logError('Screenshot', 'Failed to store screenshot locally', error);
        }
    }
}
/**
 * Get all pending screenshots from local storage
 */
export async function getPendingScreenshots() {
    try {
        const { pendingScreenshots = [] } = await chrome.storage.local.get('pendingScreenshots');
        return pendingScreenshots;
    }
    catch (error) {
        console.error('[Screenshot] Failed to get pending screenshots:', error);
        return [];
    }
}
/**
 * Clear pending screenshots from local storage
 */
export async function clearPendingScreenshots() {
    try {
        await chrome.storage.local.remove('pendingScreenshots');
        logInfo('Screenshot', 'Cleared pending screenshots');
    }
    catch (error) {
        logError('Screenshot', 'Failed to clear pending screenshots', error);
    }
}
/**
 * Add screenshot to upload queue
 */
export function queueScreenshot(screenshot) {
    screenshotQueue.push(screenshot);
}
/**
 * Get and clear screenshot queue
 */
export function flushScreenshotQueue() {
    const queue = [...screenshotQueue];
    screenshotQueue = [];
    return queue;
}
