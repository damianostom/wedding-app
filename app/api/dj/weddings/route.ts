import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = getSupabaseAdmin()

  // próbujemy nazwy z info_pages.title, a jak nie ma – pokazujemy sam UUID
  const { data: pages } = await admin.from('info_pages').select('wedding_id,title')
  const byId = new Map<string,string>()
  for (const p of pages ?? []) if (p.wedding_id) byId.set(p.wedding_id, p.title || p.wedding_id)

  // fallback: distinct z guests
  const { data: guests } = await admin.from('guests').select('wedding_id').not('wedding_id','is',null)
  const ids = Array.from(new Set((guests ?? []).map(g => g.wedding_id).filter(Boolean)))
  const out = ids.map(id => ({ id, name: byId.get(id!) || id! }))

  // posortuj alfabetycznie po nazwie
  out.sort((a,b) => a.name.localeCompare(b.name))
  return NextResponse.json(out)
}
