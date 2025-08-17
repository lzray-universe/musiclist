# Music Player (GitHub Pages)

This repo builds a static music player site from the `music/` folder.

## How it works
- `scripts/build.py` scans `music/` recursively.
- It copies originals to `dist/audio/raw/...`.
- If `ffmpeg` is available and `publish.encodeLossless=true` in `config.json`, it transcodes WAV/FLAC to MP3 (`mp3Bitrate`) and M4A/AAC (`aacBitrate`) and prefers those when playing.
- It writes `dist/index.json` and copies `site/*` (including `config.json`) into `dist/`, then deploys to GitHub Pages.

## Configure
Edit the root `config.json`:

```json
{
  "publish": {
    "originals": true,
    "encodeLossless": true,
    "aacBitrate": "192k",
    "mp3Bitrate": "256k"
  }
}
```

Customize the UI theme in `site/config.json`.

## Usage
1. Put your audio files into `music/` (you can nest folders to create groups).
2. Commit & push to `main`/`master`. GitHub Actions will build and deploy.
3. Open the GitHub Pages URL (printed in the **Deploy** job).

If you see **“未找到播放列表”** on the page, make sure Actions is enabled for the repo and Pages is enabled (the workflow sets `enablement: true`).

## Notes on FLAC
Not all browsers can play FLAC in `<audio>`. This player prefers AAC/MP3 if available and will show a helpful message if only FLAC exists and the browser can’t play it.
