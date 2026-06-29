import * as FileSystem from 'expo-file-system';
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

export async function initHighlightBuffer(sessionId: string): Promise<void> {
  await FileSystem.makeDirectoryAsync(HIGHLIGHTS_DIR, { intermediates: true });
  buffer = { sessionId, clips: [], currentStreak: 0 };
}

export async function recordHighlight(
  sessionId: string,
  shot: Shot,
  made: boolean
): Promise<void> {
  if (!buffer || buffer.sessionId !== sessionId) {
    await initHighlightBuffer(sessionId);
  }

  const currentBuffer = buffer!;
  let reason: Highlight['reason'] = made ? 'made' : 'manual';

  if (made) {
    currentBuffer.currentStreak += 1;
    if (currentBuffer.currentStreak >= 3) {
      reason = 'streak';
    }
    if (
      shot.zone === 'threeLeft' ||
      shot.zone === 'threeRight' ||
      shot.zone === 'threeCenter' ||
      shot.zone === 'cornerLeft' ||
      shot.zone === 'cornerRight'
    ) {
      reason = 'longShot';
    }
  } else {
    currentBuffer.currentStreak = 0;
    return;
  }

  const highlight: Highlight = {
    id: generateId(),
    sessionId,
    shotId: shot.id,
    reason,
    timestamp: shot.timestamp,
  };

  await insertHighlight(highlight);
}

export async function saveVideoClip(
  sessionId: string,
  sourceUri: string,
  reason: Highlight['reason']
): Promise<string> {
  const filename = `${sessionId}_${Date.now()}.mp4`;
  const destPath = `${HIGHLIGHTS_DIR}${filename}`;

  await FileSystem.copyAsync({ from: sourceUri, to: destPath });

  const highlight: Highlight = {
    id: generateId(),
    sessionId,
    videoPath: destPath,
    reason,
    timestamp: Date.now(),
  };

  await insertHighlight(highlight);

  if (buffer) {
    buffer.clips.push({ path: destPath, timestamp: Date.now(), reason });
  }

  return destPath;
}

export async function getSessionHighlights(sessionId: string): Promise<Highlight[]> {
  return getHighlightsForSession(sessionId);
}

export async function compileHighlightReel(sessionId: string): Promise<string | null> {
  const highlights = await getHighlightsForSession(sessionId);
  const withVideo = highlights.filter((h) => h.videoPath);

  if (withVideo.length === 0) {
    return null;
  }

  const reelPath = `${HIGHLIGHTS_DIR}${sessionId}_reel.json`;
  const manifest = {
    sessionId,
    clips: withVideo.map((h) => ({
      path: h.videoPath,
      reason: h.reason,
      timestamp: h.timestamp,
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
  return highlights.filter((h) => h.videoPath).map((h) => h.videoPath!);
}
