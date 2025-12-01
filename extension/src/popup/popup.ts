import { logError, logInfo } from '../logger';

const btnStart = document.getElementById('btnStart') as HTMLButtonElement;
const btnStop = document.getElementById('btnStop') as HTMLButtonElement;
const statusElement = document.getElementById('status') as HTMLDivElement;
const errorElement = document.getElementById('error') as HTMLDivElement;
const btnRefreshLogs = document.getElementById('btnRefreshLogs') as HTMLButtonElement | null;
const btnClearLogs = document.getElementById('btnClearLogs') as HTMLButtonElement | null;
const logOutput = document.getElementById('logOutput') as HTMLPreElement | null;

function showError(message: string) {
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }
}

// Check recording status on load
updateStatus();
refreshLogs();

// Start recording
btnStart.addEventListener('click', async () => {
  try {
    btnStart.disabled = true;
    btnStart.textContent = 'Starting...';
    
    const response = await chrome.runtime.sendMessage({ type: 'START_RECORDING' });
    
    if (response && response.success) {
      logInfo('Popup', 'Recording started successfully');
      updateStatus();
    } else {
      const errorMsg = response?.error || 'Unknown error';
      logError('Popup', 'Failed to start recording', errorMsg);
      showError(`Failed to start recording: ${errorMsg}`);
      btnStart.disabled = false;
      btnStart.textContent = 'Start Recording';
    }
  } catch (error: any) {
    logError('Popup', 'Failed to start recording', error);
    const errorMsg = error?.message || String(error);
    showError(`Failed to start recording: ${errorMsg}`);
    btnStart.disabled = false;
    btnStart.textContent = 'Start Recording';
  }
});

// Stop recording
btnStop.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
    if (response?.success) {
      updateStatus();
    } else {
      const errorMsg = response?.error || 'Unknown error';
      logError('Popup', 'Failed to stop recording', errorMsg);
      alert(`Failed to stop recording: ${errorMsg}`);
    }
  } catch (error) {
    logError('Popup', 'Failed to stop recording', error);
    alert('Failed to stop recording');
  }
});

// Update UI status
async function updateStatus(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' });
    const isRecording = response.isRecording;

    if (isRecording) {
      statusElement.textContent = '🔴 Recording...';
      statusElement.className = 'status recording';
      btnStart.disabled = true;
      btnStop.disabled = false;
    } else {
      statusElement.textContent = 'Ready to record';
      statusElement.className = 'status idle';
      btnStart.disabled = false;
      btnStop.disabled = true;
    }
  } catch (error) {
    logError('Popup', 'Failed to get status', error);
  }
}

// Poll status every second when recording
setInterval(() => {
  updateStatus();
}, 1000);

async function refreshLogs(): Promise<void> {
  if (!btnRefreshLogs) {
    return;
  }

  btnRefreshLogs.disabled = true;
  btnRefreshLogs.textContent = 'Loading logs...';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_BROWSER_LOGS' });
    const logs = response?.logs ?? [];
    logInfo('Popup', 'Fetched browser logs', { count: logs.length });

    if (logOutput) {
      if (logs.length === 0) {
        logOutput.textContent = 'No browser logs captured yet.';
        logOutput.style.display = 'block';
      } else {
        logOutput.textContent = logs
          .map((entry: any) => {
            const time = new Date(entry.timestamp).toLocaleTimeString();
            const meta = entry.meta ? ` ${JSON.stringify(entry.meta)}` : '';
            return `${time} [${entry.level.toUpperCase()}] [${entry.source}] ${entry.message}${meta}`;
          })
          .join('\n');
        logOutput.style.display = 'block';
      }
    }
  } catch (error) {
    logError('Popup', 'Failed to fetch browser logs', error);
    if (logOutput) {
      logOutput.textContent = 'Unable to load logs right now.';
      logOutput.style.display = 'block';
    }
  } finally {
    btnRefreshLogs.textContent = 'Refresh Logs';
    btnRefreshLogs.disabled = false;
  }
}

btnRefreshLogs?.addEventListener('click', () => {
  refreshLogs();
});

btnClearLogs?.addEventListener('click', async () => {
  if (!btnClearLogs) {
    return;
  }

  btnClearLogs.disabled = true;
  btnClearLogs.textContent = 'Clearing...';

  try {
    const response = await chrome.runtime.sendMessage({ type: 'CLEAR_BROWSER_LOGS' });
    if (response?.success) {
      logInfo('Popup', 'Cleared browser logs');
      if (logOutput) {
        logOutput.textContent = 'Logs cleared';
        logOutput.style.display = 'block';
      }
    } else {
      logError('Popup', 'Failed to clear browser logs', response?.error);
      if (logOutput) {
        logOutput.textContent = `Failed to clear logs: ${response?.error || 'Unknown error'}`;
        logOutput.style.display = 'block';
      }
    }
  } catch (error) {
    logError('Popup', 'Failed to clear browser logs', error);
    if (logOutput) {
      logOutput.textContent = 'Unable to clear logs right now.';
      logOutput.style.display = 'block';
    }
  } finally {
    btnClearLogs.textContent = 'Clear Logs';
    btnClearLogs.disabled = false;
    refreshLogs();
  }
});




