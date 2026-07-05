#!/usr/bin/env python3
"""
Download and export YOLOv8n COCO TFLite for on-device pipeline testing.

Usage (from project root):
    python -m venv .venv-train
    .venv-train\\Scripts\\activate        # Windows
    pip install ultralytics
    python scripts/download_coco_tflite.py

Output: src/models/yolov8n_coco.tflite (~6 MB, detects person + sports ball)
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "models" / "yolov8n_coco.tflite"


def main() -> None:
    try:
        from ultralytics import YOLO
    except ImportError:
        print("Install ultralytics: pip install ultralytics")
        sys.exit(1)

    print("Exporting YOLOv8n COCO → TFLite (320px, float32)...")
    model = YOLO("yolov8n.pt")
    export_path = model.export(format="tflite", imgsz=320, int8=False)

    src = Path(str(export_path))
    if not src.exists():
        candidates = list(ROOT.glob("**/yolov8n*.tflite"))
        if not candidates:
            raise SystemExit(f"Export failed — no .tflite found near {export_path}")
        src = candidates[0]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, OUT)
    print(f"Saved: {OUT} ({OUT.stat().st_size // 1024} KB)")
    print("\nNext:")
    print("  npx expo prebuild --platform android --clean")
    print("  npx expo run:android")


if __name__ == "__main__":
    main()
