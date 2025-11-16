// Select subtitle tracks based on profile and metadata
function selectSubtitleTracks(profile, fullMetadata, englishOnly = false) {
  if (profile.startsWith('SD')) {
    if (fullMetadata && fullMetadata.streams) {
      // Find all subtitle streams
      const subtitleStreams = fullMetadata.streams.filter(st => st.codec_type === 'subtitle');
      // Prefer DVD subtitles if available
      const dvdSubs = subtitleStreams.filter(st => st.codec_name === 'dvd_subtitle');
      if (dvdSubs.length > 0) {
        return dvdSubs.map(st => st.index);
      }
      // Otherwise include all subtitles
      return subtitleStreams.map(st => st.index);
    }
  } else if (profile.startsWith('HD')) {
    if (fullMetadata && fullMetadata.streams) {
      // Find all subtitle streams
      const subtitleStreams = fullMetadata.streams.filter(st => st.codec_type === 'subtitle');
      // Prefer PGS subtitles if available
      const pgsSubs = subtitleStreams.filter(st => (st.codec_name == 'hdmv_pgs_subtitle' || st.codec_name == 'dvd_subtitle'));
      if (pgsSubs.length > 0) {
        return pgsSubs.map(st => st.index);
      }
      // Otherwise include all subtitles
      return subtitleStreams.map(st => st.index);
    }
  }
  return [];
}

function selectAudioTracks(profile, fullMetadata, englishOnly = false) {
  var audioTracks = [];
  console.log(JSON.stringify(fullMetadata, null, 2));
  if (fullMetadata && fullMetadata.streams) {
    // Find all audio streams
    const audioStreams = fullMetadata.streams.filter(st => st.codec_type.toLowerCase() == 'audio');
    if (audioStreams.length > 0) {
      var lowestAudioTrackIndex = null;
      for (let audioStream of audioStreams) {
        const audioLanguage = (audioStream.tags && (audioStream.tags.language || audioStream.tags.LANGUAGE)) ? (audioStream.tags.language || audioStream.tags.LANGUAGE).toLowerCase() : '';
        var audioTrack = { index: audioStream.index, lang: audioLanguage, codec: audioStream.codec_name, channels: audioStream.channels || 0 };
        console.log('Found audio track:', audioTrack);
        if (englishOnly) {
          if (audioLanguage == 'eng' || audioLanguage == 'en') {
            audioTracks.push(audioTrack);
            lowestAudioTrackIndex = (lowestAudioTrackIndex === null) ? audioStream.index : Math.min(lowestAudioTrackIndex, audioStream.index);
          }
        } else {
          audioTracks.push(audioTrack);
          lowestAudioTrackIndex = (lowestAudioTrackIndex === null) ? audioStream.index : Math.min(lowestAudioTrackIndex, audioStream.index);
        }
      }
      // Find the audio track with the lowest index and add a field to indicate it's the default
      if (lowestAudioTrackIndex !== null) {
        audioTracks = audioTracks.map(at => {
          if (at.index === lowestAudioTrackIndex) {
            return { ...at, isDefault: true };
          }
          return at;
        });
      }
      return audioTracks;
    }
  }
  return [];
}

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

// Store current ffmpeg output for UI
let currentFfmpegLog = '';

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

// IPC to open the queue window from renderer
ipcMain.handle('open-queue-window', () => {
  openQueueWindow();
});
// Global encoding queue and processing logic
let encodingQueue = [];
let encodingActive = false;

// IPC to get current ffmpeg log
ipcMain.handle('get-current-ffmpeg-log', async () => {
  return currentFfmpegLog;
});

function processEncodingQueue() {
  if (encodingActive || encodingQueue.length === 0) return;
  encodingActive = true;
  const item = encodingQueue[0];
  // Call the encode logic (reuse the existing handler)
  encodeItem(item).then(() => {
    encodingQueue.shift();
    encodingActive = false;
    processEncodingQueue();
  });
}

// IPC to add to the encoding queue
ipcMain.handle('add-to-encoding-queue', async (event, item) => {
  encodingQueue.push(item);
  return true;
});

// IPC to get the current encoding queue
ipcMain.handle('get-encoding-queue', async () => {
  return encodingQueue;
});

// IPC to start the encoding queue (without adding a new item)
ipcMain.handle('start-encoding-queue', async () => {
  if (!encodingActive && encodingQueue.length > 0) {
    processEncodingQueue();
    return true;
  }
  return false;
});

// Function to open the queue window
function openQueueWindow() {
  const queueWin = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    title: 'Encoding Queue'
  });
  queueWin.loadFile('queue.html');
}

ipcMain.handle('select-videos', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv'] }],
    properties: ['openFile', 'multiSelections'],
  });
  if (canceled) return [];
  return filePaths;
});


