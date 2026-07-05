# On-Device Detection Models

## Step 1 — Test pipeline (COCO pre-trained)

```powershell
python -m venv .venv-train
.venv-train\Scripts\activate
pip install ultralytics
python scripts/download_coco_tflite.py
```

This creates `yolov8n_coco.tflite` which detects:
- **class 32** → sports ball (mapped to `ball` overlay)
- **class 0** → person (mapped to `player` overlay)

COCO does **not** detect hoops — drag the green square manually during calibration until `basketball_detector.tflite` is trained.

## Step 2 — Train custom basketball model

```powershell
python scripts/extract_youtube_frames.py "https://www.youtube.com/watch?v=..." --start 922
# Label in Roboflow: ball, hoop, player
python scripts/train_model.py
```

Then in `src/models/modelSource.ts` set:

```typescript
export const ACTIVE_MODEL_KIND: ActiveModelKind = 'basketball';
```

## Local Android build (Windows)

```powershell
npm install
npx expo prebuild --platform android --clean
npx expo run:android
```

Requires Android Studio + JDK 17 + `ANDROID_HOME` set.

## Classes (custom model)

| Index | Class |
|-------|-------|
| 0 | ball |
| 1 | hoop |
| 2 | ballInBasket |
| 3 | player |

Input: 320×320 RGB uint8. Inference every 3rd frame (~10 FPS on mid devices).
