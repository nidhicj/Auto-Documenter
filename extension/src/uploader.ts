import { ScreenshotData, UploadResponse } from './types';
import { PendingScreenshot } from './offlineQueue';
import { logError } from './logger';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

/**
 * Get signed URL for screenshot upload
 */
async function getSignedUrl(key: string): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/media/signed-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        contentType: 'image/png',
        expiresIn: 3600, // 1 hour
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get signed URL: ${response.statusText}`);
    }

    const data = await response.json();
    return data.signedUrl;
  } catch (error) {
    logError('Uploader', 'Failed to get signed URL', error);
    throw error;
  }
}

/**
 * Upload screenshot to S3 via signed URL
 */
export async function uploadScreenshot(
  screenshot: ScreenshotData,
  key: string
): Promise<UploadResponse> {
  try {
    // Get signed URL
    const signedUrl = await getSignedUrl(key);

    // Convert base64 to blob
    const base64Data = screenshot.screenshotBase64.split(',')[1];
    const blob = await fetch(`data:image/png;base64,${base64Data}`).then((r) => r.blob());

    // Upload to S3
    const uploadResponse = await fetch(signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'image/png',
      },
      body: blob,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.statusText}`);
    }

    // Notify backend of successful upload
    await notifyUploadComplete(key, screenshot);

    return {
      url: `${API_BASE_URL}/api/media/${key}`,
      signedUrl,
      key,
    };
  } catch (error) {
    logError('Uploader', 'Upload failed', error);
    throw error;
  }
}

/**
 * Notify backend that upload is complete
 */
async function notifyUploadComplete(key: string, screenshot: ScreenshotData): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/media/upload-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        stepIndex: screenshot.stepIndex,
        timestamp: screenshot.timestamp,
        domEvent: screenshot.domEvent,
      }),
    });
  } catch (error) {
    logError('Uploader', 'Failed to notify upload completion', error);
    // Non-critical, don't throw
  }
}

/**
 * Batch upload multiple screenshots
 */
export async function uploadScreenshots(
  screenshots: ScreenshotData[]
): Promise<UploadResponse[]> {
  const uploadPromises = screenshots.map((screenshot, index) => {
    const key = `screenshots/${Date.now()}-${index}-${screenshot.stepIndex}.png`;
    return uploadScreenshot(screenshot, key);
  });

  return Promise.all(uploadPromises);
}




