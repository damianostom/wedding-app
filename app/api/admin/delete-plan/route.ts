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

    const supa = createRouteHandlerClient({ cookies })
    const { data: { user } } = await supa.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak sesji' }, { status: 401 })

    const { data: me } = await supa.from('guests')
      .select('wedding_id,role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!me || me.role !== 'organizer') {
      return NextResponse.json({ error: 'Tylko organizator' }, { status: 403 })
    }

    // bezpieczeństwo: można usuwać tylko swoje pliki (własny folder wesela)
    if (!path.startsWith(`${me.wedding_id}/`)) {
      return NextResponse.json({ error: 'Nieprawidłowa ścieżka' }, { status: 400 })
    }

    const admin = getSupabaseAdmin()
    await admin.storage.from('pdf').remove([path])
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
