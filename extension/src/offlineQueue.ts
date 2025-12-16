import { ScreenshotData } from './types';
import { uploadScreenshot } from './uploader';

export interface PendingScreenshot {
  stepIndex: number;
  screenshotBase64: string; // Keep base64 for retry uploads
  screenshotKey?: string; // MinIO key if upload was attempted
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
        const key = pending.screenshotKey || pending.key;
        const uploadResult = await uploadScreenshot(
          {
            stepIndex: pending.stepIndex,
            screenshotBase64: pending.screenshotBase64,
            domEvent: pending.domEvent,
            timestamp: pending.timestamp,
          },
          key
        );
        
        // Update metadata in chrome.storage with the uploaded URL
        const { screenshotMetadata = [] } = await chrome.storage.local.get('screenshotMetadata');
        const metadataIndex = screenshotMetadata.findIndex(
          (m: ScreenshotData) => m.stepIndex === pending.stepIndex && m.timestamp === pending.timestamp
        );
        if (metadataIndex >= 0) {
          screenshotMetadata[metadataIndex].screenshotUrl = uploadResult.url;
          screenshotMetadata[metadataIndex].screenshotKey = uploadResult.key;
          await chrome.storage.local.set({ screenshotMetadata });
        }
        
        successful.push(key);
      } catch (error) {
        // Check if it's a network error (backend not running)
        const isNetworkError = error instanceof Error && 
          (error.message.includes('Failed to fetch') || 
           error.message.includes('NetworkError') ||
           error.message.includes('Backend not reachable'));
        
        if (isNetworkError) {
          // Backend is likely not running - this is expected, don't log as error
          // Just silently queue for retry
        } else {
          // Other errors (auth, etc.) - log as error
          console.error(`[OfflineQueue] Upload failed for ${pending.key}:`, error);
        }
        
        if (pending.retryCount < MAX_RETRIES) {
          pending.retryCount++;
          failed.push(pending);
        } else {
          if (!isNetworkError) {
            // Only log max retries for non-network errors
            console.error(`[OfflineQueue] Max retries reached for ${pending.key}`);
          }
        }
      }
    }

    // Remove successful uploads, update failed ones
    const updatedPending = failed;
    await chrome.storage.local.set({ pendingUploads: updatedPending });

    if (successful.length > 0) {
      console.log(`[OfflineQueue] Completed: ${successful.length} successful, ${failed.length} queued for retry`);
    } else if (failed.length > 0) {
      // Only log if we have items to retry - this is expected if backend is offline
      // Don't log as error, just as info
      console.log(`[OfflineQueue] ${failed.length} upload(s) queued for retry (backend may be offline)`);
    }
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
      screenshotBase64: screenshot.screenshotBase64 || '',
      screenshotKey: screenshot.screenshotKey,
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
  if (!navigator.onLine) {
    return; // Not online, skip
  }
  
  // Process queue - errors will be handled gracefully inside processOfflineQueue
  await processOfflineQueue();
}

// Listen for online event
// Service workers use 'self', regular scripts use 'window'
if (typeof self !== 'undefined' && 'addEventListener' in self) {
  self.addEventListener('online', () => {
    console.log('[OfflineQueue] Connection restored, processing queue');
    processOfflineQueue();
  });
} else if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineQueue] Connection restored, processing queue');
    processOfflineQueue();
  });
}



