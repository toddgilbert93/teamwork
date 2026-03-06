import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'polyphony_demo';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, 'true', {
    path: '/',
    sameSite: 'lax',
    httpOnly: false, // Client needs to read this for sign-out
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);

  return NextResponse.json({ success: true });
}
