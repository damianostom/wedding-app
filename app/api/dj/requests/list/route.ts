import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const token = cookies().get('dj_token')?.value
  if (!token || token !== process.env.DJ_STATIC_TOKEN) {
    return NextResponse.json({ error:'Unauthorized' }, { status: 401 })
  }
  const wid = process.env.PUBLIC_WEDDING_ID
  if (!wid) return NextResponse.json({ error:'Missing PUBLIC_WEDDING_ID' }, { status: 500 })

  const admin = getSupabaseAdmin()
  const { data: reqs, error: e1 } = await admin
    .from('song_requests')
    .select('id,title,artist,note,status,created_at')
    .eq('wedding_id', wid)
  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 })

  const ids = (reqs ?? []).map(r => r.id)
  const { data: vs } = ids.length
    ? await admin.from('song_votes').select('request_id').in('request_id', ids)
    : { data: [] as any[] }

  const counts: Record<number, number> = {}
  for (const v of vs ?? []) counts[v.request_id] = (counts[v.request_id] ?? 0) + 1

  // sort: queued (by votes desc) -> played -> rejected
  const rank = (s: string) => (s === 'queued' ? 0 : s === 'played' ? 1 : 2)
  const sorted = [...(reqs ?? [])].sort((a, b) => {
    const ra = rank(a.status), rb = rank(b.status)
    if (ra !== rb) return ra - rb
    const va = counts[a.id] ?? 0, vb = counts[b.id] ?? 0
    if (va !== vb) return vb - va
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return NextResponse.json({ ok:true, items: sorted, votes: counts })
}
