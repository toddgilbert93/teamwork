import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

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

  // Fetch persona
  const { data: persona, error: personaError } = await supabase
    .from('personas')
    .select('name, emoji')
    .eq('id', personaId)
    .eq('user_id', user.id)
    .single();

  if (personaError || !persona) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  }

  // Fetch messages
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('persona_id', personaId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  // Build markdown
  let md = `# Conversation with ${persona.emoji} ${persona.name}\n\n`;
  md += `Exported on ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}\n\n---\n\n`;

  for (const msg of messages || []) {
    const speaker = msg.role === 'user' ? '**You**' : `**${persona.name}**`;
    const time = new Date(msg.created_at).toLocaleString();
    md += `${speaker} *(${time})*\n\n${msg.content}\n\n---\n\n`;
  }

  return new Response(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${persona.name}-conversation.md"`,
    },
  });
}
