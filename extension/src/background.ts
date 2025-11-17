import { recordEvent, startRecording, stopRecording, getRecordingStatus } from './record';
import { processOfflineQueue, checkConnectionAndProcessQueue } from './offlineQueue';
import { DOMEvent } from './types';

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'DOM_EVENT') {
    const event = message.event as DOMEvent;
    recordEvent(event).catch(console.error);
    sendResponse({ success: true });
  } else if (message.type === 'START_RECORDING') {
    startRecording()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  } else if (message.type === 'STOP_RECORDING') {
    stopRecording()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Async response
  } else if (message.type === 'GET_RECORDING_STATUS') {
    sendResponse({ isRecording: getRecordingStatus() });
  }
});

// Process offline queue on startup
chrome.runtime.onStartup.addListener(() => {
  checkConnectionAndProcessQueue();
});

// Process offline queue when extension is installed/updated
chrome.runtime.onInstalled.addListener(() => {
  checkConnectionAndProcessQueue();
});

// Listen for tab navigation to capture navigation events
chrome.webNavigation.onCompleted.addListener((details) => {
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
    recordEvent(event).catch(console.error);
  }
});

// Periodic check for offline queue (every 30 seconds)
setInterval(() => {
  checkConnectionAndProcessQueue();
}, 30000);

console.log('[Background] Service worker initialized');



