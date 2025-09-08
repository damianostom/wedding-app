import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST() {
  const c = cookies()
  const wid = c.get('dj_wedding')?.value
  if (!wid) return NextResponse.json({ error:'Unauthorized' }, { status:401 })

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('song_requests')
    .update({ status: 'rejected' })
    .eq('wedding_id', wid)
    .eq('status', 'played')
  if (error) return NextResponse.json({ error: error.message }, { status:400 })

  return NextResponse.json({ ok:true })
}
