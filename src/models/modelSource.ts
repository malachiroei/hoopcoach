let cocoAsset: number | null = null;
let basketballAsset: number | null = null;
let cocoError: string | null = null;
let basketballError: string | null = null;

try {
  cocoAsset = require('./yolov8n_coco.tflite');
} catch (error) {
  cocoError = error instanceof Error ? error.message : 'yolov8n_coco.tflite missing';
}

try {
  basketballAsset = require('./basketball_detector.tflite');
} catch (error) {
  basketballError = error instanceof Error ? error.message : 'basketball_detector.tflite missing';
}

export type ActiveModelKind = 'coco' | 'basketball';

/** Prefer COCO pre-trained model for pipeline testing; swap to basketball after training. */
export const ACTIVE_MODEL_KIND: ActiveModelKind = 'coco';

const preferredAsset = ACTIVE_MODEL_KIND === 'coco' ? cocoAsset : basketballAsset;
const fallbackAsset = ACTIVE_MODEL_KIND === 'coco' ? basketballAsset : cocoAsset;
const modelAsset = preferredAsset ?? fallbackAsset;

export const ACTIVE_MODEL_FILENAME =
  preferredAsset != null
    ? ACTIVE_MODEL_KIND === 'coco'
      ? 'yolov8n_coco.tflite'
      : 'basketball_detector.tflite'
    : fallbackAsset === basketballAsset
      ? 'basketball_detector.tflite'
      : 'yolov8n_coco.tflite';

export const ACTIVE_MODEL_KIND_RESOLVED: ActiveModelKind =
  modelAsset === basketballAsset && modelAsset != null && cocoAsset == null
    ? 'basketball'
    : modelAsset === cocoAsset && modelAsset != null
      ? 'coco'
      : ACTIVE_MODEL_KIND;

/** Metro asset id for the active TFLite model; null if missing from bundle. */
export const ACTIVE_MODEL_ASSET: number | null = modelAsset;

export const MODEL_BUNDLE_ERROR: string | null =
  modelAsset == null
    ? `Missing TFLite model. Run: python scripts/download_coco_tflite.py (${cocoError ?? ''} ${basketballError ?? ''})`
    : null;

export function isModelAssetBundled(): boolean {
  return modelAsset != null;
}

export const ENABLE_MOCK_DETECTION = false;

/** @deprecated Use ACTIVE_MODEL_ASSET */
export const BASKETBALL_DETECTOR_MODEL = basketballAsset;
