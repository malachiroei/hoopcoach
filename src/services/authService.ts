import { isSupabaseConfigured, supabase } from '@/src/lib/supabase';

let cachedUserId: string | null = null;

export async function ensureAuthenticated(): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }

  if (cachedUserId) {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user?.id === cachedUserId) {
      return cachedUserId;
    }
    cachedUserId = null;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id) {
    cachedUserId = sessionData.session.user.id;
    await ensureProfileRow(cachedUserId);
    return cachedUserId;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user?.id) {
    throw new Error(error?.message ?? 'Anonymous sign-in failed');
  }

  cachedUserId = data.user.id;
  await ensureProfileRow(cachedUserId);
  return cachedUserId;
}

async function ensureProfileRow(userId: string): Promise<void> {
  const { data } = await supabase.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (data) return;

  await supabase.from('profiles').insert({ id: userId });
}
