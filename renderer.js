const { ipcRenderer } = require('electron');

const openBtn = document.getElementById('openBtn');
const videoPathDiv = document.getElementById('videoPath');
const screenshotsDiv = document.getElementById('screenshots');
const renameSection = document.getElementById('rename-section');
const newNameInput = document.getElementById('newName');
const renameBtn = document.getElementById('renameBtn');
const renameResult = document.getElementById('renameResult');
const baseNameInput = document.getElementById('baseNameInput');
const setBaseNameBtn = document.getElementById('setBaseNameBtn');
const fileNav = document.getElementById('file-nav');
const fileIndexSpan = document.getElementById('fileIndex');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const baseNameDialog = document.getElementById('baseNameDialog');
const playBtn = document.getElementById('playBtn');

let videoFiles = [];
let currentIndex = 0;
let baseName = '';

function updateUI() {
  if (videoFiles.length === 0) {
    baseNameDialog.style.display = 'none';
    videoPathDiv.textContent = '';
    screenshotsDiv.innerHTML = '';
    renameSection.style.display = 'none';
    fileNav.style.display = 'none';
    return;
  }
  baseNameDialog.style.display = 'block';
  fileNav.style.display = 'block';
  fileIndexSpan.textContent = `File ${currentIndex + 1} of ${videoFiles.length}`;
  const videoPath = videoFiles[currentIndex];
  videoPathDiv.textContent = videoPath;
  screenshotsDiv.innerHTML = 'Extracting screenshots...';
  ipcRenderer.invoke('extract-screenshots', videoPath).then(screenshots => {
    screenshotsDiv.innerHTML = '';
    const cacheBuster = Date.now();
    screenshots.forEach((src, idx) => {
      const img = document.createElement('img');
      img.src = 'file://' + src + '?cb=' + cacheBuster + '_' + idx;
      img.width = 160;
      screenshotsDiv.appendChild(img);
    });
    renameSection.style.display = 'block';
    // Pre-populate rename input
    const origName = videoPath.split(/[\/]/).pop().replace(/\.[^/.]+$/, "");
    newNameInput.value = baseName ? `${baseName}` : origName;
    renameResult.textContent = '';
  });
}

openBtn.onclick = async () => {
  const files = await ipcRenderer.invoke('select-videos');
  if (!files || files.length === 0) return;
  videoFiles = files;
  currentIndex = 0;
  updateUI();
};

setBaseNameBtn.onclick = () => {
  baseName = baseNameInput.value.trim();
  if (videoFiles.length > 0) updateUI();
};


renameBtn.onclick = async () => {
  const newName = newNameInput.value.trim();
  if (!newName || !videoFiles[currentIndex]) return;
  const newPath = await ipcRenderer.invoke('rename-video', videoFiles[currentIndex], newName);
  if (newPath) {
    renameResult.textContent = 'Renamed to: ' + newPath;
    videoFiles[currentIndex] = newPath;
    // Move to next file automatically if not last
    if (currentIndex < videoFiles.length - 1) {
      currentIndex++;
      updateUI();
    }
  } else {
    renameResult.textContent = 'Rename failed.';
  }
};

// Pressing Enter in the rename input triggers the rename button
newNameInput.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    renameBtn.click();
  }
});

nextBtn.onclick = () => {
  if (currentIndex < videoFiles.length - 1) {
    currentIndex++;
    updateUI();
  }
};

prevBtn.onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    updateUI();
  }
};

if (playBtn) {
  playBtn.onclick = () => {
    if (videoFiles[currentIndex]) {
      ipcRenderer.invoke('play-video', videoFiles[currentIndex]);
    }
  };
}
