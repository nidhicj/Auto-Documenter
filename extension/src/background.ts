import { recordEvent, startRecording, stopRecording, getRecordingStatus } from './record';
import { checkConnectionAndProcessQueue } from './offlineQueue';
import { DOMEvent } from './types';
import {
  logInfo,
  logError,
  logBrowserMetadata,
  getBrowserLogs,
  clearBrowserLogs,
} from './logger';

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  logInfo('Background', 'Received runtime message', { type: message.type, from: sender?.id });

  if (message.type === 'DOM_EVENT') {
    const event = message.event as DOMEvent;
    recordEvent(event).catch((error) => logError('Background', 'Failed to record event', error));
    sendResponse({ success: true });
  } else if (message.type === 'START_RECORDING') {
    startRecording()
      .then(() => sendResponse({ success: true }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logError('Background', 'Failed to start recording', error as Error);
        sendResponse({ success: false, error: message });
      });
    return true; // Async response
  } else if (message.type === 'STOP_RECORDING') {
    stopRecording()
      .then(() => sendResponse({ success: true }))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logError('Background', 'Failed to stop recording', error as Error);
        sendResponse({ success: false, error: message });
      });
    return true; // Async response
  } else if (message.type === 'GET_RECORDING_STATUS') {
    sendResponse({ isRecording: getRecordingStatus() });
  } else if (message.type === 'GET_BROWSER_LOGS') {
    void (async () => {
      try {
        const logs = await getBrowserLogs();
        sendResponse({ logs });
      } catch (error: unknown) {
        logError('Background', 'Failed to fetch browser logs', error as Error);
        sendResponse({ logs: [] });
      }
    })();
    return true;
  } else if (message.type === 'CLEAR_BROWSER_LOGS') {
    void (async () => {
      try {
        await clearBrowserLogs();
        sendResponse({ success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logError('Background', 'Failed to clear browser logs', error as Error);
        sendResponse({ success: false, error: message });
      }
    })();
    return true;
  }
});

// Process offline queue on startup
chrome.runtime.onStartup.addListener(() => {
  logInfo('Background', 'Runtime startup - processing offline queue');
  checkConnectionAndProcessQueue();
});

// Process offline queue when extension is installed/updated
chrome.runtime.onInstalled.addListener(() => {
  logInfo('Background', 'Extension installed or updated - processing offline queue');
  checkConnectionAndProcessQueue();
});

// Listen for tab navigation to capture navigation events
chrome.webNavigation.onCompleted.addListener((details) => {
  logInfo('Background', 'Navigation event', { frameId: details.frameId, url: details.url });
  if (details.frameId === 0 && getRecordingStatus()) {
    // Main frame navigation
    const event: DOMEvent = {
      type: 'navigation',
      target: {
        tagName: 'BODY',
        selector: 'body',
      },
      url: details.url,
      timestamp: Date.now(),
    };
    recordEvent(event).catch((error) => logError('Background', 'Failed to record navigation event', error));
  }
});

// Periodic check for offline queue (every 30 seconds)
setInterval(() => {
  logInfo('Background', 'Periodic offline queue check');
  checkConnectionAndProcessQueue();
}, 30000);

logBrowserMetadata('Background');
logInfo('Background', 'Service worker initialized');




