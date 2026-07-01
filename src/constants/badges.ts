export const BADGE_DISPLAY_NAMES: Record<string, string> = {
  rookie: 'rookie',
  sniper: 'sniper',
  marathon: 'marathon',
  sharpshooter: 'sharpshooter',
};

export function getBadgeDisplayName(badgeId: string): string {
  return BADGE_DISPLAY_NAMES[badgeId] ?? badgeId;
}
