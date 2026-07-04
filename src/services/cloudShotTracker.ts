import type {
  CloudShotEvent,
  CloudShotPhase,
  DetectShotResponse,
} from '@/src/services/detectShotService';

export interface CloudShotHistoryEntry {
  shotPhase: CloudShotPhase;
  event: CloudShotEvent;
  confidence: number;
  timestamp: number;
  shotActive?: boolean;
}

const HISTORY_WINDOW_MS = 12_000;
const MAX_HISTORY = 16;
const MIN_COUNT_CONFIDENCE = 0.32;

function isMadeOrMissed(event: CloudShotEvent): boolean {
  return event === 'shot_made' || event === 'shot_missed';
}

function inferShotEventFromContext(
  result: DetectShotResponse,
  recent: CloudShotHistoryEntry[]
): CloudShotEvent | null {
  if (isMadeOrMissed(result.event)) {
    return result.event;
  }

  const observation = result.observation.toLowerCase();
  const hadAttempt = recent.some(
    (entry) => entry.shotPhase === 'attempt' || entry.shotActive
  );

  if (/miss|rim out|airball|blocked|החטיא|החמצ|לא נכנס|יצא/.test(observation)) {
    return 'shot_missed';
  }
  if (/made|swish|through|net|score|נכנס|פגיעה|הלך פנימה/.test(observation)) {
    return 'shot_made';
  }

  if (
    (hadAttempt || result.shotActive || result.shotPhase === 'outcome') &&
    result.shotPhase === 'outcome'
  ) {
    return null;
  }

  return null;
}

export function shouldEnterShotWatch(result: DetectShotResponse): boolean {
  return result.hoopVisible && (result.ballVisible || result.shotActive === true);
}

export function shouldUseOutcomeMode(
  result: DetectShotResponse,
  watchActive: boolean
): boolean {
  if (!watchActive) {
    return false;
  }

  return (
    result.ballVisible ||
    result.shotActive === true ||
    result.shotPhase === 'attempt' ||
    result.shotPhase === 'outcome' ||
    result.zone === 'free_throw'
  );
}

export function shouldCountCloudShot(
  result: DetectShotResponse,
  history: CloudShotHistoryEntry[],
  confidenceThreshold: number
): boolean {
  if (!result.hoopVisible) {
    return false;
  }

  const now = Date.now();
  const recent = history.filter((entry) => now - entry.timestamp <= HISTORY_WINDOW_MS);
  const inferredEvent = inferShotEventFromContext(result, recent);
  const effectiveEvent =
    result.event === 'no_shot' && inferredEvent ? inferredEvent : result.event;

  if (!isMadeOrMissed(effectiveEvent)) {
    return false;
  }

  const countThreshold = Math.min(confidenceThreshold, MIN_COUNT_CONFIDENCE);
  const effectiveConfidence =
    result.event === 'no_shot' && inferredEvent
      ? Math.max(result.confidence, 0.58)
      : result.confidence;

  if (effectiveConfidence < countThreshold) {
    return false;
  }

  const hasShotContext =
    result.ballVisible ||
    result.shotActive ||
    result.shotPhase === 'attempt' ||
    result.shotPhase === 'outcome' ||
    recent.some((entry) => entry.shotPhase === 'attempt' || entry.shotActive);

  return hasShotContext;
}

export function resolveCountedShotEvent(
  result: DetectShotResponse,
  history: CloudShotHistoryEntry[]
): DetectShotResponse {
  const now = Date.now();
  const recent = history.filter((entry) => now - entry.timestamp <= HISTORY_WINDOW_MS);
  const inferredEvent = inferShotEventFromContext(result, recent);

  if (result.event !== 'no_shot' || !inferredEvent) {
    return result;
  }

  return {
    ...result,
    event: inferredEvent,
    confidence: Math.max(result.confidence, 0.58),
    shotPhase: result.shotPhase === 'idle' ? 'outcome' : result.shotPhase,
    shotActive: true,
  };
}

export function toHistoryEntry(
  result: DetectShotResponse,
  timestamp = Date.now()
): CloudShotHistoryEntry {
  return {
    shotPhase: result.shotPhase,
    event: result.event,
    confidence: result.confidence,
    timestamp,
    shotActive: result.shotActive,
  };
}

export function pushCloudShotHistory(
  history: CloudShotHistoryEntry[],
  entry: CloudShotHistoryEntry
): CloudShotHistoryEntry[] {
  const next = [...history, entry];
  if (next.length > MAX_HISTORY) {
    return next.slice(next.length - MAX_HISTORY);
  }
  return next;
}

export function getBurstDelayMs(watchActive: boolean): number {
  return watchActive ? 80 : 250;
}
