import { DOMEvent, WorkflowEvent } from './types';
import { captureScreenshot, queueScreenshot, flushScreenshotQueue } from './screenshot';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logError, logWarn } from './logger';
import { getAuthHeader, login } from './auth';

let isRecording = false;
let currentWorkflow: WorkflowEvent | null = null;
let stepIndex = 0;

/**
 * Start recording workflow
 */
export async function startRecording(): Promise<void> {
  await logInfo('Record', 'startRecording() called', undefined, 'R3.0');
  console.log('[Record] startRecording() called');
  
  if (isRecording) {
    await logWarn('Record', 'Already recording, aborting', undefined, 'R3.0_WARN');
    console.warn('[Record] Already recording, aborting');
    return;
  }

  console.log('[Record] Querying active tab...');
  let tab;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs[0];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Record] Failed to query tabs:', error);
    await logError('Record', 'Failed to query tabs', error, 'R_TAB_QUERY_ERR');
    throw new Error(`Failed to query active tab: ${errorMessage}`);
  }

  console.log('[Record] Active tab found:', {
    id: tab?.id,
    url: tab?.url,
    title: tab?.title,
  });
  
  if (!tab || !tab.id || !tab.url) {
    const error = new Error('No active tab found or tab URL is missing');
    console.error('[Record] Error:', error.message, { tab });
    await logError('Record', 'No active tab found', { tab }, 'R_NO_TAB_ERR');
    throw error;
  }

  console.log('[Record] Initializing recording state...');
  isRecording = true;
  stepIndex = 0;
  const recordingId = uuidv4();
  currentWorkflow = {
    id: recordingId,
    events: [],
    screenshots: [],
    startTime: Date.now(),
    url: tab.url,
    title: tab.title || 'Untitled',
  };
  await logInfo('Record', 'Recording session created', { recordingId, tabId: tab.id, url: tab.url }, 'R3.2', recordingId);
  console.log('[Record] Workflow created:', {
    id: currentWorkflow.id,
    url: currentWorkflow.url,
    title: currentWorkflow.title,
  });

  // Store workflow in storage (ensure no base64 data is stored)
  console.log('[Record] Storing workflow in chrome.storage.local...');
  try {
    const workflowToStore = sanitizeWorkflowForStorage(currentWorkflow);
    await chrome.storage.local.set({ currentWorkflow: workflowToStore, isRecording });
    console.log('[Record] Workflow stored successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Record] Failed to store workflow:', error);
    await logError('Record', 'Failed to store workflow', error, 'R_STORE_ERR', recordingId);
    throw new Error(`Failed to store workflow: ${errorMessage}`);
  }

  // Send START_RECORDING message to content script with recordingId
  try {
    await logInfo('Record', 'Sending START_RECORDING to content script', { tabId: tab.id }, 'R4', recordingId);
    await chrome.tabs.sendMessage(tab.id, { type: 'START_RECORDING', recordingId });
  } catch (error) {
    // Check if this is a restricted page (chrome://, chrome-extension://, etc.)
    const isRestrictedPage = tab.url && (
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('moz-extension://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('about:')
    );

    if (isRestrictedPage) {
      await logWarn('Record', 'Cannot inject script on restricted page', { url: tab.url, tabId: tab.id }, 'R4_INJECT_RESTRICTED', recordingId);
      console.warn('[Record] Cannot inject script on restricted page:', tab.url);
      // Continue recording - we just won't capture DOM events from this page
      return;
    }

    // If message fails, try injecting script as fallback (only on non-restricted pages)
    await logInfo('Record', 'Message to content script failed, falling back to script injection', { tabId: tab.id, error: error instanceof Error ? error.message : String(error) }, 'R4_INJECT', recordingId);
    console.log('[Record] Injecting script to dispatch scribe-start-recording event...');
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (recordingId) => {
          console.log('[Injected Script] Dispatching scribe-start-recording event');
          // Content script will handle DOM events
          window.dispatchEvent(new CustomEvent('scribe-start-recording', { detail: { recordingId } }));
          console.log('[Injected Script] Event dispatched');
        },
        args: [recordingId],
      });
      console.log('[Record] Script injected successfully');
    } catch (injectError) {
      await logError('Record', 'Failed to inject script', injectError, 'R4_INJECT_ERR', recordingId);
      console.error('[Record] Failed to inject script:', injectError);
      console.error('[Record] Injection error details:', {
        message: injectError instanceof Error ? injectError.message : String(injectError),
        stack: injectError instanceof Error ? injectError.stack : undefined,
        tabId: tab.id,
        url: tab.url,
      });
      // Don't throw here, continue with recording even if injection fails
    }
  }

  // Capture initial screenshot
  console.log('[Record] Creating initial navigation event...');
  const initialEvent: DOMEvent = {
    type: 'navigation',
    target: {
      tagName: 'BODY',
      selector: 'body',
    },
    url: tab.url,
    timestamp: Date.now(),
  };

  console.log('[Record] Capturing initial screenshot...');
  try {
    const screenshot = await captureScreenshot(stepIndex, initialEvent, true);
    if (screenshot) {
      console.log('[Record] Initial screenshot captured:', {
        stepIndex: screenshot.stepIndex,
        timestamp: screenshot.timestamp,
      });
      currentWorkflow.screenshots.push(screenshot);
      queueScreenshot(screenshot);
    } else {
      console.warn('[Record] Initial screenshot capture returned null');
    }
  } catch (error) {
    console.error('[Record] Failed to capture initial screenshot:', error);
    // Continue even if screenshot fails
  }

  currentWorkflow.events.push(initialEvent);
  stepIndex++;

  await logInfo('Record', 'Recording started successfully', {
    workflowId: currentWorkflow.id,
    stepIndex,
    eventCount: currentWorkflow.events.length,
    screenshotCount: currentWorkflow.screenshots.length,
  }, 'R5', recordingId);
  console.log('[Record] Recording started successfully:', {
    workflowId: currentWorkflow.id,
    stepIndex,
    eventCount: currentWorkflow.events.length,
    screenshotCount: currentWorkflow.screenshots.length,
  });
}

