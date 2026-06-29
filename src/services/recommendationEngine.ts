import type { CourtZone, Recommendation, Session, SessionStats } from '@/src/types';
import { getZoneLabel, getStrongestZone, getWeakestZones } from './statsService';
import { getAllSessions } from './database';

export async function generateRecommendations(
  session: Session,
  stats: SessionStats
): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];
  const { zoneStats, shotsByTime, fgPercent, totalShots } = stats;

  const weakZones = getWeakestZones(zoneStats, 2);
  for (const zone of weakZones) {
    const zoneData = zoneStats[zone];
    const zoneTotal = zoneData.made + zoneData.missed;
    const zoneFg = Math.round((zoneData.made / zoneTotal) * 100);
    recommendations.push({
      id: `weak-${zone}`,
      title: `שפר ב${getZoneLabel(zone)}`,
      description: `קלעת רק ${zoneFg}% מ${getZoneLabel(zone)} (${zoneData.made}/${zoneTotal}). תתאמן על זריקות מאזור זה.`,
      priority: 'high',
    });
  }

  if (shotsByTime.length >= 2) {
    const firstHalf = shotsByTime.slice(0, Math.ceil(shotsByTime.length / 2));
    const secondHalf = shotsByTime.slice(Math.ceil(shotsByTime.length / 2));
    const firstAvg = firstHalf.reduce((s, b) => s + b.fgPercent, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, b) => s + b.fgPercent, 0) / secondHalf.length;

    if (firstAvg - secondAvg > 15) {
      recommendations.push({
        id: 'fatigue',
        title: 'שים לב לעייפות',
        description: 'בחצי השני של האימון הדיוק שלך ירד משמעותית. נסה הפסקות קצרות של 30 שניות בין סטים.',
        priority: 'medium',
      });
    }
  }

  const dominantZone = findDominantZone(zoneStats, totalShots);
  if (dominantZone && totalShots >= 10) {
    recommendations.push({
      id: 'variety',
      title: 'גוון את האימון',
      description: `יותר מ-70% מהזריקות שלך היו מ${getZoneLabel(dominantZone)}. נסה לגוון מיקומים כדי לשפר את המשחק הכולל.`,
      priority: 'medium',
    });
  }

  const strongZone = getStrongestZone(zoneStats);
  if (strongZone) {
    const zoneData = zoneStats[strongZone];
    const zoneFg = Math.round((zoneData.made / (zoneData.made + zoneData.missed)) * 100);
    if (zoneFg >= 60) {
      recommendations.push({
        id: `strong-${strongZone}`,
        title: 'האזור החזק שלך',
        description: `אתה מצטיין ב${getZoneLabel(strongZone)} עם ${zoneFg}%! תמשיך לשפר שם ובנה על החוזקה.`,
        priority: 'low',
      });
    }
  }

  const prevComparison = await compareWithPreviousSession(session, fgPercent);
  if (prevComparison) {
    recommendations.push(prevComparison);
  }

  if (recommendations.length === 0 && totalShots > 0) {
    recommendations.push({
      id: 'keep-going',
      title: 'המשך כך!',
      description: `אימון טוב עם ${fgPercent}% קליעה. המשך להתאמן באופן קבוע לשיפור מתמשך.`,
      priority: 'low',
    });
  }

  return recommendations.slice(0, 3);
}

function findDominantZone(
  zoneStats: Record<CourtZone, { made: number; missed: number }>,
  totalShots: number
): CourtZone | null {
  let maxZone: CourtZone | null = null;
  let maxCount = 0;

  for (const [zone, stats] of Object.entries(zoneStats)) {
    const count = stats.made + stats.missed;
    if (count > maxCount) {
      maxCount = count;
      maxZone = zone as CourtZone;
    }
  }

  if (maxZone && maxCount / totalShots > 0.7) return maxZone;
  return null;
}

async function compareWithPreviousSession(
  current: Session,
  currentFg: number
): Promise<Recommendation | null> {
  const sessions = await getAllSessions();
  const previous = sessions.find((s) => s.id !== current.id && s.totalShots > 0);

  if (!previous) return null;

  const prevFg = Math.round((previous.madeShots / previous.totalShots) * 100);
  const diff = currentFg - prevFg;

  if (diff >= 5) {
    return {
      id: 'improvement',
      title: 'שיפור מדהים!',
      description: `שיפרת ב-${diff}% לעומת האימון הקודם (${prevFg}% → ${currentFg}%). עבודה מצוינת!`,
      priority: 'low',
    };
  }

  if (diff <= -10) {
    return {
      id: 'regression',
      title: 'יום קשה? זה בסדר',
      description: `היום היה ${currentFg}% לעומת ${prevFg}% באימון הקודם. נסה להתמקד בטכניקה ולא בכמות.`,
      priority: 'medium',
    };
  }

  return null;
}
