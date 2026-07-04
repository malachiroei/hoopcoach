import { generateId } from '@/src/utils/id';
import type { CourtZone, Session, Shot, ShotEvent } from '@/src/types';
import {
  getSession,
  insertSession,
  insertShot,
  updateSession,
  updateUserProfile,
  getUserProfile,
} from './database';
import { recordHighlight, compileHighlightReel } from './highlightService';
import { calculateXp, checkAndAwardBadges } from './gamificationService';

let activeSession: Session | null = null;
let sessionStartTime: number | null = null;

export function getActiveSession(): Session | null {
  return activeSession;
}

export async function startSession(): Promise<Session> {
  const session: Session = {
    id: generateId(),
    startedAt: Date.now(),
    totalShots: 0,
    madeShots: 0,
    xpEarned: 0,
  };

  await insertSession(session);
  activeSession = session;
  sessionStartTime = Date.now();
  return session;
}

export async function recordShotEvent(
  event: ShotEvent,
  sourceVideoUri?: string
): Promise<Shot | null> {
  if (!activeSession) return null;

  const shot: Shot = {
    id: generateId(),
    sessionId: activeSession.id,
    made: event.made,
    zone: event.zone,
    timestamp: event.timestamp,
    x: event.position.x,
    y: event.position.y,
  };

  await insertShot(shot);

  activeSession.totalShots += 1;
  if (event.made) activeSession.madeShots += 1;

  await updateSession(activeSession);
  await recordHighlight(activeSession.id, shot, event.made, sourceVideoUri);

  return shot;
}

export async function endSession(
  stats: { currentStreak: number; bestStreak: number; fgPercent: number }
): Promise<Session | null> {
  if (!activeSession || !sessionStartTime) return null;

  const endedAt = Date.now();
  const durationSeconds = Math.floor((endedAt - sessionStartTime) / 1000);

  const xp = calculateXp({
    totalShots: activeSession.totalShots,
    madeShots: activeSession.madeShots,
    durationSeconds,
    bestStreak: stats.bestStreak,
  });

  activeSession.endedAt = endedAt;
  activeSession.durationSeconds = durationSeconds;
  activeSession.xpEarned = xp;

  await updateSession(activeSession);

  const profile = await getUserProfile();
  await updateUserProfile({ totalXp: profile.totalXp + xp });

  try {
    await checkAndAwardBadges({
      session: activeSession,
      bestStreak: stats.bestStreak,
      fgPercent: stats.fgPercent,
    });
  } catch (error) {
    console.warn('Session saved; badge step failed:', error);
  }

  try {
    await compileHighlightReel(activeSession.id);
  } catch (error) {
    console.warn('Highlight reel compile failed:', error);
  }

  const completed = { ...activeSession };
  activeSession = null;
  sessionStartTime = null;
  return completed;
}

export async function loadSession(sessionId: string): Promise<Session | null> {
  return getSession(sessionId);
}

export function getSessionDuration(): number {
  if (!sessionStartTime) return 0;
  return Math.floor((Date.now() - sessionStartTime) / 1000);
}

export const COURT_ZONES: CourtZone[] = [
  'paint',
  'midLeft',
  'midRight',
  'midCenter',
  'threeLeft',
  'threeRight',
  'threeCenter',
  'cornerLeft',
  'cornerRight',
];

export function createEmptyZoneStats(): Record<CourtZone, { made: number; missed: number }> {
  return COURT_ZONES.reduce(
    (acc, zone) => {
      acc[zone] = { made: 0, missed: 0 };
      return acc;
    },
    {} as Record<CourtZone, { made: number; missed: number }>
  );
}
