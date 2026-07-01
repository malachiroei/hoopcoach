let modelAsset: number | null = null;
let bundleError: string | null = null;

try {
  modelAsset = require('./basketball_detector.tflite');
} catch (error) {
  console.error('TFLITE_LOAD_ERROR:', error);
  bundleError =
    error instanceof Error ? error.message : 'basketball_detector.tflite is not in the Metro bundle';
}

/** Metro asset id when the .tflite file is bundled; null if require failed. */
export const BASKETBALL_DETECTOR_MODEL: number | null = modelAsset;

/** Set when Metro cannot resolve/register the model asset (e.g. dev client needs rebuild). */
export const MODEL_BUNDLE_ERROR: string | null = bundleError;

export function isModelAssetBundled(): boolean {
  return modelAsset != null;
}

/**
 * Explicit opt-in for simulated shot detection. Never inferred from a missing model file.
 * Toggle at runtime via the dev mock control on the live session screen.
 */
export const ENABLE_MOCK_DETECTION = false;
