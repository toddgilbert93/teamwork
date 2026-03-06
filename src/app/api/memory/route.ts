import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';
import { generateMemorySummary } from '@/lib/memory';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const personaId = searchParams.get('persona_id');

  if (!personaId) {
    return NextResponse.json({ error: 'persona_id is required' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('personas')
    .select('memory_summary')
    .eq('id', personaId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ memory_summary: data?.memory_summary || null });
}

export async function POST(req: Request) {
  const { persona_id, action } = await req.json();

  if (!persona_id || !action) {
    return NextResponse.json({ error: 'persona_id and action are required' }, { status: 400 });
  }

  const supabase = await createServerClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (action === 'clear') {
    const { error } = await supabase
      .from('personas')
      .update({ memory_summary: null })
      .eq('id', persona_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'summarize') {
    // Fetch persona
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('memory_summary')
      .eq('id', persona_id)
      .single();

    if (personaError) {
      return NextResponse.json({ error: personaError.message }, { status: 500 });
    }

    // Fetch all messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('persona_id', persona_id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      return NextResponse.json({ error: messagesError.message }, { status: 500 });
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({ memory_summary: persona?.memory_summary || null });
    }

    // Generate summary
    const summary = await generateMemorySummary(messages, persona?.memory_summary);

    // Save summary
    const { error: updateError } = await supabase
      .from('personas')
      .update({ memory_summary: summary })
      .eq('id', persona_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ memory_summary: summary });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
