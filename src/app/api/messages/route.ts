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

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('persona_id', personaId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
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

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('persona_id', personaId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
