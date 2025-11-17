import { ScreenshotData, DOMEvent } from './types';

const SCREENSHOT_THROTTLE_MS = 500;
let lastScreenshotTime = 0;
let screenshotQueue: ScreenshotData[] = [];

/**
 * Capture screenshot with throttling (max 1 per 500ms unless forced)
 */
export async function captureScreenshot(
  stepIndex: number,
  domEvent: DOMEvent,
  force: boolean = false
): Promise<ScreenshotData | null> {
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

    // Capture visible tab
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 90,
    });

    lastScreenshotTime = now;

    const screenshotData: ScreenshotData = {
      stepIndex,
      screenshotBase64: dataUrl,
      domEvent,
      timestamp: now,
    };

    // Store locally for offline support
    await storeScreenshotLocally(screenshotData);

    return screenshotData;
  } catch (error) {
    console.error('[Screenshot] Capture failed:', error);
    return null;
  }
}

/**
 * Store screenshot in chrome.storage.local for offline support
 */
async function storeScreenshotLocally(screenshot: ScreenshotData): Promise<void> {
  try {
    const { pendingScreenshots = [] } = await chrome.storage.local.get('pendingScreenshots');
    pendingScreenshots.push(screenshot);
    await chrome.storage.local.set({ pendingScreenshots });
    console.log(`[Screenshot] Stored locally (total: ${pendingScreenshots.length})`);
  } catch (error) {
    console.error('[Screenshot] Failed to store locally:', error);
  }
}

/**
 * Get all pending screenshots from local storage
 */
export async function getPendingScreenshots(): Promise<ScreenshotData[]> {
  try {
    const { pendingScreenshots = [] } = await chrome.storage.local.get('pendingScreenshots');
    return pendingScreenshots;
  } catch (error) {
    console.error('[Screenshot] Failed to get pending screenshots:', error);
    return [];
  }
}

/**
 * Clear pending screenshots from local storage
 */
export async function clearPendingScreenshots(): Promise<void> {
  try {
    await chrome.storage.local.remove('pendingScreenshots');
    console.log('[Screenshot] Cleared pending screenshots');
  } catch (error) {
    console.error('[Screenshot] Failed to clear pending screenshots:', error);
  }
}

/**
 * Add screenshot to upload queue
 */
export function queueScreenshot(screenshot: ScreenshotData): void {
  screenshotQueue.push(screenshot);
}

/**
 * Get and clear screenshot queue
 */
export function flushScreenshotQueue(): ScreenshotData[] {
  const queue = [...screenshotQueue];
  screenshotQueue = [];
  return queue;
}



