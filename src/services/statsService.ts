import type { CourtZone, SessionStats, Shot } from '@/src/types';
import { createEmptyZoneStats } from './sessionService';

export class StatsService {
  private shots: Shot[] = [];
  private currentStreak = 0;
  private bestStreak = 0;
  private zoneStats = createEmptyZoneStats();
  private sessionStartTime = Date.now();

  reset(): void {
    this.shots = [];
    this.currentStreak = 0;
    this.bestStreak = 0;
    this.zoneStats = createEmptyZoneStats();
    this.sessionStartTime = Date.now();
  }

  addShot(shot: Shot): SessionStats {
    this.shots.push(shot);

    if (shot.made) {
      this.currentStreak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.currentStreak);
      this.zoneStats[shot.zone].made += 1;
    } else {
      this.currentStreak = 0;
      this.zoneStats[shot.zone].missed += 1;
    }

    return this.getStats();
  }

  getStats(): SessionStats {
    const madeShots = this.shots.filter((s) => s.made).length;
    const totalShots = this.shots.length;
    const fgPercent = totalShots > 0 ? Math.round((madeShots / totalShots) * 100) : 0;

    return {
      totalShots,
      madeShots,
      fgPercent,
      currentStreak: this.currentStreak,
      bestStreak: this.bestStreak,
      zoneStats: { ...this.zoneStats },
      shotsByTime: this.computeShotsByTime(),
    };
  }

  private computeShotsByTime(): { timestamp: number; fgPercent: number }[] {
    const buckets: { timestamp: number; fgPercent: number }[] = [];
    const windowMs = 5 * 60 * 1000;
    const start = this.sessionStartTime;

    for (let t = start; t <= Date.now(); t += windowMs) {
      const windowShots = this.shots.filter(
        (s) => s.timestamp >= t && s.timestamp < t + windowMs
      );
      if (windowShots.length === 0) continue;
      const made = windowShots.filter((s) => s.made).length;
      buckets.push({
        timestamp: t,
        fgPercent: Math.round((made / windowShots.length) * 100),
      });
    }

    return buckets;
  }

  getShots(): Shot[] {
    return [...this.shots];
  }

  getBestStreak(): number {
    return this.bestStreak;
  }

  getCurrentStreak(): number {
    return this.currentStreak;
  }
}

export const statsService = new StatsService();

export function computeFgPercent(made: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((made / total) * 100);
}

export function getZoneLabel(zone: CourtZone): string {
  const labels: Record<CourtZone, string> = {
    paint: 'צבע',
    midLeft: 'אמצע שמאל',
    midRight: 'אמצע ימין',
    midCenter: 'אמצע',
    threeLeft: 'שלוש שמאל',
    threeRight: 'שלוש ימין',
    threeCenter: 'שלוש מרכז',
    cornerLeft: 'פינה שמאל',
    cornerRight: 'פינה ימין',
  };
  return labels[zone];
}

export function getWeakestZones(
  zoneStats: Record<CourtZone, { made: number; missed: number }>,
  count = 2
): CourtZone[] {
  return Object.entries(zoneStats)
    .map(([zone, stats]) => {
      const total = stats.made + stats.missed;
      const fg = total > 0 ? stats.made / total : 1;
      return { zone: zone as CourtZone, fg, total };
    })
    .filter((z) => z.total >= 2)
    .sort((a, b) => a.fg - b.fg)
    .slice(0, count)
    .map((z) => z.zone);
}

export function getStrongestZone(
  zoneStats: Record<CourtZone, { made: number; missed: number }>
): CourtZone | null {
  const sorted = Object.entries(zoneStats)
    .map(([zone, stats]) => {
      const total = stats.made + stats.missed;
      const fg = total > 0 ? stats.made / total : 0;
      return { zone: zone as CourtZone, fg, total };
    })
    .filter((z) => z.total >= 2)
    .sort((a, b) => b.fg - a.fg);

  return sorted[0]?.zone ?? null;
}
