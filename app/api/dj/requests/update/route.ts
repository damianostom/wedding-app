import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const token = cookies().get('dj_token')?.value
  if (!token || token !== process.env.DJ_STATIC_TOKEN) {
    return NextResponse.json({ error:'Unauthorized' }, { status: 401 })
  }
  const wid = process.env.PUBLIC_WEDDING_ID
  if (!wid) return NextResponse.json({ error:'Missing PUBLIC_WEDDING_ID' }, { status: 500 })

  const { id, status } = await req.json().catch(()=>({}))
  if (!id || !['queued','played','rejected'].includes(status)) {
    return NextResponse.json({ error:'Bad payload' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('song_requests')
    .update({ status })
    .eq('id', id)
    .eq('wedding_id', wid)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok:true })
}
