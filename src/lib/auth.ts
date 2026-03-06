import { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const DEMO_USER_ID = '99e9e458-1ef5-415b-b57f-b3e0503b2560';
const DEMO_COOKIE = 'polyphony_demo';

/**
 * Check if the current request is in demo mode (cookie-based).
 */
export async function isDemoMode(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(DEMO_COOKIE)?.value === 'true';
  } catch {
    // cookies() may throw in some contexts (e.g. during build)
    return false;
  }
}

/**
 * Returns the authenticated user, or the demo user when demo cookie is set.
 */
export async function getAuthUser(supabase: SupabaseClient) {
  if (await isDemoMode()) {
    return { id: DEMO_USER_ID, email: 'demo@polyphony.local' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/**
 * Returns `{ user_id: user.id }` for spreading into insert objects.
 */
export function userIdField(user: { id: string }) {
  return { user_id: user.id };
}
