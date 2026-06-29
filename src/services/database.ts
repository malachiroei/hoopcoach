import * as SQLite from 'expo-sqlite';
import type { CourtCalibration, Highlight, Session, Shot, UserProfile } from '@/src/types';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('hoopcoach.db');
    await initSchema(db);
  }
  return db;
}

async function initSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      duration_seconds INTEGER DEFAULT 0,
      total_shots INTEGER DEFAULT 0,
      made_shots INTEGER DEFAULT 0,
      xp_earned INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shots (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      made INTEGER NOT NULL,
      zone TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      x REAL,
      y REAL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS highlights (
      id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      shot_id TEXT,
      video_path TEXT,
      reason TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );

    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT DEFAULT 'שחקן',
      total_xp INTEGER DEFAULT 0,
      onboarding_complete INTEGER DEFAULT 0,
      court_calibration TEXT,
      confidence_threshold REAL DEFAULT 0.5
    );

    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY NOT NULL,
      earned_at INTEGER NOT NULL
    );

    INSERT OR IGNORE INTO user_profile (id) VALUES (1);
  `);
}

export async function getUserProfile(): Promise<UserProfile> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    name: string;
    total_xp: number;
    onboarding_complete: number;
    court_calibration: string | null;
    confidence_threshold: number;
  }>('SELECT * FROM user_profile WHERE id = 1');

  return {
    name: row?.name ?? 'שחקן',
    totalXp: row?.total_xp ?? 0,
    onboardingComplete: (row?.onboarding_complete ?? 0) === 1,
    courtCalibration: row?.court_calibration
      ? (JSON.parse(row.court_calibration) as CourtCalibration)
      : undefined,
    confidenceThreshold: row?.confidence_threshold ?? 0.5,
  };
}

export async function updateUserProfile(updates: Partial<UserProfile>): Promise<void> {
  const database = await getDatabase();
  const current = await getUserProfile();

  await database.runAsync(
    `UPDATE user_profile SET
      name = ?,
      total_xp = ?,
      onboarding_complete = ?,
      court_calibration = ?,
      confidence_threshold = ?
    WHERE id = 1`,
    updates.name ?? current.name,
    updates.totalXp ?? current.totalXp,
    (updates.onboardingComplete ?? current.onboardingComplete) ? 1 : 0,
    updates.courtCalibration
      ? JSON.stringify(updates.courtCalibration)
      : current.courtCalibration
        ? JSON.stringify(current.courtCalibration)
        : null,
    updates.confidenceThreshold ?? current.confidenceThreshold
  );
}

export async function insertSession(session: Session): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO sessions (id, started_at, ended_at, duration_seconds, total_shots, made_shots, xp_earned)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    session.id,
    session.startedAt,
    session.endedAt ?? null,
    session.durationSeconds ?? 0,
    session.totalShots,
    session.madeShots,
    session.xpEarned
  );
}

export async function updateSession(session: Session): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE sessions SET
      ended_at = ?,
      duration_seconds = ?,
      total_shots = ?,
      made_shots = ?,
      xp_earned = ?
    WHERE id = ?`,
    session.endedAt ?? null,
    session.durationSeconds ?? 0,
    session.totalShots,
    session.madeShots,
    session.xpEarned,
    session.id
  );
}

export async function getSession(id: string): Promise<Session | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    id: string;
    started_at: number;
    ended_at: number | null;
    duration_seconds: number;
    total_shots: number;
    made_shots: number;
    xp_earned: number;
  }>('SELECT * FROM sessions WHERE id = ?', id);

  if (!row) return null;
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

export async function getAllSessions(): Promise<Session[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    started_at: number;
    ended_at: number | null;
    duration_seconds: number;
    total_shots: number;
    made_shots: number;
    xp_earned: number;
  }>('SELECT * FROM sessions ORDER BY started_at DESC');

  return rows.map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    durationSeconds: row.duration_seconds,
    totalShots: row.total_shots,
    madeShots: row.made_shots,
    xpEarned: row.xp_earned,
  }));
}

export async function insertShot(shot: Shot): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO shots (id, session_id, made, zone, timestamp, x, y)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    shot.id,
    shot.sessionId,
    shot.made ? 1 : 0,
    shot.zone,
    shot.timestamp,
    shot.x ?? null,
    shot.y ?? null
  );
}

export async function getShotsForSession(sessionId: string): Promise<Shot[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    session_id: string;
    made: number;
    zone: string;
    timestamp: number;
    x: number | null;
    y: number | null;
  }>('SELECT * FROM shots WHERE session_id = ? ORDER BY timestamp ASC', sessionId);

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    made: row.made === 1,
    zone: row.zone as Shot['zone'],
    timestamp: row.timestamp,
    x: row.x ?? undefined,
    y: row.y ?? undefined,
  }));
}

export async function insertHighlight(highlight: Highlight): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO highlights (id, session_id, shot_id, video_path, reason, timestamp)
     VALUES (?, ?, ?, ?, ?, ?)`,
    highlight.id,
    highlight.sessionId,
    highlight.shotId ?? null,
    highlight.videoPath ?? null,
    highlight.reason,
    highlight.timestamp
  );
}

export async function getHighlightsForSession(sessionId: string): Promise<Highlight[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    session_id: string;
    shot_id: string | null;
    video_path: string | null;
    reason: string;
    timestamp: number;
  }>('SELECT * FROM highlights WHERE session_id = ? ORDER BY timestamp ASC', sessionId);

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    shotId: row.shot_id ?? undefined,
    videoPath: row.video_path ?? undefined,
    reason: row.reason as Highlight['reason'],
    timestamp: row.timestamp,
  }));
}

export async function earnBadge(badgeId: string): Promise<boolean> {
  const database = await getDatabase();
  const existing = await database.getFirstAsync('SELECT id FROM badges WHERE id = ?', badgeId);
  if (existing) return false;

  await database.runAsync('INSERT INTO badges (id, earned_at) VALUES (?, ?)', badgeId, Date.now());
  return true;
}

export async function getEarnedBadges(): Promise<string[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ id: string }>('SELECT id FROM badges');
  return rows.map((r) => r.id);
}
