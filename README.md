# GitHub Actions Music Playlist (MP3/WAV/FLAC) + Visualizer

This repo lets you **drop audio files into `music/` (with any subfolders)** and get a **beautiful player** deployed to **GitHub Pages** automatically via **GitHub Actions**. It includes:

- ✅ MP3/WAV/FLAC ingestion (recursive folders become *groups*)
- ✅ Automatic `index.json` with title/artist/album/duration via `ffprobe`
- ✅ Optional **transcode** for better browser support: FLAC/WAV → `m4a` (AAC) + `mp3`
- ✅ Fancy **WebAudio** visualizer (bars + radial), Media Session API, keyboard shortcuts
- ✅ Single-page app (no refresh), mobile friendly, glassmorphism UI

---

## Quick Start

1. **Create a new GitHub repo** and upload these files.
2. In your repo, go to **Settings → Pages** and set **Build and deployment → Source: GitHub Actions**.
3. Commit/push. The Action will run and deploy to Pages.
4. Put your songs inside the `music/` folder (you can create subfolders to group). Push again.

> **Note about file sizes**
> - GitHub limits individual files to **100 MB** in normal git. Larger files require **Git LFS**.  
> - GitHub Pages bandwidth is limited; consider using the **transcoded outputs** (the workflow makes `m4a`/`mp3`) for web playback.

---

## How it works

- The workflow installs `ffmpeg` and runs `scripts/build.py`
- `build.py` scans the `music/` directory recursively and collects metadata using `ffprobe`
- For `wav/flac`, it generates `m4a` (AAC) and `mp3` fallbacks
- It copies the single-page app (`site/`) into `dist/` and writes `dist/index.json`
- GitHub Pages deploys the `dist/` folder

---

## Local test (optional)

If you have Python 3 + ffmpeg installed locally:

```bash
python3 scripts/build.py
# Builds to dist/
# Then open dist/index.html in your browser (start a local server to avoid CORS),
# e.g.:
python3 -m http.server --directory dist 8080
```

---

## Folders

- `music/` — **Put your audio here** (supports subfolders for grouping)
- `scripts/build.py` — Scans audio, builds `index.json`, transcodes fallbacks
- `site/` — Front-end player (HTML/CSS/JS), copied to `dist/`
- `.github/workflows/build.yml` — GitHub Actions for Pages deployment

---

## Front-end features

- Folder groups (from directory structure), search, queue, next/prev
- Real-time visualizer (bars + radial) using WebAudio `AnalyserNode`
- Media Session API (lock screen controls)
- Remembers last track + position
- Keyboard: `Space` Play/Pause, `←/→` Seek, `↑/↓` Volume, `N` Next, `P` Previous

---

## Codec support note

- Most browsers play **MP3** and **AAC** broadly. **FLAC** support varies.  
- The player auto-chooses the **best playable** source among: original → `m4a` → `mp3`.

---

## Customize

Edit `site/style.css` and `site/app.js` for UI/visualizer tweaks.
