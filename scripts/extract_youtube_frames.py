#!/usr/bin/env python3
"""
Extract JPEG frames from YouTube or a local video for YOLO labeling / training.

Requires:
    pip install yt-dlp opencv-python-headless

Usage:
    python scripts/extract_youtube_frames.py "https://www.youtube.com/watch?v=lHUdKqRQnzs" --start 922
    python scripts/extract_youtube_frames.py --local game.mp4 --start 922 --count 200

Roboflow classes: ball, hoop, player
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path


def run(cmd: list[str], cwd: Path | None = None) -> None:
    print("+", " ".join(cmd))
    subprocess.run(cmd, check=True, cwd=cwd)


def download_video(url: str, work_dir: Path) -> Path:
    work_dir.mkdir(parents=True, exist_ok=True)
    out_tpl = str(work_dir / "source.%(ext)s")
    run([
        sys.executable, "-m", "yt_dlp",
        "-f", "bv*[height<=720]+ba/b[height<=720]",
        "--merge-output-format", "mp4",
        "--no-playlist",
        "-o", out_tpl,
        url,
    ])
    for ext in ("mp4", "mkv", "webm"):
        candidate = work_dir / f"source.{ext}"
        if candidate.exists():
            return candidate
    matches = list(work_dir.glob("source.*"))
    if not matches:
        raise SystemExit("Download failed — no output file")
    return matches[0]


def extract_frames(
    video: Path,
    out_dir: Path,
    start_sec: float,
    count: int,
    every_nth: int,
    jpeg_quality: int,
) -> dict:
    try:
        import cv2
    except ImportError:
        raise SystemExit("pip install opencv-python-headless")

    out_dir.mkdir(parents=True, exist_ok=True)
    cap = cv2.VideoCapture(str(video))
    if not cap.isOpened():
        raise SystemExit(f"Cannot open {video}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    start_frame = max(0, int(start_sec * fps))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    saved = 0
    frame_idx = 0
    t0 = time.time()

    while saved < count:
        ok, frame = cap.read()
        if not ok:
            break
        if frame_idx % every_nth == 0:
            path = out_dir / f"frame_{saved:05d}.jpg"
            cv2.imwrite(str(path), frame, [int(cv2.IMWRITE_JPEG_QUALITY), jpeg_quality])
            saved += 1
        frame_idx += 1

    cap.release()
    elapsed = time.time() - t0

    manifest = {
        "source": str(video),
        "start_sec": start_sec,
        "start_frame": start_frame,
        "fps": fps,
        "total_frames_in_file": total_frames,
        "saved": saved,
        "every_nth": every_nth,
        "jpeg_quality": jpeg_quality,
        "elapsed_sec": round(elapsed, 2),
        "output_dir": str(out_dir),
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract basketball training frames")
    parser.add_argument("url", nargs="?", help="YouTube URL (omit with --local)")
    parser.add_argument("--local", type=Path, help="Local video file instead of YouTube")
    parser.add_argument("--start", type=float, default=922.0, help="Start time in seconds")
    parser.add_argument("--count", type=int, default=150, help="Frames to save")
    parser.add_argument("--every", type=int, default=2, help="Save every Nth frame")
    parser.add_argument("--quality", type=int, default=92, help="JPEG quality 1-100")
    parser.add_argument("--out", type=Path, default=Path("data/broadcast_frames"))
    parser.add_argument("--keep-video", action="store_true")
    args = parser.parse_args()

    if args.local:
        video = args.local.resolve()
        if not video.exists():
            raise SystemExit(f"File not found: {video}")
    elif args.url:
        work = Path(".venv-train/work")
        video = download_video(args.url, work)
    else:
        parser.error("Provide a YouTube URL or --local video path")

    manifest = extract_frames(
        video, args.out, args.start, args.count, args.every, args.quality,
    )
    print(f"Saved {manifest['saved']} frames → {args.out} ({manifest['elapsed_sec']}s)")

    if not args.keep_video and not args.local:
        shutil.rmtree(Path(".venv-train/work"), ignore_errors=True)

    print("\nNext steps:")
    print("  1. Upload frames to Roboflow — label ball, hoop, player")
    print("  2. Export YOLOv8 → set DATASET_YAML env var")
    print("  3. python scripts/train_model.py")
    print("  4. In modelSource.ts set ACTIVE_MODEL_KIND = 'basketball'")


if __name__ == "__main__":
    main()
