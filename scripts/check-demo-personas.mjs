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

const DEMO_USER_ID = '99e9e458-1ef5-415b-b57f-b3e0503b2560';

const { data, error } = await supabase
  .from('personas')
  .select('name, emoji, tagline')
  .eq('user_id', DEMO_USER_ID);

console.log('Demo user personas:', error ? error.message : `${data?.length} found`);
if (data) data.forEach(p => console.log(`  ${p.emoji} ${p.name} — ${p.tagline}`));
