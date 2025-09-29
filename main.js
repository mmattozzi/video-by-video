const { app, BrowserWindow, dialog, ipcMain, Menu } = require('electron');
// Set the app name and menu for the macOS menu bar
if (process.platform === 'darwin') {
  app.name = 'VideoByVideo';
  const template = [
    {
      label: 'VideoByVideo',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const { spawn } = require('child_process');

ffmpeg.setFfmpegPath(ffmpegPath);

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('select-videos', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled) return [];
  return filePaths;
});

ipcMain.handle('extract-screenshots', async (event, videoPath, offset = 0) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration;
      const count = 8;
      const interval = duration / (count + 1);
      const screenshotsDir = path.join(app.getPath('temp'), 'video-thingy-screens');
      if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir);
      // Start timestamps at offset, then add interval
      let start = offset;
      let timestamps = Array.from({ length: count }, (_, i) => start + interval * (i + 1));
      // Clamp timestamps to duration
      timestamps = timestamps.map(ts => Math.min(ts, duration - 1));
      const files = [];
      let done = 0;
      timestamps.forEach((ts, i) => {
        const outPath = path.join(screenshotsDir, `screenshot${i + 1}.png`);
        ffmpeg(videoPath)
          .screenshots({
            timestamps: [ts],
            filename: `screenshot${i + 1}.png`,
            folder: screenshotsDir,
            size: '320x?'
          })
          .on('end', () => {
            files[i] = outPath;
            done++;
            if (done === count) resolve(files);
          })
          .on('error', reject);
      });
    });
  });
});

ipcMain.handle('rename-video', async (event, oldPath, newName) => {
  const dir = path.dirname(oldPath);
  const ext = path.extname(oldPath);
  const newPath = path.join(dir, newName + ext);
  try {
    fs.renameSync(oldPath, newPath);
    return newPath;
  } catch (e) {
    return null;
  }
});

ipcMain.handle('play-video', (event, filePath) => {
  if (process.platform === 'darwin') {
    // Use AppleScript to open file in running VLC instance
    const { spawn } = require('child_process');
    spawn('osascript', ['-e', `tell application "VLC" to open POSIX file "${filePath.replace(/"/g, '\"')}"`], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  } else {
    let vlcPath = 'vlc';
    const { spawn } = require('child_process');
    spawn(vlcPath, ['--one-instance', '--playlist-enqueue', filePath], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  }
});
