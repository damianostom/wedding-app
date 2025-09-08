import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { token, weddingId } = await req.json() as { token?: string; weddingId?: string }
    if (!token || !weddingId) return NextResponse.json({ error:'token & weddingId required' }, { status:400 })

    const valid = process.env.DJ_TOKEN || ''
    if (!valid || token !== valid) return NextResponse.json({ error:'Niepoprawny token' }, { status:401 })

    // weryfikacja czy takie wesele istnieje (np. w guests)
    const admin = getSupabaseAdmin()
    const { data } = await admin.from('guests').select('id').eq('wedding_id', weddingId).limit(1)
    if (!data?.length) return NextResponse.json({ error:'Nie znaleziono wesela' }, { status:404 })

    const c = cookies()
    c.set('dj_auth', '1', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60*60*8 })
    c.set('dj_wedding', weddingId, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60*60*8 })

    return NextResponse.json({ ok:true })
  } catch (e:any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status:500 })
  }
}
