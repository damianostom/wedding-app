// app/api/admin/delete-song-request/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { id } = await req.json() as { id?: string }
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const browser = createRouteHandlerClient({ cookies })
    const { data: { user } } = await browser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak sesji' }, { status: 401 })

    const { data: me } = await browser
      .from('guests')
      .select('role,wedding_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!me || me.role !== 'organizer') {
      return NextResponse.json({ error: 'Tylko organizator' }, { status: 403 })
    }

    const admin = getSupabaseAdmin()
    const { data: row, error: e1 } = await admin
      .from('song_requests')
      .select('id,wedding_id')
      .eq('id', id)
      .maybeSingle()
    if (e1) return NextResponse.json({ error: e1.message }, { status: 400 })
    if (!row) return NextResponse.json({ error: 'Brak prośby' }, { status: 404 })
    if (row.wedding_id !== me.wedding_id) {
      return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
    }

    await admin.from('song_votes').delete().eq('request_id', id)
    const { error: e2 } = await admin.from('song_requests').delete().eq('id', id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
