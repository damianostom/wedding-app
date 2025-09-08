// app/api/dj/requests/delete/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const wid = cookies().get('dj_wedding')?.value
  if (!wid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = getSupabaseAdmin()

  // usuń głosy (na wypadek braku CASCADE)
  await admin.from('song_votes').delete().eq('request_id', id)

  const { error } = await admin
    .from('song_requests')
    .delete()
    .eq('id', id)
    .eq('wedding_id', wid)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
