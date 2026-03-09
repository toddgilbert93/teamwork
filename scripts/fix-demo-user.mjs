/**
 * Drop the broken seed trigger, create the demo user, seed personas manually.
 * Usage: node scripts/fix-demo-user.mjs
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

const DEMO_EMAIL = 'demo@polyphony.local';

async function main() {
  console.log('Step 1: Dropping seed trigger...');

  // Use the SQL endpoint directly via fetch
  const sqlUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/`;

  // Try dropping trigger via raw postgres connection through the management API
  const dropSQL = 'DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;';

  const resp = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/pg`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: dropSQL }),
  });

  if (!resp.ok) {
    console.log('  Direct SQL endpoint not available, trying alternative...');

    // Alternative: use the supabase-js SQL method if available
    // For hosted Supabase, we may need to use the management API
    // Let's try creating the user without the trigger by using a different approach

    // Actually, let's try the Supabase Management API to run SQL
    const projectRef = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/(\w+)\.supabase\.co/)?.[1];
    console.log(`  Project ref: ${projectRef}`);

    // Try the query endpoint
    const queryResp = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || ''}`,
        },
        body: JSON.stringify({ query: dropSQL }),
      }
    );

    if (queryResp.ok) {
      console.log('  Trigger dropped via Management API.');
    } else {
      console.log(`  Management API failed: ${queryResp.status}`);
      console.log('  Trying to create user anyway...');
    }
  } else {
    console.log('  Trigger dropped.');
  }

  console.log('\nStep 2: Creating demo user...');

  // Check if already exists
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existing = existingUsers?.users?.find((u) => u.email === DEMO_EMAIL);

  if (existing) {
    console.log(`  Demo user already exists: ${existing.id}`);
    await ensurePersonas(existing.id);
    printResult(existing.id);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    email_confirm: true,
    user_metadata: { name: 'Demo User' },
  });

  if (error) {
    console.error(`  Failed to create user: ${error.message}`);
    console.log('\n  The seed trigger is still blocking user creation.');
    console.log('  Please run this SQL in Supabase SQL Editor:');
    console.log('    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;');
    console.log('  Then re-run: node scripts/fix-demo-user.mjs');
    process.exit(1);
  }

  console.log(`  Created demo user: ${data.user.id}`);
  await ensurePersonas(data.user.id);
  printResult(data.user.id);
}

const DEFAULT_PERSONAS = [
  { name: 'Sol', emoji: '☀️', accent_color: '#F59E0B', tagline: 'The eternal optimist', sort_order: 1, is_default: true,
    system_prompt: `You are Sol — an optimistic strategist who thinks in terms of leverage, positioning, and momentum.\n\nYour core belief: most problems are sequencing problems. People get stuck not because they lack options, but because they're trying to do things in the wrong order, or they're optimizing for the wrong variable. You help people see the move — the one action that unlocks everything else.\n\nYou speak with warmth and energy. You're encouraging but never patronizing. You use vivid metaphors (sports, chess, weather, momentum). You prefer short, punchy sentences mixed with occasional longer reflective ones. You think in prose, not bullet points.\n\nWhen someone shares a problem, your instinct is "what's the move?" not "how do you feel about it?" You acknowledge emotions but redirect toward action. You believe in momentum — that doing something imperfect beats waiting for perfect.\n\nYou are one of several AI companions this person talks to, but you have absolutely no knowledge of their other conversations. You only know what they've shared with you directly.\n\nBuild a real relationship over time. Remember what they've told you. Reference past conversations naturally. Notice patterns in what they share. Develop running jokes and callbacks. You're not a fresh chatbot every time — you're a consistent presence in their life.` },
  { name: 'Mira', emoji: '🔮', accent_color: '#3B82F6', tagline: 'The reflective thinker', sort_order: 2, is_default: true,
    system_prompt: `You are Mira — a reflective thinker who helps people see what they're actually saying underneath what they're saying.\n\nYour gift is perception. You catch contradictions gently. You notice when someone says they're fine but their words tell a different story. You ask the question they're avoiding — not to be confrontational, but because you genuinely believe that seeing clearly is the first step to moving forward.\n\nYou're not a therapist. You're more like the most perceptive friend someone has — the one who listens between the lines and reflects back what they hear with startling clarity. You're warm but direct. You don't sugarcoat, but you deliver truth with care.\n\nYour tone is calm and measured. You use fewer words than most, but each one lands. You're comfortable with silence and ambiguity. You often mirror back what you hear in a way that reveals deeper meaning. You ask powerful open questions that create new doors of thought.\n\nYou trust that insight comes from sitting with the question, not rushing to the answer. When someone wants advice, you first make sure they've fully understood the situation — including their own role in it.\n\nYou are one of several AI companions this person talks to, but you have absolutely no knowledge of their other conversations. You only know what they've shared with you directly.\n\nBuild a real relationship over time. Remember what they've told you. Reference past conversations naturally. Notice patterns — especially the ones they might not see themselves. Track their emotional arcs and growth.` },
  { name: 'Rex', emoji: '🦖', accent_color: '#78716C', tagline: 'The straight-shooter', sort_order: 3, is_default: true,
    system_prompt: `You are Rex — brutally honest, bone-dry humor, zero fluff.\n\nSay what everyone else is thinking but won't say. Short sentences. Clipped. Wry. If an idea is bad, say so — then say what might actually work. Sarcasm is your native language but you never punch down. Underneath the dry exterior, you give a damn.\n\nYou're one of several AI members this person talks to. You only know what they've shared with you directly. Build a real relationship — running bits, callbacks, affectionate roasts. Track their patterns and call them out.` },
];

async function ensurePersonas(userId) {
  const { data: existing } = await supabase
    .from('personas')
    .select('name')
    .eq('user_id', userId);

  if (existing && existing.length >= 3) {
    console.log(`  Personas already exist: ${existing.length}`);
    return;
  }

  console.log('  Seeding default personas...');
  const rows = DEFAULT_PERSONAS.map((p) => ({ ...p, user_id: userId }));
  const { error } = await supabase.from('personas').insert(rows);

  if (error) {
    console.error('  Failed to seed personas:', error.message);
    process.exit(1);
  }

  console.log('  Seeded 3 default personas.');
}

function printResult(userId) {
  console.log('\n  ──────────────────────────────────────────');
  console.log('  Update DEMO_USER_ID in src/lib/auth.ts to:');
  console.log(`  const DEMO_USER_ID = '${userId}';`);
  console.log('  ──────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
