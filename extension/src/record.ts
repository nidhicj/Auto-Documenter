import { DOMEvent, WorkflowEvent } from './types';
import { captureScreenshot, queueScreenshot } from './screenshot';
import { v4 as uuidv4 } from 'uuid';

let isRecording = false;
let currentWorkflow: WorkflowEvent | null = null;
let stepIndex = 0;

/**
 * Start recording workflow
 */
export async function startRecording(): Promise<void> {
  if (isRecording) {
    console.warn('[Record] Already recording');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id || !tab.url) {
    throw new Error('No active tab found');
  }

  isRecording = true;
  stepIndex = 0;
  currentWorkflow = {
    id: uuidv4(),
    events: [],
    screenshots: [],
    startTime: Date.now(),
    url: tab.url,
    title: tab.title || 'Untitled',
  };

  // Store workflow in storage
  await chrome.storage.local.set({ currentWorkflow, isRecording });

  // Inject content script if needed
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Content script will handle DOM events
        window.dispatchEvent(new CustomEvent('scribe-start-recording'));
      },
    });
  } catch (error) {
    console.error('[Record] Failed to inject script:', error);
  }

  // Capture initial screenshot
  const initialEvent: DOMEvent = {
    type: 'navigation',
    target: {
      tagName: 'BODY',
      selector: 'body',
    },
    url: tab.url,
    timestamp: Date.now(),
  };

  const screenshot = await captureScreenshot(stepIndex, initialEvent, true);
  if (screenshot) {
    currentWorkflow.screenshots.push(screenshot);
    queueScreenshot(screenshot);
  }

  currentWorkflow.events.push(initialEvent);
  stepIndex++;

  console.log('[Record] Recording started:', currentWorkflow.id);
}

/**
 * Stop recording and send workflow to backend
 */
export async function stopRecording(): Promise<void> {
  if (!isRecording || !currentWorkflow) {
    console.warn('[Record] Not recording');
    return;
  }

  isRecording = false;
  currentWorkflow.endTime = Date.now();

  // Get all queued screenshots
  const { flushScreenshotQueue } = await import('./screenshot');
  const queuedScreenshots = flushScreenshotQueue();

  // Send workflow to backend
  try {
    await sendWorkflowToBackend(currentWorkflow);
    console.log('[Record] Workflow sent to backend');
  } catch (error) {
    console.error('[Record] Failed to send workflow:', error);
    // Store for retry
    await chrome.storage.local.set({ failedWorkflow: currentWorkflow });
  }

  // Clear current workflow
  currentWorkflow = null;
  stepIndex = 0;
  await chrome.storage.local.set({ currentWorkflow: null, isRecording: false });

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

  // Update storage
  await chrome.storage.local.set({ currentWorkflow });
}

/**
 * Send workflow to backend for step assembly
 */
async function sendWorkflowToBackend(workflow: WorkflowEvent): Promise<void> {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

  const response = await fetch(`${API_BASE_URL}/api/guides/workflows`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(workflow),
  });

  if (!response.ok) {
    throw new Error(`Failed to send workflow: ${response.statusText}`);
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



