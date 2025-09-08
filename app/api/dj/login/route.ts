// app/api/dj/login/route.ts
import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { token } = (await req.json()) as { token?: string }
    if (!token?.trim()) {
      return NextResponse.json({ error: 'Podaj token.' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('wedding_settings')
      .select('wedding_id')
      .eq('dj_token', token.trim())
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    if (!data?.wedding_id) {
      return NextResponse.json({ error: 'Niepoprawny token' }, { status: 401 })
    }

    const res = NextResponse.json({ ok: true, weddingId: data.wedding_id })

    // ⬇️ najważniejsze: nazwa i ścieżka ciasteczka zgodne z API
    res.cookies.set('dj_wedding', data.wedding_id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',                 // widoczne również dla /api/dj/**
      maxAge: 60 * 60 * 24 * 14, // 14 dni
    })

    return res
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Unexpected error' },
      { status: 500 }
    )
  }
}
