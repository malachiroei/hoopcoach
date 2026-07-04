import type { CloudNormalizedBox, DetectShotResponse } from '@/src/services/detectShotService';

function isCalibratedBox(box: CloudNormalizedBox | null | undefined): boolean {
  return Boolean(box && box.confidence >= 0.99);
}

export function filterCloudDetection(result: DetectShotResponse): DetectShotResponse {
  const players = result.players ?? [];
  let ballBox = result.ballBox ?? null;
  let hoopBox = result.hoopBox ?? null;

  if (ballBox && isCalibratedBox(ballBox)) {
    ballBox = null;
  }
  if (hoopBox && isCalibratedBox(hoopBox)) {
    hoopBox = null;
  }

  if (ballBox && (ballBox.width > 0.3 || ballBox.height > 0.3)) {
    ballBox = null;
  }

  return {
    ...result,
    ballBox,
    hoopBox,
    ballVisible: Boolean(ballBox),
    hoopVisible: Boolean(hoopBox),
    players,
  };
}

/** No smoothing — show raw positions for responsive tracking. */
export function smoothCloudDetection(
  _previous: DetectShotResponse | null,
  next: DetectShotResponse,
): DetectShotResponse {
  return next;
}

export function toFriendlyDetectError(message: string): string | null {
  if (
    message.includes('Failed to capture') ||
    message.includes('not ready') ||
    message.includes('recording') ||
    message.includes('no base64')
  ) {
    return null;
  }

  if (
    message.includes('429') ||
    message.includes('quota') ||
    message.includes('מכסת') ||
    message.includes('free_tier')
  ) {
    return 'זיהוי מושהה — ממשיכים לנסות';
  }

  if (
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('fetch') ||
    message.toLowerCase().includes('timeout')
  ) {
    return 'חיבור אינטרנט חלש — מנסים שוב';
  }

  if (
    message.includes('detect-shot') ||
    message.includes('GEMINI') ||
    message.includes('FunctionsHttpError')
  ) {
    return 'זיהוי זמנית לא זמין — ממשיכים לנסות';
  }

  return null;
}
