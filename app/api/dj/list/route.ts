import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = cookies()
  const wid = c.get('dj_wedding')?.value
  if (!wid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getSupabaseAdmin()
  // Jednym strzałem pobieramy liczbę głosów per request (song_votes(count))
  const { data: rows, error } = await admin
    .from('song_requests')
    .select('id,title,artist,status,created_at,song_votes(count)')
    .eq('wedding_id', wid)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const mapped = (rows ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    status: r.status as 'pending' | 'played' | 'rejected',
    votes: (r.song_votes?.[0]?.count as number) || 0,
  }))

  return NextResponse.json({
    pending:  mapped.filter(r => r.status === 'pending'),
    played:   mapped.filter(r => r.status === 'played'),
    rejected: mapped.filter(r => r.status === 'rejected'),
  })
}
