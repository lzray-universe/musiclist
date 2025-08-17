#!/usr/bin/env python3
import json
import os
import shutil
import subprocess
from pathlib import Path
from datetime import datetime
import hashlib

ROOT = Path(__file__).resolve().parent.parent
MUSIC_DIR = ROOT / "music"
SITE_DIR = ROOT / "site"
DIST_DIR = ROOT / "dist"

AUDIO_EXTS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}
MIME = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
}

CONFIG = json.load(open(ROOT / 'config.json', 'r', encoding='utf-8')) if (ROOT / 'config.json').exists() else {}
PUB = CONFIG.get('publish', {
    "originals": True,
    "encodeLossless": True,
    "aacBitrate": "192k",
    "mp3Bitrate": "256k"
})

def has_ffmpeg():
    try:
        subprocess.run(["ffmpeg", "-version"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False

def sha1(s: str) -> str:
    return hashlib.sha1(s.encode('utf-8')).hexdigest()[:12]

def copy_site():
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    for name in ["index.html", "style.css", "app.js", "config.json"]:
        src = SITE_DIR / name
        if src.exists():
            shutil.copy2(src, DIST_DIR / name)

def rel_from_music(p: Path) -> Path:
    return p.relative_to(MUSIC_DIR)

def copy_original(src: Path):
    rel = rel_from_music(src)
    dst = DIST_DIR / "audio" / "raw" / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    return (str(Path("audio/raw") / rel).replace("\\", "/"), MIME.get(src.suffix.lower(), "application/octet-stream"))

def transcode(src: Path, ext: str, bitrate: str):
    """Transcode src (wav/flac) into ext ('.mp3' or '.m4a') with ffmpeg."""
    rel = rel_from_music(src).with_suffix(ext)
    out = DIST_DIR / "audio" / ext.strip(".") / rel
    out.parent.mkdir(parents=True, exist_ok=True)

    if ext == ".mp3":
        cmd = ["ffmpeg", "-y", "-i", str(src), "-vn", "-b:a", bitrate, str(out)]
    elif ext == ".m4a":
        # AAC in MP4 container
        cmd = ["ffmpeg", "-y", "-i", str(src), "-vn", "-c:a", "aac", "-b:a", bitrate, "-movflags", "+faststart", str(out)]
    else:
        raise ValueError("Unsupported transcode ext")

    subprocess.run(cmd, check=True)
    return (str(Path("audio") / ext.strip(".") / rel).replace("\\", "/"), MIME[ext])

def gather_tracks():
    tracks = []
    use_ffmpeg = has_ffmpeg() and PUB.get("encodeLossless", True)
    for p in MUSIC_DIR.rglob("*"):
        if not p.is_file() or p.suffix.lower() not in AUDIO_EXTS:
            continue
        rel = rel_from_music(p)
        groupPath = str(rel.parent).replace("\\", "/")
        title = p.stem
        track_id = sha1(str(rel))

        sources = []
        # Prefer encoded formats; keep originals if requested
        if p.suffix.lower() in [".wav", ".flac"] and use_ffmpeg:
            # Make both m4a (AAC) and mp3 for max compatibility
            try:
                m4a_url, m4a_mime = transcode(p, ".m4a", PUB.get("aacBitrate", "192k"))
                sources.append({"url": m4a_url, "mime": m4a_mime})
            except Exception as e:
                print(f"[warn] AAC transcode failed for {rel}: {e}")
            try:
                mp3_url, mp3_mime = transcode(p, ".mp3", PUB.get("mp3Bitrate", "256k"))
                sources.append({"url": mp3_url, "mime": mp3_mime})
            except Exception as e:
                print(f"[warn] MP3 transcode failed for {rel}: {e}")
        # Always include originals if enabled
        if PUB.get("originals", True):
            url, mime = copy_original(p)
            sources.append({"url": url, "mime": mime})

        # For already-compressed formats, just copy originals (in case originals=False was set)
        if p.suffix.lower() in [".mp3", ".m4a", ".aac", ".ogg"] and not sources:
            url, mime = copy_original(p)
            sources.append({"url": url, "mime": mime})

        track = {
            "id": track_id,
            "title": title,
            "artist": "",
            "album": "",
            "duration": 0,
            "groupPath": groupPath if groupPath != "." else "",
            "sources": sources,
        }
        tracks.append(track)
    # Sort tracks by path then title
    tracks.sort(key=lambda t: (t["groupPath"], t["title"]))
    return tracks

def build():
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    copy_site()
    tracks = gather_tracks()
    out = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "tracks": tracks,
    }
    with open(DIST_DIR / "index.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"Built {len(tracks)} tracks → {DIST_DIR}")

if __name__ == "__main__":
    build()