// // IPC handler for encoding SD
async function encodeItem(encodingQueueItem) {
  return new Promise((resolve, reject) => {
    // Select subtitle tracks to include
    const subtitleTrackIndexes = selectSubtitleTracks(encodingQueueItem.profile, encodingQueueItem.fullMetadata, encodingQueueItem.englishOnly);
    const audioStreams = selectAudioTracks(encodingQueueItem.profile, encodingQueueItem.fullMetadata, encodingQueueItem.englishOnly);

    const dir = path.dirname(encodingQueueItem.filePath);
    const ext = path.extname(encodingQueueItem.filePath);
    const completedDir = path.join(dir, 'Completed');
    if (!fs.existsSync(completedDir)) fs.mkdirSync(completedDir);
    const outPath = path.join(completedDir, encodingQueueItem.outName + (encodingQueueItem.profile.startsWith('SD') ? '.mp4' : '.mkv'));
    const logPath = path.join(completedDir, 'ffmpeg.log');
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });

    // Fail early if no audio streams found
    if (!audioStreams || audioStreams.length === 0) {
      logStream.end();
      currentFfmpegLog += '[Error: No audio streams found. Encoding aborted.]\n';
      resolve(false);
      return;
    }

    var hdScale = (encodingQueueItem.fullMetadata && encodingQueueItem.fullMetadata.crop) ? 
      `crop=${encodingQueueItem.fullMetadata.crop},scale=1920:-2` : "scale=1920:-2";

    let ffmpegArgs;
    if (encodingQueueItem.profile === 'SD Animation') {
      // Animation: higher CRF, tune animation, deinterlacing
      ffmpegArgs = [
        '-fflags', '+genpts',
        '-i', encodingQueueItem.filePath,
        '-map', '0:v',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '21',
        '-tune', 'animation',
        '-vf', "yadif=deint=interlaced:mode=0,scale=720:-2",
        '-map', '0:a',
        '-c:a', 'aac',
        '-af', 'aresample=async=1:first_pts=0'
      ];
    } else if (encodingQueueItem.profile === 'HD Mac M1 HQ') {
      // HD profile for Mac M1: HEVC/h265 with videotoolbox and CQ 55
      ffmpegArgs = [
        '-fflags', '+genpts',
        '-i', encodingQueueItem.filePath,
        '-map', '0:v:0',
        '-c:v', 'hevc_videotoolbox',
        '-b:v',      '7500k',
        '-maxrate',  '7500k',
        '-bufsize', '15000k',
        '-tag:v', 'hvc1',
        '-vf', hdScale        
      ];
    } else if (encodingQueueItem.profile === 'HD HQ') {
      // HD profile for non-Mac M1: H.264 with libx264
      ffmpegArgs = [
        '-fflags', '+genpts',
        '-i', encodingQueueItem.filePath,
        '-map', '0:v:0',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '21',
        '-vf', hdScale
      ];
    } else if (encodingQueueItem.profile === 'HD Mac M1 MQ') {
      // HD profile for Mac M1: HEVC/h265 with videotoolbox and CQ 65
      ffmpegArgs = [
        '-fflags', '+genpts',
        '-i', encodingQueueItem.filePath,
        '-map', '0:v:0',
        '-c:v', 'hevc_videotoolbox',
        '-b:v', '4000k',
        '-maxrate', '4000k',
        '-bufsize', '8000k',
        '-pix_fmt', 'yuv420p',
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
        '-colorspace', 'bt709',
        '-tag:v', 'hvc1',
        '-vf', hdScale        
      ];
    } else if (encodingQueueItem.profile === '4K Mac M1 HQ') {
      // 4K profile for Mac M1: HEVC/h265 with videotoolbox and CQ 55
      ffmpegArgs = [
        '-fflags', '+genpts',
        '-i', encodingQueueItem.filePath,
        '-map', '0:v:0',
        '-c:v', 'hevc_videotoolbox',
        '-pix_fmt', 'yuv420p10le',
        '-tag:v', 'hvc1',
        '-q:v', '65',
        '-color_primaries', 'bt2020', '-color_trc', 'smpte2084', '-colorspace', 'bt2020nc',
        '-vf', "scale=3840:-2"        
      ];
    } else {
      // Default SD profile
      ffmpegArgs = [
        '-i', encodingQueueItem.filePath,
        '-map', '0:v',
        '-c:v', 'libx264',
        '-preset', 'slow',
        '-crf', '18',
        '-vf', "scale=720:-2",
        '-map', '0:a',
        '-c:a', 'aac'
      ];
    }

    var currentStreamIndex = 1;

    // Include all audio tracks for HD & better profiles
    if (encodingQueueItem.profile.startsWith('HD') || encodingQueueItem.profile.startsWith('4K')) {
      if (audioStreams.length > 0) {        
        audioStreams.forEach(at => {
          ffmpegArgs.push('-map', `0:${at.index}`);
          ffmpegArgs.push(`-c:${currentStreamIndex++}`, 'copy');

          // For the default audio track, if the code is not ac3 or aac, also include a re-encoded aac version
          if (at.isDefault) {
            if (at.codec !== 'aac' && at.codec !== 'ac3') {
              ffmpegArgs.push('-map', `0:${at.index}`);
              ffmpegArgs.push(`-filter:${currentStreamIndex}`, 'aresample=async=1:first_pts=0'); 
              ffmpegArgs.push(`-c:${currentStreamIndex}`, 'aac');
              ffmpegArgs.push(`-b:${currentStreamIndex++}`, '192k');              
            }
          }
        });
      }
    }

    // Include subtitle tracks if any
    if (! encodingQueueItem.profile.startsWith('SD') && subtitleTrackIndexes.length > 0) {
      subtitleTrackIndexes.forEach(idx => {
        ffmpegArgs.push('-map', `0:${idx}`);
        ffmpegArgs.push(`-c:${currentStreamIndex++}`, 'copy');
      });      
    }

    if (encodingQueueItem.profile == "SD Animation") {
      ffmpegArgs.push('-vsync', 'cfr');
    } else {
      ffmpegArgs.push('-vsync', 'vfr');
    }
    // Add output path
    ffmpegArgs.push('-y');
    ffmpegArgs.push(outPath);

    const ffmpegBin = ffmpegPath;
    console.log('Running ffmpeg with args:', ffmpegArgs.join(' '));
    currentFfmpegLog = '';
    const proc = spawn(ffmpegBin, ffmpegArgs);
    proc.stdout.on('data', data => {
      logStream.write(data);
      currentFfmpegLog += data.toString();
      if (currentFfmpegLog.length > 10000) currentFfmpegLog = currentFfmpegLog.slice(-10000); // limit log size
    });
    proc.stderr.on('data', data => {
      logStream.write(data);
      currentFfmpegLog += data.toString();
      if (currentFfmpegLog.length > 10000) currentFfmpegLog = currentFfmpegLog.slice(-10000);
    });
    proc.on('close', code => {
      logStream.end();
      currentFfmpegLog += `\n[ffmpeg exited with code ${code}]\n`;
      resolve(code === 0);
    });
    proc.on('error', err => {
      logStream.end();
      currentFfmpegLog += `\n[ffmpeg error: ${err}]\n`;
      resolve(false);
    });
  });
};

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
      if (offset == 0) offset = 5;
      let start = offset;
      let timestamps = Array.from({ length: count }, (_, i) => start + (interval * (i + 0)));
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

