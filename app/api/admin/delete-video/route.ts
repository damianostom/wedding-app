import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { videoId } = await req.json() as { videoId?: string }
    if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

    const browser = createRouteHandlerClient({ cookies })
    const { data: { user } } = await browser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak sesji' }, { status: 401 })

    const { data: me } = await browser.from('guests').select('role,wedding_id').eq('user_id', user.id).maybeSingle()
    if (!me) return NextResponse.json({ error: 'Brak powiązania z weselem' }, { status: 403 })

    const admin = getSupabaseAdmin()
    const { data: v } = await admin.from('videos').select('id,storage_path,uploaded_by').eq('id', videoId).maybeSingle()
    if (!v) return NextResponse.json({ error: 'Brak wideo' }, { status: 404 })

    const can = me.role === 'organizer' || v.uploaded_by === user.id
    if (!can) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })

    await admin.storage.from('videos').remove([v.storage_path])
    await admin.from('videos').delete().eq('id', videoId)
    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
