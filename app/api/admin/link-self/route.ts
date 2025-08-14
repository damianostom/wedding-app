import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { weddingId, fullName } = await req.json() as { weddingId?: string; fullName?: string }
    if (!weddingId) return NextResponse.json({ error: 'Podaj weddingId' }, { status: 400 })

    const browser = createRouteHandlerClient({ cookies })
    const { data: { user } } = await browser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak sesji' }, { status: 401 })

    // admin client (service role) – omija RLS
    const admin = getSupabaseAdmin()

    // znajdź istniejącego organizatora dla tego wesela
    const { data: existing, error } = await admin
      .from('guests')
      .select('id,full_name,role,user_id')
      .eq('wedding_id', weddingId)
      .eq('role','organizer')
      .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (existing) {
      const upd = await admin
        .from('guests')
        .update({ user_id: user.id, full_name: fullName ?? existing.full_name })
        .eq('id', existing.id)
        .select('id')
        .single()
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 })
      return NextResponse.json({ ok: true, linkedId: existing.id })
    } else {
      // jeśli nie było – utwórz organizatora
      const ins = await admin
        .from('guests')
        .insert({ wedding_id: weddingId, user_id: user.id, full_name: fullName ?? 'Organizer', role: 'organizer' })
        .select('id')
        .single()
      if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 })
      return NextResponse.json({ ok: true, linkedId: ins.data.id })
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