// IPC handler to get video duration and resolution
ipcMain.handle('get-video-meta', async (event, videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err || !metadata) return resolve({});
      // Duration in seconds
      let durationSec = metadata.format.duration || 0;
      // Format duration as hh:mm:ss or mm:ss if hours is zero
      const h = Math.floor(durationSec / 3600);
      const m = Math.floor((durationSec % 3600) / 60);
      const s = Math.floor(durationSec % 60);
      let durationStr;
      if (h > 0) {
        durationStr = `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      } else {
        durationStr = `${m}:${s.toString().padStart(2, '0')}`;
      }
      // Get resolution from first video stream
      let res = '';
      if (metadata.streams && metadata.streams.length) {
        const vStream = metadata.streams.find(st => st.codec_type === 'video');
        if (vStream && vStream.width && vStream.height) {
          res = `${vStream.width}x${vStream.height}`;
        }
      }

      // Run cropdetect for a few seconds to get crop values
      const ffmpegBin = ffmpegPath;
      const cropArgs = [
        '-ss', '120', // skip first 2 seconds
        '-i', videoPath,
        '-t', '4', // analyze 4 seconds
        '-vf', 'cropdetect=24:16:0',
        '-an',
        '-f', 'null',
        '-'
      ];
      let cropResult = '';
      const proc = spawn(ffmpegBin, cropArgs);
      proc.stderr.on('data', data => {
        cropResult += data.toString();
      });
      proc.on('close', code => {
        // Parse crop values from output
        const cropMatches = [...cropResult.matchAll(/crop=([0-9]+:[0-9]+:[0-9]+:[0-9]+)/g)];
        let crop = null;
        if (cropMatches.length > 0) {
          crop = cropMatches[cropMatches.length - 1][1]; // use last detected crop
        }
        console.log(`Detected crop: ${crop}, adding to metadata.`);
        metadata.crop = crop;
        resolve({ duration: durationStr, resolution: res, fullMetadata: metadata });
      });
      proc.on('error', err => {
        resolve({ duration: durationStr, resolution: res, fullMetadata: metadata });
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
