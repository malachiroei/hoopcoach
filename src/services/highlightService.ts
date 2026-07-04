import * as FileSystem from 'expo-file-system/legacy';
import type { CameraView } from 'expo-camera';
import { generateId } from '@/src/utils/id';
import type { Highlight, Shot } from '@/src/types';
import { insertHighlight, getHighlightsForSession } from './database';

const HIGHLIGHTS_DIR = `${FileSystem.documentDirectory}highlights/`;

interface ClipBuffer {
  sessionId: string;
  clips: { path: string; timestamp: number; reason: Highlight['reason'] }[];
  currentStreak: number;
}

let buffer: ClipBuffer | null = null;

async function persistHighlightVideo(sessionId: string, sourceUri: string): Promise<string> {
  const filename = `${sessionId}_${Date.now()}.mp4`;
  const destPath = `${HIGHLIGHTS_DIR}${filename}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destPath });
  const info = await FileSystem.getInfoAsync(destPath);
  if (!info.exists) {
    throw new Error('Highlight video file was not saved');
  }
  return normalizeFileUri(destPath);
}

function normalizeFileUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`;
}

export async function filterPlayableHighlights(highlights: Highlight[]): Promise<Highlight[]> {
  const playable: Highlight[] = [];

  for (const highlight of highlights) {
    if (!highlight.videoPath) {
      continue;
    }

    const uri = normalizeFileUri(highlight.videoPath);
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        playable.push({ ...highlight, videoPath: uri });
      }
    } catch {
      // skip missing files
    }
  }

  return playable.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getShareableHighlightUri(sessionId: string): Promise<string | null> {
  const highlights = await getHighlightsForSession(sessionId);
  const playable = await filterPlayableHighlights(highlights);
  return playable[0]?.videoPath ?? null;
}

function resolveHighlightReason(shot: Shot, made: boolean, streak: number): Highlight['reason'] | null {
  if (!made) {
    return null;
  }

  if (streak >= 3) {
    return 'streak';
  }

  if (
    shot.zone === 'threeLeft' ||
    shot.zone === 'threeRight' ||
    shot.zone === 'threeCenter' ||
    shot.zone === 'cornerLeft' ||
    shot.zone === 'cornerRight'
  ) {
    return 'longShot';
  }

  return 'made';
}

export async function initHighlightBuffer(sessionId: string): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(HIGHLIGHTS_DIR, { intermediates: true });
  } catch (error) {
    console.warn('Highlight buffer directory init skipped:', error);
  }
  buffer = { sessionId, clips: [], currentStreak: 0 };
}

export async function saveManualHighlight(
  sessionId: string,
  sourceVideoUri: string,
): Promise<Highlight | null> {
  if (!sourceVideoUri) {
    return null;
  }

  if (!buffer || buffer.sessionId !== sessionId) {
    await initHighlightBuffer(sessionId);
  }

  let videoPath: string | undefined;
  try {
    videoPath = await persistHighlightVideo(sessionId, sourceVideoUri);
  } catch (error) {
    console.warn('Failed to persist manual highlight:', error);
    return null;
  }

  const highlight: Highlight = {
    id: generateId(),
    sessionId,
    videoPath,
    reason: 'manual',
    timestamp: Date.now(),
  };

  await insertHighlight(highlight);
  buffer!.clips.push({ path: videoPath, timestamp: highlight.timestamp, reason: 'manual' });
  return highlight;
}

export async function recordHighlight(
  sessionId: string,
  shot: Shot,
  made: boolean,
  sourceVideoUri?: string
): Promise<Highlight | null> {
  if (!buffer || buffer.sessionId !== sessionId) {
    await initHighlightBuffer(sessionId);
  }

  const currentBuffer = buffer!;
  const reason = resolveHighlightReason(shot, made, made ? currentBuffer.currentStreak + 1 : 0);

  if (made) {
    currentBuffer.currentStreak += 1;
  } else {
    currentBuffer.currentStreak = 0;
    return null;
  }

  if (!reason) {
    return null;
  }

  if (!sourceVideoUri) {
    return null;
  }

  let videoPath: string | undefined;
  try {
    videoPath = await persistHighlightVideo(sessionId, sourceVideoUri);
  } catch (error) {
    console.warn('Failed to persist highlight video:', error);
    return null;
  }

  const highlight: Highlight = {
    id: generateId(),
    sessionId,
    shotId: shot.id,
    videoPath,
    reason,
    timestamp: shot.timestamp,
  };

  await insertHighlight(highlight);

  if (videoPath) {
    currentBuffer.clips.push({ path: videoPath, timestamp: shot.timestamp, reason });
  }

  return highlight;
}

export async function saveVideoClip(
  sessionId: string,
  sourceUri: string,
  reason: Highlight['reason']
): Promise<string> {
  const destPath = await persistHighlightVideo(sessionId, sourceUri);

  if (buffer && buffer.sessionId === sessionId) {
    buffer.clips.push({ path: destPath, timestamp: Date.now(), reason });
  }

  return destPath;
}

export async function getSessionHighlights(sessionId: string): Promise<Highlight[]> {
  return getHighlightsForSession(sessionId);
}

export async function compileHighlightReel(sessionId: string): Promise<string | null> {
  const highlights = await getHighlightsForSession(sessionId);
  const withVideo = highlights
    .filter((highlight) => highlight.videoPath)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (withVideo.length === 0) {
    return null;
  }

  const reelPath = `${HIGHLIGHTS_DIR}${sessionId}_reel.json`;
  const manifest = {
    sessionId,
    title: 'היילייטס האימון',
    clips: withVideo.map((highlight) => ({
      path: highlight.videoPath,
      reason: highlight.reason,
      timestamp: highlight.timestamp,
      shotId: highlight.shotId,
    })),
    createdAt: Date.now(),
  };

  await FileSystem.writeAsStringAsync(reelPath, JSON.stringify(manifest));
  return reelPath;
}

export function clearHighlightBuffer(): void {
  buffer = null;
}

export async function getHighlightClipPaths(sessionId: string): Promise<string[]> {
  const highlights = await getHighlightsForSession(sessionId);
  return highlights.filter((highlight) => highlight.videoPath).map((highlight) => highlight.videoPath!);
}

export async function stopHighlightRecording(
  cameraRef: React.RefObject<CameraView | null>,
  recordingPromiseRef: React.MutableRefObject<Promise<{ uri: string } | undefined> | null>,
  isRecordingRef: React.MutableRefObject<boolean>
): Promise<void> {
  if (!isRecordingRef.current || !recordingPromiseRef.current) {
    return;
  }

  try {
    cameraRef.current?.stopRecording();
    await recordingPromiseRef.current;
  } catch {
    // ignore cleanup errors
  } finally {
    isRecordingRef.current = false;
    recordingPromiseRef.current = null;
  }
}
