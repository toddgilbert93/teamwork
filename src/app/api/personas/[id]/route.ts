import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/auth';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Block edits to default personas
  const { data: existing } = await supabase
    .from('personas')
    .select('is_default')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  }

  if (existing.is_default) {
    return NextResponse.json({ error: 'Cannot edit a default persona' }, { status: 403 });
  }

  const body = await req.json();
  const { name, emoji, accent_color, tagline, personality } = body;

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (emoji !== undefined) updateData.emoji = emoji;
  if (accent_color !== undefined) updateData.accent_color = accent_color;
  if (tagline !== undefined) updateData.tagline = tagline;
  if (personality !== undefined) updateData.system_prompt = personality;

  const { data, error } = await supabase
    .from('personas')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Block deletion of default personas
  const { data: existing } = await supabase
    .from('personas')
    .select('is_default')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
  }

  if (existing.is_default) {
    return NextResponse.json({ error: 'Cannot delete a default persona' }, { status: 403 });
  }

  const { error } = await supabase
    .from('personas')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
