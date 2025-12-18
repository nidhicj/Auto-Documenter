import {
  logInfo,
  logError,
  logWarn,
  getBrowserLogs,
  clearBrowserLogs,
  formatLogEntry,
  LogEntry,
} from '../logger';

const btnStart = document.getElementById('btnStart') as HTMLButtonElement | null;
const btnStop = document.getElementById('btnStop') as HTMLButtonElement | null;
const statusElement = document.getElementById('status') as HTMLDivElement | null;

const btnLogToggle = document.getElementById('btnLogToggle') as HTMLButtonElement | null;
const btnClearLogs = document.getElementById('btnClearLogs') as HTMLButtonElement | null;
const logViewer = document.getElementById('logViewer') as HTMLDivElement | null;
const logContent = document.getElementById('logContent') as HTMLDivElement | null;

function mustHave<T>(value: T | null, name: string): T {
  if (!value) throw new Error(`Missing required DOM element: ${name}`);
  return value;
}

function fireInfo(message: string, data?: any, code?: string) {
  void logInfo('Popup', message, data, code).catch(() => {});
}
function fireWarn(message: string, data?: any, code?: string) {
  void logWarn('Popup', message, data, code).catch(() => {});
}

async function updateStatus(): Promise<void> {
  const statusEl = mustHave(statusElement, 'status');
  const startBtn = mustHave(btnStart, 'btnStart');
  const stopBtn = mustHave(btnStop, 'btnStop');

  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' });
    const isRecording = response?.isRecording ?? false;

    if (isRecording) {
      statusEl.textContent = '🔴 Recording...';
      statusEl.className = 'status recording';
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      statusEl.textContent = '⚪ Not recording';
      statusEl.className = 'status idle';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  } catch (error) {
    // This matters. Keep it.
    console.error('[Popup] Failed to update status:', error);
    statusEl.textContent = '⚠️ Status unavailable';
    statusEl.className = 'status error';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

async function refreshLogs(): Promise<void> {
  const viewer = mustHave(logViewer, 'logViewer');
  const content = mustHave(logContent, 'logContent');

  // Don’t waste cycles if the viewer is hidden
  if (viewer.style.display === 'none') return;

  try {
    const logs = (await getBrowserLogs()) as LogEntry[];
    content.innerHTML = '';

    if (!logs || logs.length === 0) {
      content.innerHTML = `<div class="log-line">No logs yet.</div>`;
      return;
    }

    logs.forEach((entry, index) => {
      const line = document.createElement('div');
      line.className = `log-line ${entry.level || ''}`.trim();
      line.textContent = formatLogEntry(entry, index);
      content.appendChild(line);
    });

    content.scrollTop = content.scrollHeight;
  } catch (error) {
    console.error('[Popup] Failed to refresh logs:', error);
    content.innerHTML = `<div class="log-line error">Error loading logs: ${
      error instanceof Error ? error.message : String(error)
    }</div>`;
  }
}

// ---- Main wiring ----

(async () => {
  try {
    // Validate required UI pieces early
    mustHave(btnStart, 'btnStart');
    mustHave(btnStop, 'btnStop');
    mustHave(statusElement, 'status');

    // Initial status
    await updateStatus();

    // Start recording
    btnStart!.addEventListener('click', async () => {
      fireInfo('User clicked Start Recording', undefined, 'R1');

      try {
        const response = await chrome.runtime.sendMessage({ type: 'START_RECORDING' });

        if (response?.success) {
          fireInfo('Recording started', undefined, 'R2_OK');
          await updateStatus();
        } else {
          const errorMsg = response?.error || 'Unknown error';
          await logError('Popup', 'Failed to start recording', errorMsg, 'R2_ERR');
          await updateStatus();
        }
      } catch (error) {
        await logError('Popup', 'START_RECORDING message failed', error, 'R2_ERR_SEND');
        await updateStatus();
      }
    });

    // Stop recording
    btnStop!.addEventListener('click', async () => {
      fireInfo('User clicked Stop Recording', undefined, 'R4');

      try {
        const response = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });

        if (response?.success) {
          fireInfo('Recording stopped', undefined, 'R5_OK');
          await updateStatus();
        } else {
          const errorMsg = response?.error || 'Unknown error';
          await logError('Popup', 'Failed to stop recording', errorMsg, 'R5_ERR');
          await updateStatus();
        }
      } catch (error) {
        await logError('Popup', 'STOP_RECORDING message failed', error, 'R5_ERR_SEND');
        await updateStatus();
      }
    });

    // Log viewer toggle
    if (btnLogToggle && logViewer) {
      btnLogToggle.addEventListener('click', async () => {
        const isHidden = logViewer.style.display === 'none' || !logViewer.style.display;
        logViewer.style.display = isHidden ? 'block' : 'none';

        // Only log the action once; no console spam.
        fireInfo(isHidden ? 'Log viewer opened' : 'Log viewer closed', undefined, 'LOG_UI');

        if (isHidden) await refreshLogs();
      });
    }

    // Clear logs
    if (btnClearLogs) {
      btnClearLogs.addEventListener('click', async () => {
        fireWarn('User cleared logs', undefined, 'LOG_CLEAR');
        try {
          await clearBrowserLogs();
          await refreshLogs();
        } catch (error) {
          await logError('Popup', 'Failed to clear logs', error, 'LOG_CLEAR_ERR');
        }
      });
    }

    // Optional: refresh logs periodically only if viewer is open
    setInterval(() => {
      void refreshLogs();
    }, 2000);
  } catch (error) {
    // Hard failure: missing DOM or bootstrap issues.
    console.error('[Popup] Initialization failed:', error);
    await logError('Popup', 'Initialization failed', error, 'POPUP_INIT_ERR');
  }
})();
