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
const queueEncodeBtn = document.getElementById('queueEncodeBtn');
const startEncodeBtn = document.getElementById('startEncodeBtn');
const encodingProfileSelect = document.getElementById('encodingProfile');
const englishOnlyCheckbox = document.getElementById('englishOnlyCheckbox');
const screenshotOffsetInput = document.getElementById('screenshotOffset');
const screenshotOffsetBtn = document.getElementById('screenshotOffsetBtn');

if (startEncodeBtn) {
  startEncodeBtn.onclick = async () => {
    const newName = newNameInput.value.trim();
    if (!newName || !videoFiles[currentIndex]) return;
    // Check queue state
    const queue = await ipcRenderer.invoke('get-encoding-queue');
    if (queue && queue.length > 0) {
      // If queue has items, just start encoding
      await ipcRenderer.invoke('start-encoding-queue');
    } else {
      // If queue is empty, add current item and start encoding
      const profile = encodingProfileSelect ? encodingProfileSelect.value : 'SD';
      const englishOnly = englishOnlyCheckbox ? englishOnlyCheckbox.checked : false;
      // Rename first
      const newPath = await ipcRenderer.invoke('rename-video', videoFiles[currentIndex], newName);
      if (newPath) {
        renameResult.textContent = 'Renamed to: ' + newPath;
        videoFiles[currentIndex] = newPath;
        screenshotsOffset = 0;
        let fullMetadata = currentVideoMetadata;
        if (!fullMetadata) {
          fullMetadata = await ipcRenderer.invoke('get-video-meta', newPath).then(meta => meta ? meta.fullMetadata : null);
        }
        await ipcRenderer.invoke('add-to-encoding-queue', {
          filePath: newPath,
          outName: newName,
          profile,
          englishOnly,
          fullMetadata
        });
        await ipcRenderer.invoke('start-encoding-queue');
        // Move to next file automatically if not last
        if (currentIndex < videoFiles.length - 1) {
          currentIndex++;
          videoMetaDiv.textContent = '';
          updateUI();
        }
      } else {
        renameResult.textContent = 'Rename failed.';
      }
    }
  };
}

if (queueEncodeBtn) {
  queueEncodeBtn.onclick = async () => {
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
      let fullMetadata = currentVideoMetadata;
      if (!fullMetadata) {
        console.warn('No metadata found for', newPath);
        fullMetadata = await ipcRenderer.invoke('get-video-meta', newPath).then(meta => meta ? meta.fullMetadata : null);
      }
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

// No local encoding queue; all queueing is handled in main process
if (queueEncodeBtn) {
  queueEncodeBtn.onclick = async () => {
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
      const fullMetadata = currentVideoMetadata;
      if (! fullMetadata) {
        console.warn('No metadata found for', newPath);
        fullMetadata = await ipcRenderer.invoke('get-video-meta', newPath).then(meta => meta ? meta.fullMetadata : null);
      }
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
if (baseNameDialog) {
  baseNameDialog.style.display = 'none';
}

let screenshotsOffset = 0; // in seconds

let videoFiles = [];
let currentIndex = 0;
let baseName = '';
let currentVideoMetadata = null; 

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
  if (prevBtn) prevBtn.disabled = (currentIndex === 0);
  if (nextBtn) nextBtn.disabled = (currentIndex === videoFiles.length - 1);

  // Get video metadata and display
  ipcRenderer.invoke('get-video-meta', videoPath).then(meta => {
    if (meta && meta.fullMetadata) {
      currentVideoMetadata = meta.fullMetadata;
    }
    if (videoMetaDiv) {
      if (meta && meta.duration && meta.resolution) {
        videoMetaDiv.textContent = `(${meta.duration} | ${meta.resolution})`;
      } else {
        videoMetaDiv.textContent = '';
      }
    }
  });

  const screenshotOffsetVal = parseInt(screenshotOffsetInput.value);
  if (!isNaN(screenshotOffsetVal) && screenshotOffsetVal >= 0) {
    screenshotsOffset = screenshotOffsetVal;
  }

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
    screenshotOffsetInput.value = screenshotsOffset;
    updateUI();
  };
}

if (screenshotOffsetBtn) {
  screenshotOffsetBtn.onclick = () => {
    const val = parseInt(screenshotOffsetInput.value);
    if (!isNaN(val) && val >= 0) {
      screenshotsOffset = val;
      updateUI();
    }
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
