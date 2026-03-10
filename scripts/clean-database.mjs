/**
 * Clean database — wipe all pre-auth data and re-seed default personas.
 *
 * Usage:  node scripts/clean-database.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load env from .env.local ──────────────────────────────────────────
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [key, ...rest] = trimmed.split('=');
  env[key.trim()] = rest.join('=').trim();
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, key);

// ── Run cleanup ───────────────────────────────────────────────────────
async function main() {
  console.log('🧹 Resetting database — clearing all chat history & personas...\n');

  // 1. Delete all 1-on-1 messages
  const { error: msgErr } = await supabase
    .from('messages')
    .delete()
    .gte('id', '00000000-0000-0000-0000-000000000000');
  if (msgErr) {
    console.error('  ❌ Failed to delete messages:', msgErr.message);
  } else {
    console.log('  ✅ Deleted all 1-on-1 messages');
  }

  // 2. Delete all room messages
  const { error: roomErr } = await supabase
    .from('room_messages')
    .delete()
    .gte('id', '00000000-0000-0000-0000-000000000000');
  if (roomErr) {
    console.error('  ❌ Failed to delete room_messages:', roomErr.message);
  } else {
    console.log('  ✅ Deleted all room messages');
  }

  // 3. Delete all personas
  const { error: personaDelErr } = await supabase
    .from('personas')
    .delete()
    .gte('id', '00000000-0000-0000-0000-000000000000');
  if (personaDelErr) {
    console.error('  ❌ Failed to delete personas:', personaDelErr.message);
  } else {
    console.log('  ✅ Deleted all personas');
  }

  // Default personas (Sol, Mira, Rex) will be auto-seeded from
  // src/lib/default-personas.ts when each user next visits the app.

  console.log('\n✨ Database reset! Each user will get Sol, Mira & Rex on next visit.\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
