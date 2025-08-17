#!/usr/bin/env python3
import json
import os
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
MUSIC_DIR = ROOT / "music"
SITE_DIR = ROOT / "site"
DIST_DIR = ROOT / "dist"

AUDIO_EXTS = {".mp3", ".wav", ".flac"}
CONFIG = json.load(open(ROOT / 'config.json', 'r', encoding='utf-8')) if (ROOT / 'config.json').exists() else {}
PUB = CONFIG.get('publish', {})
PUBLISH_ORIGINALS = PUB.get('originals', True)
ENCODE_LOSSLESS = PUB.get('encodeLossless', True)
AAC_BR = PUB.get('aacBitrate', '192k')
MP3_BR = PUB.get('mp3Bitrate', '256k')


def ffprobe_info(path: Path):
    """Return duration (float seconds) and basic tags via ffprobe."""
    try:
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration:format_tags=artist,title,album",
            "-of", "json",
            str(path)
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout)
        dur = None
        artist = ""
        title = ""
        album = ""
        if "format" in data:
            fmt = data["format"]
            if "duration" in fmt:
                try:
                    dur = float(fmt["duration"])
                except:
                    dur = None
            tags = fmt.get("tags", {})
            artist = tags.get("artist") or tags.get("ARTIST") or ""
            title  = tags.get("title") or tags.get("TITLE") or ""
            album  = tags.get("album") or tags.get("ALBUM") or ""
        return dur, artist, title, album
    except Exception as e:
        return None, "", "", ""

def transcode_if_needed(src: Path, out_dir: Path):
    """
    If src is WAV/FLAC, generate AAC (.m4a) and MP3 fallbacks into out_dir.
    Returns list of (mime, relative_path_from_dist).
    """
    rel_from_root = src.relative_to(ROOT)
    rel_no_ext = src.with_suffix("").relative_to(ROOT)
    outputs = []

    # We'll mirror structure under dist/audio/enc/
    enc_dir = DIST_DIR / "audio" / "enc" / rel_no_ext.parent.relative_to("")
    enc_dir.mkdir(parents=True, exist_ok=True)

    ext = src.suffix.lower()
    if ext in [".wav", ".flac"]:
        # AAC (m4a)
        m4a_path = enc_dir / (rel_no_ext.name + ".m4a")
        cmd_aac = [
            "ffmpeg", "-y", "-i", str(src),
            "-vn",
            "-c:a", "aac", "-b:a", AAC_BR,
            "-movflags", "+faststart",
            "-map_metadata", "0",
            str(m4a_path)
        ]
        subprocess.run(cmd_aac, check=True)
        outputs.append(("audio/mp4", str(m4a_path.relative_to(DIST_DIR)).replace("\\", "/")))

        # MP3 (lame)
        mp3_path = enc_dir / (rel_no_ext.name + ".mp3")
        cmd_mp3 = [
            "ffmpeg", "-y", "-i", str(src),
            "-vn",
            "-c:a", "libmp3lame", "-b:a", MP3_BR,
            "-map_metadata", "0",
            str(mp3_path)
        ]
        subprocess.run(cmd_mp3, check=True)
        outputs.append(("audio/mpeg", str(mp3_path.relative_to(DIST_DIR)).replace("\\", "/")))

    return outputs

def copy_original(src: Path):
    """Copy original file into dist/audio/raw/ same relative path; return rel path from dist + mime."""
    rel = src.relative_to(ROOT / "music")
    dst = DIST_DIR / "audio" / "raw" / rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    mime = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".flac": "audio/flac",
    }.get(src.suffix.lower(), "application/octet-stream")
    return mime, str(dst.relative_to(DIST_DIR)).replace("\\", "/")

def main():
    if DIST_DIR.exists():
        shutil.rmtree(DIST_DIR)
    DIST_DIR.mkdir(parents=True, exist_ok=True)

    # Copy static site
    shutil.copy2(SITE_DIR / "index.html", DIST_DIR / "index.html")
    shutil.copy2(SITE_DIR / "style.css", DIST_DIR / "style.css")
    shutil.copy2(SITE_DIR / "app.js", DIST_DIR / "app.js")
    if (SITE_DIR / "config.json").exists():
        shutil.copy2(SITE_DIR / "config.json", DIST_DIR / "config.json")

    tracks = []
    for p in MUSIC_DIR.rglob("*"):
        if p.is_file() and p.suffix.lower() in AUDIO_EXTS:
            # meta
            dur, artist, title, album = ffprobe_info(p)
            if not title:
                title = p.stem
            group_path = str(p.relative_to(MUSIC_DIR).parent).replace("\\", "/")
            if group_path == ".":
                group_path = ""

            # copy original
            mime_orig, rel_orig = (None, None)
            if PUBLISH_ORIGINALS:
                mime_orig, rel_orig = copy_original(p)

            # fallbacks
            fallbacks = transcode_if_needed(p, DIST_DIR) if ENCODE_LOSSLESS else []

            sources = []
            if PUBLISH_ORIGINALS and mime_orig and rel_orig:
                sources.append({"mime": mime_orig, "url": rel_orig})
            for m, u in fallbacks:
                sources.append({"mime": m, "url": u})

            track = {
                "id": len(tracks) + 1,
                "title": title,
                "artist": artist,
                "album": album,
                "duration": dur,
                "groupPath": group_path,
                "sources": sources,
                "originalExt": p.suffix.lower(),
            }
            tracks.append(track)

    # Write index.json
    out = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "tracks": tracks,
    }
    with open(DIST_DIR / "index.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"Built {len(tracks)} tracks → {DIST_DIR}")

if __name__ == "__main__":
    main()
