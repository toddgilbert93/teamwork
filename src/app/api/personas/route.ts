import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser, userIdField } from '@/lib/auth';
import { DEFAULT_PERSONAS, resolveSystemPrompt } from '@/lib/default-personas';

export async function GET() {
  const supabase = await createServerClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch personas for this user
  let { data: personas, error } = await supabase
    .from('personas')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Seed defaults for new users who have no personas yet
  if (!personas || personas.length === 0) {
    const rows = DEFAULT_PERSONAS.map(({ description, ...p }) => ({ ...p, user_id: user.id }));
    const { data: seeded, error: seedErr } = await supabase
      .from('personas')
      .insert(rows)
      .select();
    if (seedErr) {
      return NextResponse.json({ error: seedErr.message }, { status: 500 });
    }
    personas = seeded;
  }

  // Fetch last message for each persona
  const personaIds = (personas || []).map((p: { id: string }) => p.id);
  const { data: lastMessages } = personaIds.length > 0
    ? await supabase
        .from('messages')
        .select('persona_id, content, created_at, role')
        .in('persona_id', personaIds)
        .order('created_at', { ascending: false })
    : { data: [] };

  // Group by persona_id, take first (most recent) for each, and sum total characters
  const lastMessageMap = new Map<string, { content: string; created_at: string; role: string }>();
  const totalCharsMap = new Map<string, number>();
  for (const msg of lastMessages || []) {
    if (!lastMessageMap.has(msg.persona_id)) {
      lastMessageMap.set(msg.persona_id, msg);
    }
    totalCharsMap.set(msg.persona_id, (totalCharsMap.get(msg.persona_id) || 0) + (msg.content?.length || 0));
  }

  // Merge into persona objects, resolving system prompts from code for defaults
  const result = (personas || []).map((p: Record<string, unknown>) => {
    const last = lastMessageMap.get(p.id as string);
    return {
      ...p,
      system_prompt: resolveSystemPrompt(p as { is_default: boolean; name: string; system_prompt: string }),
      last_message_content: last?.content ?? null,
      last_message_at: last?.created_at ?? null,
      last_message_role: last?.role ?? null,
      total_characters: totalCharsMap.get(p.id as string) ?? 0,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, emoji, accent_color, tagline, personality } = body;

  if (!name || !personality) {
    return NextResponse.json({ error: 'Name and personality are required' }, { status: 400 });
  }

  // Generate a full system prompt from the personality description
  const system_prompt = generateSystemPrompt(name, personality);

  // Get the max sort_order
  const { data: maxSort } = await supabase
    .from('personas')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single();

  const sort_order = (maxSort?.sort_order ?? 0) + 1;

  const { data, error } = await supabase
    .from('personas')
    .insert({
      name,
      emoji: emoji || '🤖',
      accent_color: accent_color || '#6366F1',
      system_prompt,
      tagline: tagline || null,
      sort_order,
      ...userIdField(user),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

function generateSystemPrompt(name: string, personality: string): string {
  return `You are ${name} — ${personality}

You are one of several AI members this person talks to, but you have absolutely no knowledge of their other conversations. You only know what they've shared with you directly.

Build a real relationship over time. Remember what they've told you. Reference past conversations naturally. Notice patterns in what they share. You're not a fresh chatbot every time — you're a consistent presence in their life.

Keep responses conversational and concise by default. Go deeper when the topic warrants it, but don't over-explain or use bullet points unless asked. Have genuine opinions. Push back when you disagree. You're not here to just validate — you're here to be a real member.`;
}