/**
 * Stop recording and send workflow to backend
 */
export async function stopRecording(): Promise<void> {
  if (!isRecording || !currentWorkflow) {
    await logWarn('Record', 'Not recording', undefined, 'R_STOP_1');
    console.warn('[Record] Not recording');
    return;
  }

  const recordingId = currentWorkflow.id;
  await logInfo('Record', 'stopRecording() called', undefined, 'R_STOP_1', recordingId);
  isRecording = false;
  currentWorkflow.endTime = Date.now();

  // Get all queued screenshots
  const queuedScreenshots = flushScreenshotQueue();

  // Send workflow to backend
  try {
    await logInfo('Record', 'Sending workflow to backend', { workflowId: recordingId }, 'R_STOP_2', recordingId);
    await sendWorkflowToBackend(currentWorkflow);
    await logInfo('Record', 'Workflow sent to backend successfully', { workflowId: recordingId }, 'R_STOP_3', recordingId);
    console.log('[Record] Workflow sent to backend');
  } catch (error) {
    await logError('Record', 'Failed to send workflow to backend', error, 'R_STOP_3_ERR', recordingId);
    console.error('[Record] Failed to send workflow:', error);
    // Store for retry (ensure no base64 data)
    const workflowToStore = sanitizeWorkflowForStorage(currentWorkflow);
    await chrome.storage.local.set({ failedWorkflow: workflowToStore });
  }

  // Clear current workflow
  currentWorkflow = null;
  stepIndex = 0;
  await chrome.storage.local.set({ currentWorkflow: null, isRecording: false });
  await logInfo('Record', 'Recording stopped', undefined, 'R_STOP_4', recordingId);

  console.log('[Record] Recording stopped');
}

/**
 * Record DOM event
 */
export async function recordEvent(event: DOMEvent): Promise<void> {
  if (!isRecording || !currentWorkflow) {
    return;
  }

  currentWorkflow.events.push(event);

  // Capture screenshot for key events
  const shouldCapture = ['click', 'navigation', 'dom_change'].includes(event.type);
  if (shouldCapture) {
    const screenshot = await captureScreenshot(stepIndex, event);
    if (screenshot) {
      currentWorkflow.screenshots.push(screenshot);
      queueScreenshot(screenshot);
      stepIndex++;
    }
  }

  // Update storage (ensure no base64 data is stored)
  const workflowToStore = sanitizeWorkflowForStorage(currentWorkflow);
  await chrome.storage.local.set({ currentWorkflow: workflowToStore });
}

/**
 * Send workflow to backend for step assembly
 */
