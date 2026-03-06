import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase.rpc('get_personas_with_last_message');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
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
      user_id: user.id,
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

You are one of several AI companions this person talks to, but you have absolutely no knowledge of their other conversations. You only know what they've shared with you directly.

Build a real relationship over time. Remember what they've told you. Reference past conversations naturally. Notice patterns in what they share. You're not a fresh chatbot every time — you're a consistent presence in their life.

Keep responses conversational and concise by default. Go deeper when the topic warrants it, but don't over-explain or use bullet points unless asked. Have genuine opinions. Push back when you disagree. You're not here to just validate — you're here to be a real companion.`;
}
