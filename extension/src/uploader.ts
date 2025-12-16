import { ScreenshotData, UploadResponse } from './types';
import { PendingScreenshot } from './offlineQueue';
import { getAuthHeader, login, getAuthToken } from './auth';

// API_BASE_URL will be replaced at build time by Vite define
// @ts-ignore - process.env.API_BASE_URL is replaced at build time
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

/**
 * Get signed URL for screenshot upload
 */
async function getSignedUrl(key: string): Promise<string> {
  try {
    const authHeader = await getAuthHeader();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const url = `${API_BASE_URL}/api/media/signed-url`;
    console.log('[Uploader] Requesting signed URL from:', url);
    console.log('[Uploader] Request headers:', { ...headers, Authorization: authHeader ? 'Bearer ***' : 'none' });

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        key,
        contentType: 'image/png',
        expiresIn: 3600, // 1 hour
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error('[Uploader] Request failed:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url,
      });
      if (response.status === 401) {
        const error = new Error(`Failed to get signed URL: Unauthorized`);
        console.error('[Uploader] Authentication failed. Please ensure you are logged in.');
        throw error;
      }
      throw new Error(`Failed to get signed URL: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[Uploader] Signed URL received successfully');
    return data.signedUrl;
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.error('[Uploader] Network error - Backend may not be running or CORS issue:', {
        apiBaseUrl: API_BASE_URL,
        error: error.message,
        suggestion: 'Check if backend is running on ' + API_BASE_URL,
      });
    } else {
      console.error('[Uploader] Failed to get signed URL:', error);
    }
    throw error;
  }
}

/**
 * Upload screenshot to MinIO (S3-compatible) via signed URL
 */
export async function uploadScreenshot(
  screenshot: ScreenshotData,
  key: string
): Promise<UploadResponse> {
  try {
    // If already uploaded, return existing URL
    if (screenshot.screenshotUrl && screenshot.screenshotKey) {
      return {
        url: screenshot.screenshotUrl,
        signedUrl: screenshot.screenshotUrl,
        key: screenshot.screenshotKey,
      };
    }

    // Ensure we have base64 data
    if (!screenshot.screenshotBase64) {
      throw new Error('Screenshot base64 data is required for upload');
    }

    // Convert base64 to blob
    const base64Data = screenshot.screenshotBase64.split(',')[1];
    const blob = await fetch(`data:image/png;base64,${base64Data}`).then((r) => r.blob());

    // Upload via backend proxy to avoid CORS issues
    console.log('[Uploader] Uploading via backend proxy...');
    console.log('[Uploader] Blob size:', blob.size, 'bytes');
    
    // Ensure we're authenticated before uploading
    const { isAuthenticated, login } = await import('./auth');
    const authenticated = await isAuthenticated();
    console.log('[Uploader] Authentication check:', authenticated);
    if (!authenticated) {
      console.log('[Uploader] Not authenticated, attempting auto-login before upload...');
      try {
        const loginResult = await login('test@example.com', 'password');
        console.log('[Uploader] Login result:', loginResult);
        if (loginResult) {
          console.log('[Uploader] Auto-login successful before upload');
          // Verify token was stored
          const tokenAfterLogin = await getAuthToken();
          console.log('[Uploader] Token after login:', tokenAfterLogin ? 'EXISTS' : 'MISSING');
        } else {
          console.error('[Uploader] Auto-login returned false');
        }
      } catch (error) {
        console.error('[Uploader] Auto-login failed before upload:', error);
        // Continue anyway - will get 401 and retry with re-auth
      }
    }
    
    const authHeader = await getAuthHeader();
    console.log('[Uploader] Auth header after check:', authHeader ? 'EXISTS' : 'MISSING');
    if (authHeader) {
      // Log first 50 chars of token for debugging (without exposing full token)
      const tokenPreview = authHeader.substring(0, 50) + '...';
      console.log('[Uploader] Auth header preview:', tokenPreview);
      
      // Validate token format (should be "Bearer <token>")
      if (!authHeader.startsWith('Bearer ')) {
        console.error('[Uploader] Invalid auth header format - should start with "Bearer "');
      } else {
        const token = authHeader.substring(7); // Remove "Bearer " prefix
        // Basic JWT format check (should have 3 parts separated by dots)
        const parts = token.split('.');
        if (parts.length !== 3) {
          console.error('[Uploader] Invalid JWT format - should have 3 parts, got:', parts.length);
        } else {
          console.log('[Uploader] Token format valid (3 parts)');
        }
      }
    }
    
    const formData = new FormData();
    formData.append('file', blob, 'screenshot.png');
    formData.append('key', key);
    if (screenshot.stepIndex !== undefined) {
      formData.append('stepIndex', screenshot.stepIndex.toString());
    }
    if (screenshot.timestamp) {
      formData.append('timestamp', screenshot.timestamp.toString());
    }
    if (screenshot.domEvent) {
      formData.append('domEvent', JSON.stringify(screenshot.domEvent));
    }

    // Don't set Content-Type header - browser will set it automatically with boundary for FormData
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    console.log('[Uploader] Sending request to:', `${API_BASE_URL}/api/media/upload`);
    console.log('[Uploader] Has auth header:', !!authHeader);
    console.log('[Uploader] Headers being sent:', Object.keys(headers));

    let uploadResponse: Response;
    try {
      uploadResponse = await fetch(`${API_BASE_URL}/api/media/upload`, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch (fetchError) {
      // Check if it's a network error (backend not running)
      console.error('[Uploader] Raw fetch error:', fetchError);
      const isNetworkError = fetchError instanceof TypeError && 
        (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError'));
      
      if (isNetworkError) {
        // Backend not reachable - this is expected if backend is offline
        // Don't log as error, just throw so caller can handle gracefully
        console.error('[Uploader] Network error:', isNetworkError);
        throw new Error(`Failed to upload screenshot: Backend not reachable`);
      } else {
        // Other errors - log with details
        console.error('[Uploader] Fetch error details:', {
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          apiUrl: `${API_BASE_URL}/api/media/upload`,
          suggestion: 'Backend might not be running or CORS not configured. Check if backend is running.',
        });
        throw new Error(`Failed to upload screenshot: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
      }
    }

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => uploadResponse.statusText);
      console.error('[Uploader] Upload response error:', {
        status: uploadResponse.status,
        statusText: uploadResponse.statusText,
        errorText,
        apiUrl: `${API_BASE_URL}/api/media/upload`,
      });
      if (uploadResponse.status === 401) {
        // Try to re-authenticate automatically
        console.log('[Uploader] 401 Unauthorized - attempting to re-authenticate...');
        try {
          // Clear existing token first
          const { clearAuthToken } = await import('./auth');
          await clearAuthToken();
          
          // Get fresh token
          const loginSuccess = await login('test@example.com', 'password');
          if (loginSuccess) {
            console.log('[Uploader] Re-authentication successful, retrying upload...');
            // Get the new token and verify it
            const newToken = await getAuthToken();
            console.log('[Uploader] New token after re-auth:', newToken ? `EXISTS (${newToken.substring(0, 30)}...)` : 'MISSING');
            
            // Retry upload with new token - need to recreate FormData as it's been consumed
            const retryFormData = new FormData();
            retryFormData.append('file', blob, 'screenshot.png');
            retryFormData.append('key', key);
            if (screenshot.stepIndex !== undefined) {
              retryFormData.append('stepIndex', screenshot.stepIndex.toString());
            }
            if (screenshot.timestamp) {
              retryFormData.append('timestamp', screenshot.timestamp.toString());
            }
            if (screenshot.domEvent) {
              retryFormData.append('domEvent', JSON.stringify(screenshot.domEvent));
            }
            
            const newAuthHeader = await getAuthHeader();
            const retryHeaders: Record<string, string> = {};
            if (newAuthHeader) {
              retryHeaders['Authorization'] = newAuthHeader;
              console.log('[Uploader] Retry with auth header:', newAuthHeader.substring(0, 50) + '...');
            } else {
              console.error('[Uploader] No auth header available for retry!');
            }
            
            const retryResponse = await fetch(`${API_BASE_URL}/api/media/upload`, {
              method: 'POST',
              headers: retryHeaders,
              body: retryFormData,
            });
            
            if (!retryResponse.ok) {
              const retryErrorText = await retryResponse.text().catch(() => retryResponse.statusText);
              console.error('[Uploader] Retry failed:', {
                status: retryResponse.status,
                errorText: retryErrorText,
              });
              throw new Error(`Upload failed after re-auth: ${retryResponse.status} ${retryErrorText}`);
            }
            const retryResult = await retryResponse.json();
            console.log('[Uploader] Upload successful after re-authentication:', retryResult);
            await notifyUploadComplete(retryResult.key, screenshot);
            return {
              url: retryResult.url,
              signedUrl: retryResult.url,
              key: retryResult.key,
            };
          } else {
            throw new Error('Upload failed: Unauthorized - Re-authentication failed');
          }
        } catch (authError) {
          console.error('[Uploader] Re-authentication failed:', authError);
          throw new Error('Upload failed: Unauthorized - Please authenticate');
        }
      }
      throw new Error(`Upload failed: ${uploadResponse.status} ${errorText}`);
    }
    
    const uploadResult = await uploadResponse.json();
    console.log('[Uploader] Upload successful:', uploadResult);

    // Notify backend of successful upload
    await notifyUploadComplete(uploadResult.key, screenshot);

    return {
      url: uploadResult.url,
      signedUrl: uploadResult.url, // Use the same URL for both
      key: uploadResult.key,
    };
  } catch (error) {
    console.error('[Uploader] Upload failed:', error);
    throw error;
  }
}

/**
 * Notify backend that upload is complete
 */
async function notifyUploadComplete(key: string, screenshot: ScreenshotData): Promise<void> {
  try {
    const authHeader = await getAuthHeader();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    await fetch(`${API_BASE_URL}/api/media/upload-complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        key,
        stepIndex: screenshot.stepIndex,
        timestamp: screenshot.timestamp,
        domEvent: screenshot.domEvent,
      }),
    });
  } catch (error) {
    console.error('[Uploader] Failed to notify upload complete:', error);
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



