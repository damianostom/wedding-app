// app/api/admin/link-self/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { weddingId, fullName } = (await req.json()) as { weddingId?: string; fullName?: string }
    if (!weddingId || !fullName) {
      return NextResponse.json({ error: 'Podaj weddingId i fullName.' }, { status: 400 })
    }

    const browser = createRouteHandlerClient({ cookies })
    const { data: { user } } = await browser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak sesji.' }, { status: 401 })

    const admin = getSupabaseAdmin()

    // czy istnieje rekord dla tego wesela z tym userem?
    const { data: exists } = await admin
      .from('guests')
      .select('id')
      .eq('user_id', user.id)
      .eq('wedding_id', weddingId)
      .maybeSingle()

    if (exists?.id) {
      const upd = await admin
        .from('guests')
        .update({ full_name: fullName, role: 'organizer' })
        .eq('id', exists.id)
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 })
    } else {
      // wstaw nowy rekord (jako organizer)
      const ins = await admin
        .from('guests')
        .insert({ wedding_id: weddingId, user_id: user.id, full_name: fullName, role: 'organizer' })
      if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
