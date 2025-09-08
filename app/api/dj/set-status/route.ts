import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const c = cookies()
  const wid = c.get('dj_wedding')?.value
  if (!wid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status } = (await req.json()) as { id?: string; status?: 'pending'|'played'|'rejected' }
  if (!id || !status) return NextResponse.json({ error: 'id & status required' }, { status: 400 })

  const admin = getSupabaseAdmin()
  const { error } = await admin.from('song_requests')
    .update({ status })
    .eq('id', id)
    .eq('wedding_id', wid)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
