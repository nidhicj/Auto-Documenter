import { ScreenshotData } from './types';
import { uploadScreenshot } from './uploader';
import { logInfo, logWarn, logError } from './logger';

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

    logInfo('OfflineQueue', 'Processing pending uploads', { count: pendingUploads.length });

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
        logError('OfflineQueue', `Upload failed for ${pending.key}`, error);
        
        if (pending.retryCount < MAX_RETRIES) {
          pending.retryCount++;
          failed.push(pending);
        } else {
          logWarn('OfflineQueue', `Max retries reached for ${pending.key}`);
        }
      }
    }

    // Remove successful uploads, update failed ones
    const updatedPending = failed;
    await chrome.storage.local.set({ pendingUploads: updatedPending });

    logInfo('OfflineQueue', 'Offline queue processing complete', {
      successful: successful.length,
      failed: failed.length,
    });
  } catch (error) {
    logError('OfflineQueue', 'Process failed', error);
  }
}

const MAX_PENDING_UPLOADS = 30; // Limit pending uploads to prevent quota exceeded

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

    // Limit the number of pending uploads to prevent quota exceeded
    const updatedUploads = [...pendingUploads, pending];
    if (updatedUploads.length > MAX_PENDING_UPLOADS) {
      // Remove oldest uploads, keep only the most recent ones
      const removed = updatedUploads.length - MAX_PENDING_UPLOADS;
      updatedUploads.splice(0, removed);
      logInfo('OfflineQueue', 'Removed old uploads to prevent quota exceeded', { removed });
    }

    await chrome.storage.local.set({ pendingUploads: updatedUploads });
    logInfo('OfflineQueue', 'Added screenshot to offline queue', {
      key,
      total: updatedUploads.length,
    });
  } catch (error: any) {
    // If quota exceeded, try to clean up
    if (error.message && error.message.includes('quota')) {
      logWarn('OfflineQueue', 'Quota exceeded, cleaning up old uploads');
      try {
        const { pendingUploads = [] } = await chrome.storage.local.get('pendingUploads');
        // Keep only the 10 most recent uploads
        const recentUploads = pendingUploads.slice(-10);
        recentUploads.push({
          stepIndex: screenshot.stepIndex,
          screenshotBase64: screenshot.screenshotBase64,
          domEvent: screenshot.domEvent,
          timestamp: screenshot.timestamp,
          retryCount: 0,
          key,
        });
        await chrome.storage.local.set({ pendingUploads: recentUploads.slice(-10) });
        logInfo('OfflineQueue', 'Cleaned up old uploads and added current screenshot');
      } catch (cleanupError) {
      logError('OfflineQueue', 'Failed to clean up and add pending upload', cleanupError);
      }
    } else {
      logError('OfflineQueue', 'Failed to add screenshot to queue', error);
    }
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
    logInfo('OfflineQueue', 'Connection restored, processing queue');
    processOfflineQueue();
  });
}




