import { DOMEvent } from './types';
import { logInfo, logError, logWarn } from './logger';

let isRecording = false;
let currentRecordingId: string | null = null;

console.log('[Content] Content script loaded at:', window.location.href);
console.log('[Content] Setting up event listeners...');

// Listen for messages from background/record
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    const recordingId = message.recordingId || null;
    currentRecordingId = recordingId;
    logInfo('Content', 'Received START_RECORDING message', { sender: sender?.tab?.id ? `tab-${sender.tab.id}` : 'background', recordingId }, 'R5', recordingId).catch(console.error);
    console.log('[Content] START_RECORDING message received, recordingId:', recordingId);
    
    if (isRecording) {
      logWarn('Content', 'Already recording, ignoring duplicate start', undefined, 'R5_WARN', recordingId).catch(console.error);
      console.warn('[Content] Already recording, ignoring duplicate start event');
      return;
    }
    
    isRecording = true;
    console.log('[Content] Starting event capture...');
    startEventCapture();
    console.log('[Content] Event capture started');
  } else if (message.type === 'STOP_RECORDING') {
    logInfo('Content', 'Received STOP_RECORDING message', { sender: sender?.tab?.id ? `tab-${sender.tab.id}` : 'background' }, 'R_STOP', currentRecordingId).catch(console.error);
    console.log('[Content] STOP_RECORDING message received');
    if (!isRecording) {
      logWarn('Content', 'Not recording, ignoring stop event', undefined, 'R_STOP_WARN', currentRecordingId).catch(console.error);
      console.warn('[Content] Not recording, ignoring stop event');
      return;
    }
    isRecording = false;
    currentRecordingId = null;
    stopEventCapture();
  }
});

// Listen for recording start/stop events (fallback for injected scripts)
window.addEventListener('scribe-start-recording', (event: any) => {
  const recordingId = event.detail?.recordingId || null;
  currentRecordingId = recordingId;
  logInfo('Content', 'Received scribe-start-recording event', { recordingId }, 'R5', recordingId).catch(console.error);
  console.log('[Content] scribe-start-recording event received!');
  console.log('[Content] Current URL:', window.location.href);
  console.log('[Content] Document ready state:', document.readyState);
  
  if (isRecording) {
    logWarn('Content', 'Already recording, ignoring duplicate start event', undefined, 'R5_WARN', recordingId).catch(console.error);
    console.warn('[Content] Already recording, ignoring duplicate start event');
    return;
  }
  
  isRecording = true;
  console.log('[Content] Starting event capture...');
  startEventCapture();
  console.log('[Content] Event capture started');
});

window.addEventListener('scribe-stop-recording', () => {
  logInfo('Content', 'Received scribe-stop-recording event', undefined, 'R_STOP', currentRecordingId).catch(console.error);
  console.log('[Content] scribe-stop-recording event received');
  if (!isRecording) {
    logWarn('Content', 'Not recording, ignoring stop event', undefined, 'R_STOP_WARN', currentRecordingId).catch(console.error);
    console.warn('[Content] Not recording, ignoring stop event');
    return;
  }
  isRecording = false;
  currentRecordingId = null;
  console.log('[Content] Stopping event capture...');
  stopEventCapture();
  console.log('[Content] Event capture stopped');
});

/**
 * Start capturing DOM events
 */
function startEventCapture(): void {
  console.log('[Content] startEventCapture() called');
  
  if (!document.body) {
    console.error('[Content] document.body is null, cannot start event capture');
    return;
  }
  
  console.log('[Content] Adding click event listener...');
  // Click events
  document.addEventListener('click', handleClick, true);

  console.log('[Content] Adding input event listener...');
  // Input events
  document.addEventListener('input', handleInput, true);

  console.log('[Content] Setting up MutationObserver...');
  // DOM mutations
  const observer = new MutationObserver(handleDOMChange);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
  });
  console.log('[Content] MutationObserver started');

  // Navigation (SPA)
  console.log('[Content] Setting up navigation monitoring...');
  let lastUrl = location.href;
  const navInterval = setInterval(() => {
    if (location.href !== lastUrl) {
      handleNavigation(lastUrl, location.href);
      lastUrl = location.href;
    }
  }, 1000);
  console.log('[Content] Navigation monitoring started');

  // Store observer and interval for cleanup
  (window as any).__scribeObserver = observer;
  (window as any).__scribeNavInterval = navInterval;
  
  console.log('[Content] Event capture fully initialized');
}

