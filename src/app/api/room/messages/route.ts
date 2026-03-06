import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  const supabase = await createServerClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('room_messages')
    .select('*, personas(name, emoji, accent_color)')
    .order('created_at', { ascending: true });

  if (error) {
    // Table may not exist yet — return empty array gracefully
    if (error.code === 'PGRST205' || error.message?.includes('room_messages')) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flatten the joined persona data
  const messages = (data || []).map((msg: Record<string, unknown>) => {
    const persona = msg.personas as { name: string; emoji: string; accent_color: string } | null;
    return {
      id: msg.id,
      persona_id: msg.persona_id,
      role: msg.role,
      content: msg.content,
      created_at: msg.created_at,
      persona_name: persona?.name ?? null,
      persona_emoji: persona?.emoji ?? null,
      persona_accent_color: persona?.accent_color ?? null,
    };
  });

  return NextResponse.json(messages);
}

export async function DELETE() {
  const supabase = await createServerClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { error } = await supabase
    .from('room_messages')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
