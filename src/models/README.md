# Basketball Detection Model

## Classes
- `0`: ball
- `1`: hoop
- `2`: ballInBasket
- `3`: player

## Training

Run the training script from the project root:

```bash
pip install ultralytics onnx tf2onnx tensorflow
python scripts/train_model.py
```

This will:
1. Fine-tune YOLOv8n on the Roboflow Basketball Detection dataset
2. Export to ONNX
3. Convert to TFLite int8 quantization
4. Copy `basketball_detector.tflite` to this directory

## Dataset Sources
- [Roboflow Basketball Detection](https://universe.roboflow.com/basketball-6vyfz/basketball-detection-srfkd)
- [SwishAI YOLOv11 weights](https://github.com/sPappalard/SwishAI)

## Development Mode

Until the TFLite model is trained and placed here, the app uses `mockDetector.ts`
to simulate shot detection for UI development and testing.

## Model Requirements
- Input: 320x320x3 uint8 RGB
- Output: YOLO format detections [x, y, w, h, confidence, class_id]
- Target inference: 5-10 FPS on mid-range devices