/**
 * Stop capturing DOM events
 */
function stopEventCapture(): void {
  console.log('[Content] stopEventCapture() called');
  
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('input', handleInput, true);
  
  const observer = (window as any).__scribeObserver;
  if (observer) {
    observer.disconnect();
    delete (window as any).__scribeObserver;
    console.log('[Content] MutationObserver disconnected');
  }
  
  const navInterval = (window as any).__scribeNavInterval;
  if (navInterval) {
    clearInterval(navInterval);
    delete (window as any).__scribeNavInterval;
    console.log('[Content] Navigation monitoring stopped');
  }
  
  console.log('[Content] Event capture stopped');
}

/**
 * Handle click events
 */
function handleClick(event: MouseEvent): void {
  if (!isRecording) {
    console.log('[Content] Click event ignored (not recording)');
    return;
  }

  const target = event.target as HTMLElement;
  const domEvent: DOMEvent = {
    type: 'click',
    target: {
      tagName: target.tagName,
      id: target.id || undefined,
      className: target.className?.toString() || undefined,
      textContent: target.textContent?.slice(0, 100) || undefined,
      selector: getSelector(target),
    },
    url: window.location.href,
    timestamp: Date.now(),
    metadata: {
      x: event.clientX,
      y: event.clientY,
    },
  };

  console.log('[Content] Click event captured:', {
    selector: domEvent.target.selector,
    tagName: domEvent.target.tagName,
  });
  sendEventToBackground(domEvent);
}

/**
 * Handle input events
 */
function handleInput(event: Event): void {
  if (!isRecording) return;

  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  const domEvent: DOMEvent = {
    type: 'input',
    target: {
      tagName: target.tagName,
      id: target.id || undefined,
      className: target.className?.toString() || undefined,
      selector: getSelector(target),
    },
    url: window.location.href,
    timestamp: Date.now(),
    metadata: {
      valueLength: target.value.length,
      inputType: target.type,
    },
  };

  sendEventToBackground(domEvent);
}

/**
 * Handle DOM changes
 */
function handleDOMChange(mutations: MutationRecord[]): void {
  if (!isRecording) return;

  // Throttle DOM change events
  const now = Date.now();
  if ((window as any).__lastDOMChangeTime && now - (window as any).__lastDOMChangeTime < 1000) {
    return;
  }
  (window as any).__lastDOMChangeTime = now;

  const domEvent: DOMEvent = {
    type: 'dom_change',
    target: {
      tagName: 'BODY',
      selector: 'body',
    },
    url: window.location.href,
    timestamp: Date.now(),
    metadata: {
      mutationCount: mutations.length,
    },
  };

  sendEventToBackground(domEvent);
}

/**
 * Handle navigation (SPA)
 */
function handleNavigation(from: string, to: string): void {
  if (!isRecording) return;

  const domEvent: DOMEvent = {
    type: 'navigation',
    target: {
      tagName: 'BODY',
      selector: 'body',
    },
    url: to,
    timestamp: Date.now(),
    metadata: {
      from,
      to,
    },
  };

  sendEventToBackground(domEvent);
}

/**
 * Get CSS selector for element
 */
function getSelector(element: HTMLElement): string {
  if (element.id) {
    return `#${element.id}`;
  }
  if (element.className) {
    const classes = element.className.toString().split(' ').filter(Boolean);
    if (classes.length > 0) {
      return `${element.tagName.toLowerCase()}.${classes[0]}`;
    }
  }
  return element.tagName.toLowerCase();
}

/**
 * Send event to background script
 */
function sendEventToBackground(event: DOMEvent): void {
  console.log('[Content] Sending event to background:', event.type);
  chrome.runtime.sendMessage({
    type: 'DOM_EVENT',
    event,
  })
    .then(() => {
      console.log('[Content] Event sent successfully:', event.type);
    })
    .catch((error) => {
      console.error('[Content] Failed to send event:', error);
      console.error('[Content] Error details:', {
        message: error.message,
        eventType: event.type,
      });
    });
}



