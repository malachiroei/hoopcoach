#!/usr/bin/env python3
"""
Fine-tune YOLOv8 on basketball detection dataset and export to TFLite int8.

Usage:
    pip install ultralytics onnx tensorflow
    python scripts/train_model.py

Optional env vars:
    ROBOFLOW_API_KEY - for downloading dataset from Roboflow
"""

import os
import shutil
import subprocess
import sys

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "models")
MODEL_NAME = "basketball_detector"


def main():
    try:
        from ultralytics import YOLO
    except ImportError:
        print("Install ultralytics: pip install ultralytics")
        sys.exit(1)

    print("Loading YOLOv8n base model...")
    model = YOLO("yolov8n.pt")

    dataset_yaml = os.environ.get(
        "DATASET_YAML",
        "https://universe.roboflow.com/ds/basketball-detection-srfkd?key=" + os.environ.get("ROBOFLOW_API_KEY", "YOUR_KEY"),
    )

    print(f"Training on dataset: {dataset_yaml}")
    results = model.train(
        data=dataset_yaml,
        epochs=50,
        imgsz=320,
        batch=16,
        name="basketball_detector",
        classes=["ball", "hoop", "ball_in_basket", "player"],
    )

    print("Exporting to TFLite int8...")
    export_path = model.export(format="tflite", int8=True, imgsz=320)

    dest = os.path.join(OUTPUT_DIR, f"{MODEL_NAME}.tflite")
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    shutil.copy(export_path, dest)

    print(f"Model saved to: {dest}")
    print("Rebuild the Expo Dev Client to include the new model.")


if __name__ == "__main__":
    main()
