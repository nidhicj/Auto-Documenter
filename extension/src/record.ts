import { DOMEvent, WorkflowEvent } from './types';
import { captureScreenshot, queueScreenshot } from './screenshot';
import { v4 as uuidv4 } from 'uuid';
import { logInfo, logWarn, logError } from './logger';

let isRecording = false;
let currentWorkflow: WorkflowEvent | null = null;
let stepIndex = 0;

/**
 * Start recording workflow
 */
export async function startRecording(): Promise<void> {
  if (isRecording) {
    logWarn('Record', 'Already recording');
    return;
  }

  // Get the current active tab - try multiple methods
  let tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  
  // If no tab found, try getting the last focused window
  if (!tab || !tab.id) {
    const windows = await chrome.windows.getAll({ populate: true });
    for (const win of windows) {
      if (win.tabs) {
        const activeTab = win.tabs.find(t => t.active);
        if (activeTab && activeTab.id) {
          tab = activeTab;
          break;
        }
      }
    }
  }
  
  if (!tab || !tab.id || !tab.url) {
    throw new Error('No active tab found. Please navigate to a webpage first.');
  }
  
  // Check if tab URL is valid (not chrome:// or chrome-extension://)
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
    throw new Error('Cannot record on chrome:// or extension pages. Please navigate to a regular webpage.');
  }
  
  logInfo('Record', 'Starting recording on tab', { tabId: tab.id, url: tab.url });

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

  // Store workflow in storage (without screenshots to save space)
  const workflowWithoutScreenshots = {
    ...currentWorkflow,
    screenshots: [], // Don't store screenshots in workflow to save quota
  };
  
  try {
    await chrome.storage.local.set({ currentWorkflow: workflowWithoutScreenshots, isRecording });
  } catch (error: any) {
    // If quota exceeded, try to clean up old screenshots
    if (error.message && error.message.includes('quota')) {
      logWarn('Record', 'Quota exceeded on start, cleaning up');
      try {
        await chrome.storage.local.remove('pendingScreenshots');
        await chrome.storage.local.set({ currentWorkflow: workflowWithoutScreenshots, isRecording });
      } catch (cleanupError) {
        logError('Record', 'Failed to clean up storage', cleanupError);
        throw new Error('Storage quota exceeded. Please clear extension storage or restart Chrome.');
      }
    } else {
      throw error;
    }
  }

  // Inject content script and start recording
  try {
    // Try to send message to existing content script first
    try {
      await chrome.tabs.sendMessage(tab.id!, { type: 'START_RECORDING' });
      logInfo('Record', 'Sent message to existing content script', { tabId: tab.id });
    } catch (e) {
      // Content script not loaded, inject it
      logInfo('Record', 'Content script not found, injecting');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
        // Wait a bit for script to load
        await new Promise(resolve => setTimeout(resolve, 100));
        // Now send the message
        await chrome.tabs.sendMessage(tab.id!, { type: 'START_RECORDING' });
      } catch (injectError) {
        logError('Record', 'Failed to inject content script', injectError);
        // Fallback: dispatch custom event
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            window.dispatchEvent(new CustomEvent('autodoc-start-recording'));
          },
        });
      }
    }
  } catch (error) {
    logError('Record', 'Failed to start recording in content script', error);
  }

  // Capture initial screenshot
  // Delay slightly to ensure activeTab permission is fully active after user interaction
  await new Promise(resolve => setTimeout(resolve, 100));
  
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

  logInfo('Record', 'Recording started', { workflowId: currentWorkflow.id });
}

/**
 * Stop recording and send workflow to backend
 */
export async function stopRecording(): Promise<void> {
  if (!isRecording || !currentWorkflow) {
    logWarn('Record', 'Not recording');
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
    logInfo('Record', 'Workflow sent to backend', { workflowId: currentWorkflow.id });
  } catch (error: any) {
    logWarn('Record', 'Failed to send workflow (will retry later)', error.message);
    // Store for retry - don't throw, just log
    await chrome.storage.local.set({ 
      failedWorkflow: currentWorkflow,
      failedWorkflowTimestamp: Date.now()
    });
  }

  // Clear current workflow
  currentWorkflow = null;
  stepIndex = 0;
  
  try {
    await chrome.storage.local.set({ currentWorkflow: null, isRecording: false });
  } catch (error: any) {
    // If quota exceeded, try to clean up
    if (error.message && error.message.includes('quota')) {
      logWarn('Record', 'Quota exceeded, cleaning up storage');
      try {
        // Clear old screenshots
        await chrome.storage.local.remove('pendingScreenshots');
        await chrome.storage.local.set({ currentWorkflow: null, isRecording: false });
      } catch (cleanupError) {
        logError('Record', 'Failed to clean up storage', cleanupError);
      }
    } else {
      logError('Record', 'Failed to update storage', error);
    }
  }

  logInfo('Record', 'Recording stopped');
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

  // Update storage (without screenshots to save space)
  // Screenshots are stored separately in pendingScreenshots
  const workflowWithoutScreenshots = {
    ...currentWorkflow,
    screenshots: [], // Don't store screenshots in workflow to save quota
  };
  
  try {
    await chrome.storage.local.set({ currentWorkflow: workflowWithoutScreenshots });
  } catch (error: any) {
    // If quota exceeded, try to clean up old screenshots
    if (error.message && error.message.includes('quota')) {
      logWarn('Record', 'Quota exceeded, cleaning up old screenshots');
      try {
        const { pendingScreenshots = [] } = await chrome.storage.local.get('pendingScreenshots');
        // Keep only the 20 most recent screenshots
        const recentScreenshots = pendingScreenshots.slice(-20);
        await chrome.storage.local.set({ 
          pendingScreenshots: recentScreenshots,
          currentWorkflow: workflowWithoutScreenshots 
        });
      } catch (cleanupError) {
        logError('Record', 'Failed to clean up storage', cleanupError);
      }
    } else {
      logError('Record', 'Failed to update storage', error);
    }
  }
}

/**
 * Send workflow to backend for step assembly
 */
async function sendWorkflowToBackend(workflow: WorkflowEvent): Promise<void> {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

  try {
    // Include screenshots but limit their size to prevent payload issues
    // Keep only the most recent screenshots (last 20) to reduce payload size
    const screenshotsToSend = workflow.screenshots && workflow.screenshots.length > 0
      ? workflow.screenshots.slice(-20) // Keep last 20 screenshots
      : [];

    const workflowToSend = {
      ...workflow,
      screenshots: screenshotsToSend, // Include screenshots for step processing
    };

    const response = await fetch(`${API_BASE_URL}/api/guides/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflowToSend),
    });

    if (!response.ok) {
      throw new Error(`Failed to send workflow: ${response.statusText}`);
    }

    const result = await response.json();
    logInfo('Record', 'Workflow processed by backend', result);
  } catch (error: any) {
    // If backend is not available, store for later retry
    logWarn('Record', 'Backend not available, storing workflow for later', error.message);
    await chrome.storage.local.set({ 
      failedWorkflow: workflow,
      failedWorkflowError: error.message 
    });
    throw error;
  }
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




