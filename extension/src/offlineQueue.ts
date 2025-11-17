import { ScreenshotData } from './types';
import { uploadScreenshot } from './uploader';

export interface PendingScreenshot {
  stepIndex: number;
  screenshotBase64: string;
  domEvent: ScreenshotData['domEvent'];
  timestamp: number;
  retryCount: number;
  key: string;
}

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000; // 5 seconds

/**
 * Process offline queue when connection is restored
 */
export async function processOfflineQueue(): Promise<void> {
  try {
    const { pendingUploads = [] } = await chrome.storage.local.get('pendingUploads');
    
    if (pendingUploads.length === 0) {
      return;
    }

    console.log(`[OfflineQueue] Processing ${pendingUploads.length} pending uploads`);

    const successful: string[] = [];
    const failed: PendingScreenshot[] = [];

    for (const pending of pendingUploads) {
      try {
        await uploadScreenshot(
          {
            stepIndex: pending.stepIndex,
            screenshotBase64: pending.screenshotBase64,
            domEvent: pending.domEvent,
            timestamp: pending.timestamp,
          },
          pending.key
        );
        successful.push(pending.key);
      } catch (error) {
        console.error(`[OfflineQueue] Upload failed for ${pending.key}:`, error);
        
        if (pending.retryCount < MAX_RETRIES) {
          pending.retryCount++;
          failed.push(pending);
        } else {
          console.error(`[OfflineQueue] Max retries reached for ${pending.key}`);
        }
      }
    }

    // Remove successful uploads, update failed ones
    const updatedPending = failed;
    await chrome.storage.local.set({ pendingUploads: updatedPending });

    console.log(`[OfflineQueue] Completed: ${successful.length} successful, ${failed.length} failed`);
  } catch (error) {
    console.error('[OfflineQueue] Process failed:', error);
  }
}

/**
 * Add screenshot to offline queue
 */
export async function addToOfflineQueue(screenshot: ScreenshotData, key: string): Promise<void> {
  try {
    const { pendingUploads = [] } = await chrome.storage.local.get('pendingUploads');
    
    const pending: PendingScreenshot = {
      stepIndex: screenshot.stepIndex,
      screenshotBase64: screenshot.screenshotBase64,
      domEvent: screenshot.domEvent,
      timestamp: screenshot.timestamp,
      retryCount: 0,
      key,
    };

    pendingUploads.push(pending);
    await chrome.storage.local.set({ pendingUploads });
    console.log(`[OfflineQueue] Added to queue: ${key}`);
  } catch (error) {
    console.error('[OfflineQueue] Failed to add to queue:', error);
  }
}

/**
 * Check online status and process queue if online
 */
export async function checkConnectionAndProcessQueue(): Promise<void> {
  if (navigator.onLine) {
    await processOfflineQueue();
  }
}

// Listen for online event
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineQueue] Connection restored, processing queue');
    processOfflineQueue();
  });
}



