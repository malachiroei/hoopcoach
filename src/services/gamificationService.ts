import type { Badge, Session } from '@/src/types';
import { earnBadge, getEarnedBadges } from './database';

export const ALL_BADGES: Badge[] = [
  { id: 'rookie', nameKey: 'badges.rookie', descKey: 'badges.rookieDesc', icon: '🏀' },
  { id: 'sniper', nameKey: 'badges.sniper', descKey: 'badges.sniperDesc', icon: '🎯' },
  { id: 'marathon', nameKey: 'badges.marathon', descKey: 'badges.marathonDesc', icon: '⏱️' },
  { id: 'sharpshooter', nameKey: 'badges.sharpshooter', descKey: 'badges.sharpshooterDesc', icon: '🔥' },
];

export function calculateXp(params: {
  totalShots: number;
  madeShots: number;
  durationSeconds: number;
  bestStreak: number;
}): number {
  const { totalShots, madeShots, durationSeconds, bestStreak } = params;

  let xp = totalShots * 5;
  xp += madeShots * 10;
  xp += Math.floor(durationSeconds / 60) * 15;
  xp += bestStreak * 20;

  return xp;
}

export async function checkAndAwardBadges(params: {
  session: Session;
  bestStreak: number;
  fgPercent: number;
}): Promise<string[]> {
  const { session, bestStreak, fgPercent } = params;
  const newlyEarned: string[] = [];

  if (await earnBadge('rookie')) newlyEarned.push('rookie');

  if (bestStreak >= 10 && (await earnBadge('sniper'))) {
    newlyEarned.push('sniper');
  }

  if (
    (session.durationSeconds ?? 0) >= 3600 &&
    (await earnBadge('marathon'))
  ) {
    newlyEarned.push('marathon');
  }

  if (fgPercent >= 80 && session.totalShots >= 10 && (await earnBadge('sharpshooter'))) {
    newlyEarned.push('sharpshooter');
  }

  return newlyEarned;
}

export async function getBadgesWithStatus(): Promise<Badge[]> {
  const earned = await getEarnedBadges();
  return ALL_BADGES.map((badge) => ({
    ...badge,
    earnedAt: earned.includes(badge.id) ? Date.now() : undefined,
  }));
}

export function getXpLevel(totalXp: number): { level: number; progress: number; nextLevelXp: number } {
  const xpPerLevel = 500;
  const level = Math.floor(totalXp / xpPerLevel) + 1;
  const currentLevelXp = totalXp % xpPerLevel;
  const progress = currentLevelXp / xpPerLevel;

  return { level, progress, nextLevelXp: xpPerLevel };
}
