export type CourtZone =
  | 'paint'
  | 'midLeft'
  | 'midRight'
  | 'midCenter'
  | 'threeLeft'
  | 'threeRight'
  | 'threeCenter'
  | 'cornerLeft'
  | 'cornerRight';

export interface Point2D {
  x: number;
  y: number;
}

export interface CourtCalibration {
  points: Point2D[];
  calibratedAt: number;
}

export interface Session {
  id: string;
  startedAt: number;
  endedAt?: number;
  durationSeconds?: number;
  totalShots: number;
  madeShots: number;
  xpEarned: number;
}

export interface Shot {
  id: string;
  sessionId: string;
  made: boolean;
  zone: CourtZone;
  timestamp: number;
  x?: number;
  y?: number;
}

export interface Highlight {
  id: string;
  sessionId: string;
  shotId?: string;
  videoPath?: string;
  reason: 'made' | 'streak' | 'longShot' | 'manual';
  timestamp: number;
}

export interface SessionStats {
  totalShots: number;
  madeShots: number;
  fgPercent: number;
  currentStreak: number;
  bestStreak: number;
  zoneStats: Record<CourtZone, { made: number; missed: number }>;
  shotsByTime: { timestamp: number; fgPercent: number }[];
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Badge {
  id: string;
  nameKey: string;
  descKey: string;
  earnedAt?: number;
  icon: string;
}

export interface UserProfile {
  name: string;
  totalXp: number;
  onboardingComplete: boolean;
  courtCalibration?: CourtCalibration;
  confidenceThreshold: number;
}

export interface DetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  classId: DetectionClass;
}

export type DetectionClass = 'ball' | 'hoop' | 'ballInBasket' | 'player';

export interface ShotEvent {
  made: boolean;
  zone: CourtZone;
  position: Point2D;
  timestamp: number;
  confidence: number;
}
