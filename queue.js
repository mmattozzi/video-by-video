// queue.js
const { ipcRenderer } = require('electron');

function renderQueue(queue) {
  const queueList = document.getElementById('queueList');
  queueList.innerHTML = '';
  if (!queue || queue.length === 0) {
    queueList.textContent = 'The encoding queue is empty.';
    return;
  }
  queue.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'queue-item';
    div.textContent = `${idx + 1}. ${item.outName} (${item.profile})`;
    queueList.appendChild(div);
  });
}

function updateQueue() {
  ipcRenderer.invoke('get-encoding-queue').then(renderQueue);
}

window.onload = updateQueue;
setInterval(updateQueue, 2000); // Poll every 2 seconds
