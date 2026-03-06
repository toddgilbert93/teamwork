import { SupabaseClient } from '@supabase/supabase-js';

const DEV_USER_ID = '84549948-8e00-4d92-abbd-c664fe4e14b0';
export const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';

/**
 * Returns the authenticated user, or a mock dev user when NEXT_PUBLIC_SKIP_AUTH=true.
 */
export async function getAuthUser(supabase: SupabaseClient) {
  if (SKIP_AUTH) {
    return { id: DEV_USER_ID, email: 'dev@localhost' };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/**
 * Returns `{ user_id: user.id }` for spreading into insert objects.
 * Always sets user_id — even in skip-auth mode (uses DEV_USER_ID).
 */
export function userIdField(user: { id: string }) {
  return { user_id: user.id };
}
