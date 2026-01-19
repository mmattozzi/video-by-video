// queue.js
const { ipcRenderer } = require('electron');

function renderQueue(queue, active) {
  const queueList = document.getElementById('queueList');
  const currentItemContainer = document.getElementById('currentItemContainer');
  currentItemContainer.innerHTML = '';
  queueList.innerHTML = '';
  if (!queue || queue.length === 0) {
    currentItemContainer.textContent = '';
    queueList.textContent = 'The encoding queue is empty.';
    return;
  }
  // Show the currently running item (first in queue)
  const current = queue[0];
  const currentBox = document.createElement('div');
  currentBox.className = 'current-item-box';
  const title = document.createElement('div');
  title.className = 'current-item-title';
  title.textContent = 'Now Encoding';
  currentBox.appendChild(title);
  const currentFile = document.createElement('div');
  currentFile.className = 'current-item-file';
  currentFile.textContent = `${current.outName} (${current.profile})`;
  currentBox.appendChild(currentFile);
  // Move the log textarea into the green box
  const logBox = document.createElement('textarea');
  logBox.id = 'ffmpegLog';
  logBox.readOnly = true;
  currentBox.appendChild(logBox);
  if (active) {
    const stopBtn = document.createElement('button');
    stopBtn.textContent = 'Stop Encoding';
    stopBtn.onclick = () => {
      ipcRenderer.invoke('stop-current-encoding');
    };
    currentBox.appendChild(stopBtn);
  }
  currentItemContainer.appendChild(currentBox);

  // Show the rest of the queue
  if (queue.length > 1) {
    queue.slice(1).forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'queue-item';
      div.textContent = `${idx + 2}. ${item.outName} (${item.profile})`;
      queueList.appendChild(div);
    });
  } else {
    queueList.textContent = 'No other items in the queue.';
  }
}

function updateQueue() {
  ipcRenderer.invoke('get-encoding-status').then(status => {
    renderQueue(status.queue, status.active);
    // After rendering, update the log box if present
    ipcRenderer.invoke('get-current-ffmpeg-log').then(log => {
      const logBox = document.getElementById('ffmpegLog');
      if (logBox) {
        logBox.value = log || '';
        // Auto-scroll to bottom
        logBox.scrollTop = logBox.scrollHeight;
      }
    });
  });
}

window.onload = updateQueue;
setInterval(updateQueue, 2000); // Poll every 2 seconds
