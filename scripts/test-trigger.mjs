/**
 * Test that the seed trigger works by creating and then deleting a test user.
 * Usage: node scripts/test-trigger.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = resolve(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const [key, ...rest] = trimmed.split('=');
  env[key.trim()] = rest.join('=').trim();
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const testEmail = `test-trigger-${Date.now()}@test.local`;

  console.log(`Creating test user: ${testEmail}`);
  const { data, error } = await supabase.auth.admin.createUser({
    email: testEmail,
    email_confirm: true,
  });

  if (error) {
    console.error('FAILED to create user:', error.message);
    console.error('The seed trigger is still broken.');
    process.exit(1);
  }

  const userId = data.user.id;
  console.log(`Created user: ${userId}`);

  // Check if personas were seeded
  const { data: personas } = await supabase
    .from('personas')
    .select('name, emoji, tagline')
    .eq('user_id', userId);

  console.log(`\nPersonas seeded: ${personas?.length || 0}`);
  if (personas) {
    for (const p of personas) {
      console.log(`  ${p.emoji} ${p.name} — ${p.tagline}`);
    }
  }

  // Clean up: delete personas then user
  await supabase.from('personas').delete().eq('user_id', userId);
  await supabase.auth.admin.deleteUser(userId);
  console.log('\nCleaned up test user.');

  if (personas?.length === 6) {
    console.log('\nSeed trigger is working correctly!');
  } else {
    console.error('\nSeed trigger did NOT create 6 personas.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
