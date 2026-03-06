import { SupabaseClient } from '@supabase/supabase-js';

const DEV_USER_ID = '00000000-0000-0000-0000-000000000000';
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
 * Returns `{ user_id: user.id }` when auth is active, or `{}` when skipped.
 * Spread into insert objects: `.insert({ ...data, ...userIdField(user) })`
 */
export function userIdField(user: { id: string }) {
  if (SKIP_AUTH) return {};
  return { user_id: user.id };
}
