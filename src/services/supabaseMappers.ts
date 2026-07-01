import type { CourtCalibration, Highlight, Session, Shot, UserProfile } from '@/src/types';

export interface ProfileRow {
  id: string;
  name: string;
  total_xp: number;
  onboarding_complete: boolean;
  court_calibration: CourtCalibration | null;
  confidence_threshold: number;
}

export interface SessionRow {
  id: string;
  user_id: string;
  started_at: number;
  ended_at: number | null;
  duration_seconds: number;
  total_shots: number;
  made_shots: number;
  xp_earned: number;
}

export interface ShotRow {
  id: string;
  session_id: string;
  user_id: string;
  made: boolean;
  zone: string;
  timestamp: number;
  x: number | null;
  y: number | null;
}

export interface HighlightRow {
  id: string;
  session_id: string;
  shot_id: string | null;
  user_id: string;
  video_path: string | null;
  reason: string;
  timestamp: number;
}

export interface BadgeRow {
  id: string;
  user_id: string;
  earned_at: number;
}

export function profileRowToUserProfile(row: ProfileRow | null | undefined): UserProfile {
  return {
    name: row?.name ?? 'שחקן',
    totalXp: row?.total_xp ?? 0,
    onboardingComplete: row?.onboarding_complete ?? false,
    courtCalibration: row?.court_calibration ?? undefined,
    confidenceThreshold: row?.confidence_threshold ?? 0.5,
  };
}

export function sessionRowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    durationSeconds: row.duration_seconds,
    totalShots: row.total_shots,
    madeShots: row.made_shots,
    xpEarned: row.xp_earned,
  };
}

export function sessionToRow(session: Session, userId: string): Omit<SessionRow, 'user_id'> & { user_id: string } {
  return {
    id: session.id,
    user_id: userId,
    started_at: session.startedAt,
    ended_at: session.endedAt ?? null,
    duration_seconds: session.durationSeconds ?? 0,
    total_shots: session.totalShots,
    made_shots: session.madeShots,
    xp_earned: session.xpEarned,
  };
}

export function shotRowToShot(row: ShotRow): Shot {
  return {
    id: row.id,
    sessionId: row.session_id,
    made: row.made,
    zone: row.zone as Shot['zone'],
    timestamp: row.timestamp,
    x: row.x ?? undefined,
    y: row.y ?? undefined,
  };
}

export function shotToRow(shot: Shot, userId: string): ShotRow {
  return {
    id: shot.id,
    session_id: shot.sessionId,
    user_id: userId,
    made: shot.made,
    zone: shot.zone,
    timestamp: shot.timestamp,
    x: shot.x ?? null,
    y: shot.y ?? null,
  };
}

export function highlightRowToHighlight(row: HighlightRow): Highlight {
  return {
    id: row.id,
    sessionId: row.session_id,
    shotId: row.shot_id ?? undefined,
    videoPath: row.video_path ?? undefined,
    reason: row.reason as Highlight['reason'],
    timestamp: row.timestamp,
  };
}

export function highlightToRow(highlight: Highlight, userId: string): HighlightRow {
  return {
    id: highlight.id,
    session_id: highlight.sessionId,
    shot_id: highlight.shotId ?? null,
    user_id: userId,
    video_path: highlight.videoPath ?? null,
    reason: highlight.reason,
    timestamp: highlight.timestamp,
  };
}

export function userProfileToRowUpdates(
  updates: Partial<UserProfile>,
  current: UserProfile
): Partial<ProfileRow> {
  return {
    name: updates.name ?? current.name,
    total_xp: updates.totalXp ?? current.totalXp,
    onboarding_complete: updates.onboardingComplete ?? current.onboardingComplete,
    court_calibration: updates.courtCalibration ?? current.courtCalibration ?? null,
    confidence_threshold: updates.confidenceThreshold ?? current.confidenceThreshold,
  };
}
