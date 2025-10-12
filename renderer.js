const openQueueBtn = document.getElementById('openQueueBtn');
if (openQueueBtn) {
  openQueueBtn.onclick = () => {
    ipcRenderer.invoke('open-queue-window');
  };
}
const { ipcRenderer } = require('electron');

const openBtn = document.getElementById('openBtn');
const videoPathDiv = document.getElementById('videoPath');
const screenshotsDiv = document.getElementById('screenshots');
const videoMetaDiv = document.getElementById('videoMeta');
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
const moreScreenshotsBtn = document.getElementById('moreScreenshotsBtn');
const encodeBtn = document.getElementById('encodeBtn');
const encodingProfileSelect = document.getElementById('encodingProfile');
const englishOnlyCheckbox = document.getElementById('englishOnlyCheckbox');

// No local encoding queue; all queueing is handled in main process
if (encodeBtn) {
  encodeBtn.onclick = async () => {
    const newName = newNameInput.value.trim();
    if (!newName || !videoFiles[currentIndex]) return;
    const profile = encodingProfileSelect ? encodingProfileSelect.value : 'SD';
    const englishOnly = englishOnlyCheckbox ? englishOnlyCheckbox.checked : false;
    // Rename first
    const newPath = await ipcRenderer.invoke('rename-video', videoFiles[currentIndex], newName);
    if (newPath) {
      renameResult.textContent = 'Renamed to: ' + newPath;
      videoFiles[currentIndex] = newPath;
      screenshotsOffset = 0;
      // Add to encoding queue in main process
      const fullMetadata = videoMetadatas[newPath];
      await ipcRenderer.invoke('add-to-encoding-queue', {
        filePath: newPath,
        outName: newName,
        profile,
        englishOnly,
        fullMetadata
      });
      // Move to next file automatically if not last
      if (currentIndex < videoFiles.length - 1) {
        currentIndex++;
        videoMetaDiv.textContent = '';
        updateUI();
      }
    } else {
      renameResult.textContent = 'Rename failed.';
    }
  };
}
if (moreScreenshotsBtn) {
  moreScreenshotsBtn.style.display = 'none';
}

let screenshotsOffset = 0; // in seconds

let videoFiles = [];
let currentIndex = 0;
let baseName = '';
let videoMetadatas = {}; // Store fullMetadata by file path

function updateUI() {
  if (videoFiles.length === 0) {
    baseNameDialog.style.display = 'none';
    videoPathDiv.textContent = '';
    screenshotsDiv.innerHTML = '';
    renameSection.style.display = 'none';
    fileNav.style.display = 'none';
    if (videoMetaDiv) videoMetaDiv.textContent = '';
    if (moreScreenshotsBtn) moreScreenshotsBtn.style.display = 'none';
    return;
  }
  baseNameDialog.style.display = 'flex';
  fileNav.style.display = 'block';
  fileIndexSpan.textContent = `File ${currentIndex + 1} of ${videoFiles.length}`;
  const videoPath = videoFiles[currentIndex];
  videoPathDiv.textContent = videoPath;
  screenshotsDiv.innerHTML = 'Extracting screenshots...';
  if (moreScreenshotsBtn) moreScreenshotsBtn.style.display = '';

  // Get video metadata and display
  ipcRenderer.invoke('get-video-meta', videoPath).then(meta => {
    if (meta && meta.fullMetadata) {
      videoMetadatas[videoPath] = meta.fullMetadata;
    }
    if (videoMetaDiv) {
      if (meta && meta.duration && meta.resolution) {
        videoMetaDiv.textContent = `(${meta.duration} | ${meta.resolution})`;
      } else {
        videoMetaDiv.textContent = '';
      }
    }
  });

  ipcRenderer.invoke('extract-screenshots', videoPath, screenshotsOffset).then(screenshots => {
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
  screenshotsOffset = 0;
  updateUI();
};


setBaseNameBtn.onclick = () => {
  baseName = baseNameInput.value.trim();
  if (videoFiles.length > 0) updateUI();
};

if (moreScreenshotsBtn) {
  moreScreenshotsBtn.onclick = () => {
    screenshotsOffset += 30; // 8 screenshots, 30 seconds each
    updateUI();
  };
}


renameBtn.onclick = async () => {
  const newName = newNameInput.value.trim();
  if (!newName || !videoFiles[currentIndex]) return;
  const newPath = await ipcRenderer.invoke('rename-video', videoFiles[currentIndex], newName);
  if (newPath) {
    renameResult.textContent = 'Renamed to: ' + newPath;
    videoFiles[currentIndex] = newPath;
    screenshotsOffset = 0;    
    // Move to next file automatically if not last
    if (currentIndex < videoFiles.length - 1) {
      currentIndex++;
      videoMetaDiv.textContent = '';
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
    screenshotsOffset = 0;
    videoMetaDiv.textContent = '';
    updateUI();
  }
};


prevBtn.onclick = () => {
  if (currentIndex > 0) {
    currentIndex--;
    screenshotsOffset = 0;
    videoMetaDiv.textContent = '';
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