async function sendWorkflowToBackend(workflow: WorkflowEvent): Promise<void> {
  // API_BASE_URL will be replaced at build time by Vite define
  // @ts-ignore - process.env.API_BASE_URL is replaced at build time
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

  const authHeader = await getAuthHeader();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authHeader) {
    headers['Authorization'] = authHeader;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/guides/workflows`, {
      method: 'POST',
      headers,
      body: JSON.stringify(workflow),
    });
  } catch (fetchError) {
    const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
    console.error('[Record] Fetch error when sending workflow:', {
      error: errorMessage,
      apiUrl: `${API_BASE_URL}/api/guides/workflows`,
      suggestion: 'Backend might not be running or CORS not configured. Check if backend is running on ' + API_BASE_URL,
    });
    throw new Error(`Failed to send workflow: ${errorMessage}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    if (response.status === 401) {
      // Try to re-authenticate automatically
      console.log('[Record] 401 Unauthorized - attempting to re-authenticate...');
      try {
        const loginSuccess = await login('test@example.com', 'password');
        if (loginSuccess) {
          console.log('[Record] Re-authentication successful, retrying workflow send...');
          // Retry with new token
          const newAuthHeader = await getAuthHeader();
          const retryHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (newAuthHeader) {
            retryHeaders['Authorization'] = newAuthHeader;
          }
          const retryResponse = await fetch(`${API_BASE_URL}/api/guides/workflows`, {
            method: 'POST',
            headers: retryHeaders,
            body: JSON.stringify(workflow),
          });
          if (!retryResponse.ok) {
            const retryErrorText = await retryResponse.text().catch(() => retryResponse.statusText);
            throw new Error(`Failed to send workflow after re-auth: ${retryResponse.status} ${retryErrorText}`);
          }
          const retryResult = await retryResponse.json();
          console.log('[Record] Workflow sent successfully after re-authentication:', retryResult);
          return;
        } else {
          throw new Error(`Failed to send workflow: Unauthorized - Re-authentication failed`);
        }
      } catch (authError) {
        console.error('[Record] Re-authentication failed:', authError);
        throw new Error(`Failed to send workflow: Unauthorized - Please authenticate`);
      }
    }
    throw new Error(`Failed to send workflow: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  console.log('[Record] Workflow processed:', result);
}

/**
 * Get recording status
 */
export function getRecordingStatus(): boolean {
  return isRecording;
}

/**
 * Get current workflow
 */
export function getCurrentWorkflow(): WorkflowEvent | null {
  return currentWorkflow;
}

/**
 * Sanitize workflow for storage by removing base64 data
 * Only keeps URLs/keys to prevent chrome.storage quota issues
 */
function sanitizeWorkflowForStorage(workflow: WorkflowEvent | null): WorkflowEvent | null {
  if (!workflow) return null;

  return {
    ...workflow,
    screenshots: workflow.screenshots.map((screenshot) => {
      const { screenshotBase64, ...sanitized } = screenshot;
      return sanitized;
    }),
  };
}

/**
 * Clean up old base64 data from chrome.storage.local
 * Call this on extension startup to free up space
 */
export async function cleanupOldScreenshotData(): Promise<void> {
  try {
    // Clean up old pendingScreenshots if they exist
    const { pendingScreenshots } = await chrome.storage.local.get('pendingScreenshots');
    if (pendingScreenshots && Array.isArray(pendingScreenshots)) {
      console.log('[Record] Cleaning up old pendingScreenshots data');
      await chrome.storage.local.remove('pendingScreenshots');
    }

    // Clean up base64 from currentWorkflow if it exists
    const { currentWorkflow } = await chrome.storage.local.get('currentWorkflow');
    if (currentWorkflow) {
      const sanitized = sanitizeWorkflowForStorage(currentWorkflow);
      await chrome.storage.local.set({ currentWorkflow: sanitized });
    }

    // Clean up base64 from failedWorkflow if it exists
    const { failedWorkflow } = await chrome.storage.local.get('failedWorkflow');
    if (failedWorkflow) {
      const sanitized = sanitizeWorkflowForStorage(failedWorkflow);
      await chrome.storage.local.set({ failedWorkflow: sanitized });
    }

    console.log('[Record] Cleanup completed');
  } catch (error) {
    console.error('[Record] Cleanup failed:', error);
  }
}



