const btnStart = document.getElementById('btnStart') as HTMLButtonElement;
const btnStop = document.getElementById('btnStop') as HTMLButtonElement;
const status = document.getElementById('status') as HTMLDivElement;

// Check recording status on load
updateStatus();

// Start recording
btnStart.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'START_RECORDING' });
    if (response.success) {
      updateStatus();
    } else {
      alert(`Failed to start recording: ${response.error}`);
    }
  } catch (error) {
    console.error('Failed to start recording:', error);
    alert('Failed to start recording');
  }
});

// Stop recording
btnStop.addEventListener('click', async () => {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
    if (response.success) {
      updateStatus();
    } else {
      alert(`Failed to stop recording: ${response.error}`);
    }
  } catch (error) {
    console.error('Failed to stop recording:', error);
    alert('Failed to stop recording');
  }
});

// Update UI status
async function updateStatus(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' });
    const isRecording = response.isRecording;

    if (isRecording) {
      status.textContent = '🔴 Recording...';
      status.className = 'status recording';
      btnStart.disabled = true;
      btnStop.disabled = false;
    } else {
      status.textContent = 'Ready to record';
      status.className = 'status idle';
      btnStart.disabled = false;
      btnStop.disabled = true;
    }
  } catch (error) {
    console.error('Failed to get status:', error);
  }
}

// Poll status every second when recording
setInterval(() => {
  updateStatus();
}, 1000);



