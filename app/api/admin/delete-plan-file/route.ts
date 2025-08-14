import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { path } = await req.json() as { path?: string }
    if (!path) return NextResponse.json({ error: 'path required' }, { status: 400 })

    const browser = createRouteHandlerClient({ cookies })
    const { data: { user } } = await browser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak sesji' }, { status: 401 })

    const { data: me } = await browser.from('guests').select('role').eq('user_id', user.id).maybeSingle()
    if (me?.role !== 'organizer') return NextResponse.json({ error: 'Tylko organizator' }, { status: 403 })

    const admin = getSupabaseAdmin()
    const { error } = await admin.storage.from('pdf').remove([path])
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
