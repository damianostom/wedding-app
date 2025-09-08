// app/api/admin/song-requests/delete/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { id } = await req.json().catch(() => ({}))
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const browser = createRouteHandlerClient({ cookies })
    const { data: { user } } = await browser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak sesji' }, { status: 401 })

    const { data: me } = await browser
      .from('guests')
      .select('wedding_id,role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!me || me.role !== 'organizer' || !me.wedding_id) {
      return NextResponse.json({ error: 'Tylko organizator' }, { status: 403 })
    }

    const admin = getSupabaseAdmin()
    await admin.from('song_votes').delete().eq('request_id', id)
    const { error } = await admin
      .from('song_requests')
      .delete()
      .eq('id', id)
      .eq('wedding_id', me.wedding_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
