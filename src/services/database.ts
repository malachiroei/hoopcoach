import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';
import { ensureAuthenticated } from '@/src/services/authService';
import {
  highlightRowToHighlight,
  highlightToRow,
  profileRowToUserProfile,
  sessionRowToSession,
  sessionToRow,
  shotRowToShot,
  shotToRow,
  userProfileToRowUpdates,
  type HighlightRow,
  type ProfileRow,
  type SessionRow,
  type ShotRow,
} from '@/src/services/supabaseMappers';
import { getBadgeDisplayName, BADGE_DISPLAY_NAMES } from '@/src/constants/badges';
import { generateUuid } from '@/src/utils/id';
import type { Highlight, Session, Shot, UserProfile } from '@/src/types';

/** @deprecated Use initDatabase() — kept for callers that awaited SQLite open. */
export async function getDatabase(): Promise<void> {
  await initDatabase();
}

export async function initDatabase(): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured — database operations will fail');
    return;
  }
  await ensureAuthenticated();
}

async function requireUserId(): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }
  return ensureAuthenticated();
}

export async function getUserProfile(): Promise<UserProfile> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  return profileRowToUserProfile(data as ProfileRow | null);
}

export async function updateUserProfile(updates: Partial<UserProfile>): Promise<void> {
  const userId = await requireUserId();
  const current = await getUserProfile();
  const rowUpdates = userProfileToRowUpdates(updates, current);

  const { error } = await supabase.from('profiles').update(rowUpdates).eq('id', userId);
  if (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }
}

export async function insertSession(session: Session): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('sessions').insert(sessionToRow(session, userId));

  if (error) {
    throw new Error(`Failed to insert session: ${error.message}`);
  }
}

export async function updateSession(session: Session): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('sessions')
    .update({
      ended_at: session.endedAt ?? null,
      duration_seconds: session.durationSeconds ?? 0,
      total_shots: session.totalShots,
      made_shots: session.madeShots,
      xp_earned: session.xpEarned,
    })
    .eq('id', session.id)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to update session: ${error.message}`);
  }
}

export async function getSession(id: string): Promise<Session | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load session: ${error.message}`);
  }

  return data ? sessionRowToSession(data as SessionRow) : null;
}

export async function getAllSessions(): Promise<Session[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load sessions: ${error.message}`);
  }

  return (data as SessionRow[]).map(sessionRowToSession);
}

export async function insertShot(shot: Shot): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('shots').insert(shotToRow(shot, userId));

  if (error) {
    throw new Error(`Failed to insert shot: ${error.message}`);
  }
}

export async function getShotsForSession(sessionId: string): Promise<Shot[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('shots')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('timestamp', { ascending: true });

  if (error) {
    throw new Error(`Failed to load shots: ${error.message}`);
  }

  return (data as ShotRow[]).map(shotRowToShot);
}

export async function insertHighlight(highlight: Highlight): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from('highlights').insert(highlightToRow(highlight, userId));

  if (error) {
    throw new Error(`Failed to insert highlight: ${error.message}`);
  }
}

export async function getHighlightsForSession(sessionId: string): Promise<Highlight[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('highlights')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .order('timestamp', { ascending: true });

  if (error) {
    throw new Error(`Failed to load highlights: ${error.message}`);
  }

  return (data as HighlightRow[]).map(highlightRowToHighlight);
}

export async function earnBadge(badgeId: string): Promise<boolean> {
  try {
    const userId = await requireUserId();
    const name = getBadgeDisplayName(badgeId);

    const { data: existing, error: lookupError } = await supabase
      .from('badges')
      .select('id')
      .eq('user_id', userId)
      .eq('name', name)
      .maybeSingle();

    if (lookupError) {
      console.warn(`Badge lookup skipped for ${badgeId}:`, lookupError.message);
      return false;
    }

    if (existing) return false;

    const { error } = await supabase.from('badges').insert({
      id: generateUuid(),
      user_id: userId,
      name,
      earned_at: Date.now(),
    });

    if (error) {
      console.warn(`Failed to earn badge ${badgeId}:`, error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`Badge award skipped for ${badgeId}:`, error);
    return false;
  }
}

export async function getEarnedBadges(): Promise<string[]> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabase.from('badges').select('name').eq('user_id', userId);

    if (error) {
      console.warn('Failed to load badges:', error.message);
      return [];
    }

    return (data ?? []).map((row) => {
      const name = row.name as string;
      const match = Object.entries(BADGE_DISPLAY_NAMES).find(([, label]) => label === name);
      return match?.[0] ?? name;
    });
  } catch (error) {
    console.warn('Badge load skipped:', error);
    return [];
  }
}
