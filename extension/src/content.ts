import { DOMEvent } from './types';
import { logInfo, logError } from './logger';

let isRecording = false;

// Listen for recording start/stop via custom events
window.addEventListener('autodoc-start-recording', () => {
  logInfo('Content', 'Received start recording event');
  isRecording = true;
  startEventCapture();
});

window.addEventListener('autodoc-stop-recording', () => {
  logInfo('Content', 'Received stop recording event');
  isRecording = false;
  stopEventCapture();
});

// Also listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    logInfo('Content', 'Received start recording message');
    isRecording = true;
    startEventCapture();
    sendResponse({ success: true });
  } else if (message.type === 'STOP_RECORDING') {
    logInfo('Content', 'Received stop recording message');
    isRecording = false;
    stopEventCapture();
    sendResponse({ success: true });
  }
  return true; // Keep channel open for async response
});

/**
 * Start capturing DOM events
 */
function startEventCapture(): void {
  // Click events
  document.addEventListener('click', handleClick, true);

  // Input events
  document.addEventListener('input', handleInput, true);

  // DOM mutations
  const observer = new MutationObserver(handleDOMChange);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
  });

  // Navigation (SPA)
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      handleNavigation(lastUrl, location.href);
      lastUrl = location.href;
    }
  }, 1000);

  // Store observer for cleanup
  (window as any).__autodocObserver = observer;
}

/**
 * Stop capturing DOM events
 */
function stopEventCapture(): void {
  document.removeEventListener('click', handleClick, true);
  document.removeEventListener('input', handleInput, true);
  
  const observer = (window as any).__autodocObserver;
  if (observer) {
    observer.disconnect();
    delete (window as any).__autodocObserver;
  }
}

/**
 * Handle click events
 */
function handleClick(event: MouseEvent): void {
  if (!isRecording) return;

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
  chrome.runtime.sendMessage({
    type: 'DOM_EVENT',
    event,
  }).catch((error) => {
    logError('Content', 'Failed to send event to background', error);
  });
}




