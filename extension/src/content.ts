import { DOMEvent } from './types';
import { logInfo, logError, logWarn } from './logger';

let isRecording = false;
let currentRecordingId: string | null = null;

type CaptureRequestMessage = {
  type: 'CAPTURE_REQUEST';
  reason: string;
  meta: {
    url: string;
    viewport: { w: number; h: number };
    activeElementTag?: string;
    timestamp: number;
  };
};

const IDLE_MS = 3000;
const INPUT_DEBOUNCE_MS = 900;
const SCROLL_DEBOUNCE_MS = 200;
const DOM_QUIET_MS = 600;
const CAPTURE_REQUEST_COOLDOWN_MS = 2500;
const DEBUG_CAPTURE = true;

let lastActivityAt = 0;
let lastMutationAt = 0;
let lastCaptureRequestAt = 0;

let idleTimer: number | null = null;
let pendingTimer: number | null = null;
let inputTimer: number | null = null;
let scrollTimer: number | null = null;

let pendingReason: string | null = null;
let domObserver: MutationObserver | null = null;
let historyHooked = false;
let captureListenersAttached = false;



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
window.addEventListener('autodoc-start-recording', (event: any) => {
  const recordingId = event.detail?.recordingId || null;
  currentRecordingId = recordingId;
  logInfo('Content', 'Received autodoc-start-recording event', { recordingId }, 'R5', recordingId).catch(console.error);
  console.log('[Content] autodoc-start-recording event received!');
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

window.addEventListener('autodoc-stop-recording', () => {
  logInfo('Content', 'Received autodoc-stop-recording event', undefined, 'R_STOP', currentRecordingId).catch(console.error);
  console.log('[Content] autodoc-stop-recording event received');
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

function hookHistoryForNavigation(): void {
  console.log('[Content] hookHistoryForNavigation() called');

  if (historyHooked) {
    console.log('[Content] History hooks already installed, skipping');
    return;
  }
  historyHooked = true;

  const _pushState = history.pushState;
  const _replaceState = history.replaceState;

  const onNav = () => {
    console.log('[Content] Navigation detected:', location.href);

    if (!isRecording) {
      console.log('[Content] isRecording=false, ignoring navigation');
      return;
    }

    noteActivity();
    scheduleSettledCapture('navigation');
  };

  history.pushState = function (...args: any[]) {
    const ret = _pushState.apply(history, args as any);
    onNav();
    return ret;
  } as any;

  history.replaceState = function (...args: any[]) {
    const ret = _replaceState.apply(history, args as any);
    onNav();
    return ret;
  } as any;

  window.addEventListener('popstate', () => {
    console.log('[Content] popstate detected');
    onNav();
  });

  window.addEventListener('load', () => {
    console.log('[Content] window load detected');

    if (!isRecording) {
      console.log('[Content] isRecording=false, ignoring load');
      return;
    }

    noteActivity();
    scheduleSettledCapture('page_load');
  });

  console.log('[Content] History navigation hooks installed');
}


/**
 * Start capturing DOM events
 */
function startEventCapture(): void {
  console.log('[Content] startEventCapture() called');
  
  if (!document.body) {
    console.error('[Content] document.body is null, cannot start event capture');
    return;
  }

  if (!isRecording) {
    console.warn('[Content] startEventCapture() called but isRecording=false');
    return;
  }

  if (captureListenersAttached) {
    console.log('[Content] Listeners already attached, skipping');
    return;
  }

  captureListenersAttached = true;


  // Click events
  console.log('[Content] Attaching click listener (capture phase)');
  document.addEventListener('click', handleClick, true);

  // Input events
  console.log('[Content] Attaching input & paste listeners');
  document.addEventListener('input', handleInput, true);
  document.addEventListener('paste', handleInput, true);

  // Keydown events
  console.log('[Content] Attaching keydown listener');
  document.addEventListener('keydown', handleKeydown, true);
  
  // Scroll events
  console.log('[Content] Attaching scroll listener');
  window.addEventListener('scroll', handleScroll, true);

  // Copy / Cut events
  console.log('[Content] Attaching copy / cut listeners');
  document.addEventListener('copy', handleCopyCut, true);
  document.addEventListener('cut', handleCopyCut, true);

  // DOM mutations
  if (!domObserver) {
    console.log('[Content] Creating MutationObserver for DOM settle tracking');
    domObserver = new MutationObserver((mutations) => {
      if (DEBUG_CAPTURE) console.log('[Content] MutationObserver fired:', mutations.length);
      handleDOMChange(mutations);
    });
    

    domObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: false,
    });

    console.log('[Content] MutationObserver attached');
  } else {
    console.log('[Content] MutationObserver already active, skipping reattach');
  }

  // Navigation hooks (separate function, not embedded)
  hookHistoryForNavigation();

  // Prime idle detection
  console.log('[Content] Priming idle detection');
  noteActivity();

  // Optional: expose tiny debug snapshot (no large objects)
  (window as any).__autodocDebug = {
    domObserverActive: !!domObserver,
    historyHooked,
    isRecording,
  };

  console.log('[Content] Event capture fully initialized');
}

/**
 * Stop capturing DOM events
 */
function stopEventCapture(): void {
  console.log('[Content] stopEventCapture() called');

  // Remove user intent listeners
  console.log('[Content] Removing event listeners...');
  document.removeEventListener('click', handleClick, true);

  document.removeEventListener('input', handleInput, true);
  document.removeEventListener('paste', handleInput, true);

  document.removeEventListener('keydown', handleKeydown, true);

  window.removeEventListener('scroll', handleScroll, true);

  document.removeEventListener('copy', handleCopyCut, true);
  document.removeEventListener('cut', handleCopyCut, true);

  captureListenersAttached = false;
  console.log('[Content] Event listeners removed');

  // Disconnect MutationObserver (module-scoped)
  if (domObserver) {
    console.log('[Content] Disconnecting MutationObserver...');
    domObserver.disconnect();
    domObserver = null;
    console.log('[Content] MutationObserver disconnected');
  } else {
    console.log('[Content] No MutationObserver active');
  }

  // Clear any timers your pipeline uses (only if these exist in your file)
  // If you used different variable names, adjust accordingly.
  try {
    if (idleTimer) {
      window.clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (pendingTimer) {
      window.clearTimeout(pendingTimer);
      pendingTimer = null;
    }
    if (inputTimer) {
      window.clearTimeout(inputTimer);
      inputTimer = null;
    }
    if (scrollTimer) {
      window.clearTimeout(scrollTimer);
      scrollTimer = null;
    }
    console.log('[Content] Timers cleared');
  } catch (e) {
    console.warn('[Content] Timer cleanup skipped (timers not defined in this file)', e);
  }

  // Navigation hooks:
  // We do NOT unpatch history.pushState/replaceState here.
  // They are installed once; onNav checks isRecording so it becomes a no-op when stopped.
  console.log('[Content] Navigation hooks remain installed (safe no-op when isRecording=false)');

  // Optional: cleanup debug handle
  if ((window as any).__autodocDebug) {
    delete (window as any).__autodocDebug;
    console.log('[Content] __autodocDebug cleared');
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
  // sendEventToBackground(domEvent);

  noteActivity();
  // optional: still record the click event (low-frequency) if you want it in workflow
  sendEventToBackground(domEvent);

  // only request screenshot after settle (final UI)
  scheduleSettledCapture('click');

}

/**
 * Handle input events
 */
function handleInput(event: Event): void {
  if (!isRecording) return;

  const target = event.target as HTMLInputElement | HTMLTextAreaElement;
  if (!target) return;

  noteActivity();

  if (inputTimer) window.clearTimeout(inputTimer);

  inputTimer = window.setTimeout(() => {
    // send a single capture after typing stops + DOM settles
    scheduleSettledCapture('typing_finished');

    // optional: record one input DOM_EVENT at the end (not per keystroke)
    const domEvent: DOMEvent = {
      type: 'input',
      target: {
        tagName: target.tagName,
        id: target.id || undefined,
        className: target.className?.toString() || undefined,
        selector: getSelector(target),
      },
      url: window.location.href,
      timestamp: now(),
      metadata: {
        valueLength: target.value?.length ?? 0,
        inputType: (target as any).type,
      },
    };
    sendEventToBackground(domEvent);
  }, INPUT_DEBOUNCE_MS);
}

function handleKeydown(event: KeyboardEvent): void {
  if (!isRecording) return;

  // Enter / Ctrl+Enter = execute
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey || !event.shiftKey)) {
    noteActivity();
    scheduleSettledCapture('command_executed');
  }
}

function handleScroll(): void {
  if (!isRecording) return;

  noteActivity();

  if (scrollTimer) window.clearTimeout(scrollTimer);

  scrollTimer = window.setTimeout(() => {
    // user stopped scrolling → wait for idle threshold separately
    // Here we request capture after settle, but still respects idle_pause too
    scheduleSettledCapture('scroll_settled');
  }, SCROLL_DEBOUNCE_MS);
}

function handleCopyCut(): void {
  if (!isRecording) return;
  noteActivity();
  scheduleSettledCapture('copy_cut');
}


/**
 * Handle DOM changes
 */
function handleDOMChange(mutations: MutationRecord[]): void {
  if (!isRecording) return;

  lastMutationAt = now();

  // Lightweight modal / alert detection (no deep traversal)
  for (const m of mutations) {
    if (m.type !== 'childList') continue;

    for (const n of Array.from(m.addedNodes)) {
      if (!(n instanceof HTMLElement)) continue;

      // modal/dialog
      if (n.getAttribute('role') === 'dialog' || n.getAttribute('aria-modal') === 'true') {
        noteActivity();
        scheduleSettledCapture('modal_opened');
        return;
      }

      // alert/toast
      if (n.getAttribute('role') === 'alert' || n.getAttribute('aria-live')) {
        noteActivity();
        scheduleSettledCapture('alert_shown');
        return;
      }
    }
  }
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

function now() {
  return Date.now();
}

function getMeta() {
  const ae = document.activeElement as HTMLElement | null;
  return {
    url: window.location.href,
    viewport: { w: window.innerWidth, h: window.innerHeight },
    activeElementTag: ae?.tagName,
    timestamp: now(),
  };
}

function sendCaptureRequest(reason: string) {
  if (!isRecording) return;

  const t = now();
  if (t - lastCaptureRequestAt < CAPTURE_REQUEST_COOLDOWN_MS) return;

  lastCaptureRequestAt = t;

  const msg: CaptureRequestMessage = {
    type: 'CAPTURE_REQUEST',
    reason,
    meta: getMeta(),
  };

  chrome.runtime.sendMessage(msg);
}

function scheduleIdleShot() {
  if (idleTimer) window.clearTimeout(idleTimer);

  idleTimer = window.setTimeout(() => {
    // Only one per idle window; background has dedupe too
    sendCaptureRequest('idle_pause');
  }, IDLE_MS);
}

function noteActivity() {
  lastActivityAt = now();
  scheduleIdleShot();
}

function scheduleSettledCapture(reason: string) {
  pendingReason = reason;

  if (pendingTimer) window.clearTimeout(pendingTimer);

  // wait for DOM quiet window
  pendingTimer = window.setTimeout(() => {
    const t = now();
    const quietFor = t - lastMutationAt;
    if (quietFor >= DOM_QUIET_MS) {
      // DOM has been quiet → capture final state
      if (pendingReason) sendCaptureRequest(pendingReason);
      pendingReason = null;
      return;
    }

    // not settled yet → recheck once more shortly (no loops forever)
    pendingTimer = window.setTimeout(() => {
      const t2 = now();
      if (t2 - lastMutationAt >= DOM_QUIET_MS && pendingReason) {
        sendCaptureRequest(pendingReason);
      }
      pendingReason = null;
    }, DOM_QUIET_MS);
  }, DOM_QUIET_MS);
}


