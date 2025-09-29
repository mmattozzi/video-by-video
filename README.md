# Video By Video

This Electron app lets you:
- Open a video file
- Extract 8 evenly spaced screenshots from the video
- Preview the screenshots
- Open the video in VLC
- Rename the video file from the UI

## Prereqs
- [node.js](https://nodejs.org/) v22+
- [VLC](https://www.videolan.org/vlc/) if you want to play video from inside the app

## Usage
1. Run the app: `npm start`
2. Click "Open Video File" and select one or many videos
3. View screenshots and rename the file

## Development
- Electron
- ffmpeg-static & fluent-ffmpeg for screenshots
