import { logInfo, logError, getBrowserLogs, clearBrowserLogs, formatLogEntry } from '../logger';
console.log('[Popup] Popup script loaded');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const statusElement = document.getElementById('status');
const btnLogToggle = document.getElementById('btnLogToggle');
const btnClearLogs = document.getElementById('btnClearLogs');
const logViewer = document.getElementById('logViewer');
const logContent = document.getElementById('logContent');
if (!btnStart || !btnStop || !statusElement) {
    console.error('[Popup] Failed to find required DOM elements:', {
        btnStart: !!btnStart,
        btnStop: !!btnStop,
        statusElement: !!statusElement,
    });
}
else {
    console.log('[Popup] DOM elements found successfully');
}
// Check recording status on load
console.log('[Popup] Initial status check...');
updateStatus();
// Start recording
btnStart.addEventListener('click', async () => {
    await logInfo('Popup', 'User clicked Start Recording', undefined, 'R1');
    console.log('[Popup] Start button clicked');
    try {
        await logInfo('Popup', 'Sending START_RECORDING to background', undefined, 'R2');
        console.log('[Popup] Sending START_RECORDING message to background...');
        const response = await chrome.runtime.sendMessage({ type: 'START_RECORDING' });
        console.log('[Popup] Received response from background:', response);
        if (response && response.success) {
            await logInfo('Popup', 'Background reported recording started', { response }, 'R3');
            console.log('[Popup] Recording started successfully');
            updateStatus();
        }
        else {
            const errorMsg = response?.error || 'Unknown error';
            await logError('Popup', 'Failed to start recording', errorMsg, 'R3_ERR');
            console.error('[Popup] Failed to start recording:', errorMsg);
            alert(`Failed to start recording: ${errorMsg}`);
        }
    }
    catch (error) {
        await logError('Popup', 'Failed to start recording', error, 'R3_ERR');
        console.error('[Popup] Exception while starting recording:', error);
        console.error('[Popup] Error details:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        alert(`Failed to start recording: ${error instanceof Error ? error.message : String(error)}`);
    }
});
// Stop recording
btnStop.addEventListener('click', async () => {
    await logInfo('Popup', 'User clicked Stop Recording', undefined, 'R_STOP_1');
    try {
        await logInfo('Popup', 'Sending STOP_RECORDING to background', undefined, 'R_STOP_2');
        const response = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
        if (response && response.success) {
            await logInfo('Popup', 'Background reported recording stopped', { response }, 'R_STOP_3');
            updateStatus();
        }
        else {
            const errorMsg = response?.error || 'Unknown error';
            await logError('Popup', 'Failed to stop recording', errorMsg, 'R_STOP_3_ERR');
            alert(`Failed to stop recording: ${errorMsg}`);
        }
    }
    catch (error) {
        await logError('Popup', 'Failed to stop recording', error, 'R_STOP_3_ERR');
        console.error('Failed to stop recording:', error);
        alert('Failed to stop recording');
    }
});
// Update UI status
async function updateStatus() {
    try {
        console.log('[Popup] Checking recording status...');
        const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' });
        console.log('[Popup] Status response:', response);
        const isRecording = response?.isRecording ?? false;
        if (isRecording) {
            statusElement.textContent = '🔴 Recording...';
            statusElement.className = 'status recording';
            btnStart.disabled = true;
            btnStop.disabled = false;
            console.log('[Popup] Status updated: Recording');
        }
        else {
            statusElement.textContent = 'Ready to record';
            statusElement.className = 'status idle';
            btnStart.disabled = false;
            btnStop.disabled = true;
            console.log('[Popup] Status updated: Idle');
        }
    }
    catch (error) {
        console.error('[Popup] Failed to get status:', error);
    }
}
// Poll status every second when recording
setInterval(() => {
    updateStatus();
}, 1000);
// Log viewer functionality
let logViewerVisible = false;
btnLogToggle.addEventListener('click', async () => {
    logViewerVisible = !logViewerVisible;
    if (logViewerVisible) {
        logViewer.classList.add('visible');
        btnLogToggle.textContent = 'Hide Logs';
        await refreshLogs();
        // Auto-refresh logs every 2 seconds when visible
        if (!window.__logRefreshInterval) {
            window.__logRefreshInterval = setInterval(async () => {
                if (logViewerVisible) {
                    await refreshLogs();
                }
            }, 2000);
        }
    }
    else {
        logViewer.classList.remove('visible');
        btnLogToggle.textContent = 'Show Logs';
        if (window.__logRefreshInterval) {
            clearInterval(window.__logRefreshInterval);
            window.__logRefreshInterval = null;
        }
    }
});
btnClearLogs.addEventListener('click', async () => {
    if (confirm('Clear all logs?')) {
        await clearBrowserLogs();
        await refreshLogs();
    }
});
async function refreshLogs() {
    try {
        const logs = await getBrowserLogs();
        logContent.innerHTML = '';
        if (logs.length === 0) {
            logContent.innerHTML = '<div class="log-line">No logs yet. Start a recording to see logs.</div>';
            return;
        }
        logs.forEach((entry, index) => {
            const line = document.createElement('div');
            line.className = `log-line ${entry.level}`;
            line.textContent = formatLogEntry(entry, index);
            logContent.appendChild(line);
        });
        // Auto-scroll to bottom
        logContent.scrollTop = logContent.scrollHeight;
    }
    catch (error) {
        console.error('[Popup] Failed to refresh logs:', error);
        logContent.innerHTML = `<div class="log-line error">Error loading logs: ${error instanceof Error ? error.message : String(error)}</div>`;
    }
}
