/**
 * Create a dedicated dev user in Supabase auth.
 * The seed trigger will auto-create 6 default personas for this user.
 *
 * Usage:  node scripts/create-dev-user.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load env
const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [key, ...rest] = trimmed.split('=');
  env[key.trim()] = rest.join('=').trim();
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const DEV_EMAIL = 'dev@polyphony.local';

async function main() {
  console.log('Creating dev user...\n');

  // Check if dev user already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(u => u.email === DEV_EMAIL);

  if (existing) {
    console.log(`  Dev user already exists: ${existing.id}`);
    console.log(`  Email: ${existing.email}`);
    printNextSteps(existing.id);
    return;
  }

  // Create new dev user
  const { data, error } = await supabase.auth.admin.createUser({
    email: DEV_EMAIL,
    email_confirm: true,
    user_metadata: { name: 'Dev User' },
  });

  if (error) {
    console.error('  Failed to create dev user:', error.message);
    process.exit(1);
  }

  console.log(`  Created dev user: ${data.user.id}`);
  console.log(`  Email: ${data.user.email}`);

  // Verify personas were seeded by the trigger
  const { data: personas } = await supabase
    .from('personas')
    .select('name')
    .eq('user_id', data.user.id);

  console.log(`  Personas seeded: ${personas?.length ?? 0}`);

  printNextSteps(data.user.id);
}

function printNextSteps(userId) {
  console.log('\n  ──────────────────────────────────────────');
  console.log(`  Update DEV_USER_ID in src/lib/auth.ts to:`);
  console.log(`  const DEV_USER_ID = '${userId}';`);
  console.log('  ──────────────────────────────────────────\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
