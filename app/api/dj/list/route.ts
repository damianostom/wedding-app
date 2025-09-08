import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = cookies()
  const wid = c.get('dj_wedding')?.value
  if (!wid) return NextResponse.json({ error:'Unauthorized' }, { status:401 })

  const admin = getSupabaseAdmin()
  const { data: rows, error } = await admin
    .from('song_requests')
    .select('id,title,artist,status')
    .eq('wedding_id', wid)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status:400 })

  // policz głosy (prosto i skutecznie)
  const ids = (rows ?? []).map(r => r.id)
  const votesMap = new Map<string, number>()
  for (const id of ids) {
    const { count } = await admin.from('song_votes').select('*', { count: 'exact', head: true }).eq('request_id', id)
    votesMap.set(id, count || 0)
  }

  const map = (status:'pending'|'played'|'rejected') =>
    (rows ?? [])
      .filter(r => r.status === status)
      .map(r => ({ id:r.id, title:r.title, artist:r.artist, status:r.status, votes: votesMap.get(r.id) || 0 }))

  return NextResponse.json({
    pending:  map('pending'),
    played:   map('played'),
    rejected: map('rejected'),
  })
}
