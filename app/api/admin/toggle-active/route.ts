import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { guestId, isActive } = await req.json() as { guestId?: string; isActive?: boolean }
    if (!guestId || typeof isActive !== 'boolean') return NextResponse.json({ error:'guestId & isActive required' }, { status:400 })

    const browser = createRouteHandlerClient({ cookies })
    const { data: { user } } = await browser.auth.getUser()
    if (!user) return NextResponse.json({ error:'Brak sesji' }, { status:401 })
    const { data: me } = await browser.from('guests').select('role').eq('user_id', user.id).maybeSingle()
    if (me?.role !== 'organizer') return NextResponse.json({ error:'Tylko organizator' }, { status:403 })

    const admin = getSupabaseAdmin()
    const upd = await admin.from('guests').update({ is_active: isActive }).eq('id', guestId)
    if (upd.error) return NextResponse.json({ error: upd.error.message }, { status:400 })
    return NextResponse.json({ ok:true })
  } catch (e:any) { return NextResponse.json({ error:e?.message || 'Unexpected error' }, { status:500 }) }
}
