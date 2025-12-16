import { uploadScreenshot } from './uploader';
import { addToOfflineQueue } from './offlineQueue';
const SCREENSHOT_THROTTLE_MS = 500;
let lastScreenshotTime = 0;
let screenshotQueue = [];
/**
 * Capture screenshot with throttling (max 1 per 500ms unless forced)
 * Immediately uploads to MinIO and stores only URL/key in chrome.storage
 */
export async function captureScreenshot(stepIndex, domEvent, force = false) {
    const now = Date.now();
    const timeSinceLastScreenshot = now - lastScreenshotTime;
    // Throttle: skip if too soon (unless forced)
    if (!force && timeSinceLastScreenshot < SCREENSHOT_THROTTLE_MS) {
        console.log(`[Screenshot] Throttled (${timeSinceLastScreenshot}ms < ${SCREENSHOT_THROTTLE_MS}ms)`);
        return null;
    }
    try {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.id) {
            console.error('[Screenshot] No active tab found');
            return null;
        }
        // Check if we can capture this tab (chrome:// and extension pages can't be captured)
        if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://'))) {
            console.warn('[Screenshot] Cannot capture restricted page:', tab.url);
            return null;
        }
        // Capture visible tab
        let dataUrl;
        try {
            dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
                format: 'png',
                quality: 90,
            });
        }
        catch (captureError) {
            console.error('[Screenshot] Failed to capture tab:', captureError);
            // If capture fails, return null but don't throw - allow recording to continue
            return null;
        }
        lastScreenshotTime = now;
        // Create initial screenshot data with base64
        const screenshotData = {
            stepIndex,
            screenshotBase64: dataUrl,
            domEvent,
            timestamp: now,
        };
        // Try to upload to MinIO immediately
        try {
            const key = `screenshots/${Date.now()}-${stepIndex}-${now}.png`;
            const uploadResult = await uploadScreenshot(screenshotData, key);
            // Success: replace base64 with URL/key
            screenshotData.screenshotUrl = uploadResult.url;
            screenshotData.screenshotKey = uploadResult.key;
            delete screenshotData.screenshotBase64; // Remove base64 to save storage
            console.log(`[Screenshot] Uploaded to MinIO: ${uploadResult.key}`);
        }
        catch (uploadError) {
            console.warn('[Screenshot] Upload failed, will retry:', uploadError);
            // Upload failed: queue for retry (keep base64 for now)
            const key = `screenshots/${Date.now()}-${stepIndex}-${now}.png`;
            await addToOfflineQueue(screenshotData, key);
            // Keep base64 in screenshotData for retry, but don't store in chrome.storage.local
        }
        // Store only metadata (URL/key) in chrome.storage.local, not base64
        await storeScreenshotMetadata(screenshotData);
        return screenshotData;
    }
    catch (error) {
        console.error('[Screenshot] Capture failed:', error);
        return null;
    }
}
/**
 * Store screenshot metadata (URL/key only) in chrome.storage.local
 * Does NOT store base64 data to avoid quota issues
 */
async function storeScreenshotMetadata(screenshot) {
    try {
        // Only store metadata, not base64 data
        const metadata = {
            stepIndex: screenshot.stepIndex,
            screenshotUrl: screenshot.screenshotUrl,
            screenshotKey: screenshot.screenshotKey,
            domEvent: screenshot.domEvent,
            timestamp: screenshot.timestamp,
        };
        const { screenshotMetadata = [] } = await chrome.storage.local.get('screenshotMetadata');
        screenshotMetadata.push(metadata);
        await chrome.storage.local.set({ screenshotMetadata });
        console.log(`[Screenshot] Stored metadata (total: ${screenshotMetadata.length})`);
    }
    catch (error) {
        console.error('[Screenshot] Failed to store metadata:', error);
    }
}
/**
 * Get all screenshot metadata from local storage
 */
export async function getPendingScreenshots() {
    try {
        const { screenshotMetadata = [] } = await chrome.storage.local.get('screenshotMetadata');
        return screenshotMetadata;
    }
    catch (error) {
        console.error('[Screenshot] Failed to get screenshot metadata:', error);
        return [];
    }
}
/**
 * Clear screenshot metadata from local storage
 */
export async function clearPendingScreenshots() {
    try {
        await chrome.storage.local.remove('screenshotMetadata');
        console.log('[Screenshot] Cleared screenshot metadata');
    }
    catch (error) {
        console.error('[Screenshot] Failed to clear screenshot metadata:', error);
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
