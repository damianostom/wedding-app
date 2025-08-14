import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { photoId } = await req.json() as { photoId?: string }
    if (!photoId) return NextResponse.json({ error: 'photoId required' }, { status: 400 })

    const browser = createRouteHandlerClient({ cookies })
    const { data: { user } } = await browser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak sesji' }, { status: 401 })

    const { data: me } = await browser.from('guests')
      .select('id,role,wedding_id').eq('user_id', user.id).maybeSingle()
    if (!me) return NextResponse.json({ error: 'Brak powiązania z weselem' }, { status: 403 })

    const admin = getSupabaseAdmin()
    const { data: photo, error } = await admin
      .from('photos')
      .select('id,storage_path,uploaded_by,wedding_id')
      .eq('id', photoId).maybeSingle()
    if (error || !photo) return NextResponse.json({ error: 'Zdjęcie nie istnieje' }, { status: 404 })

    const canDelete = me.role === 'organizer' || photo.uploaded_by === user.id
    if (!canDelete) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })

    await admin.storage.from('photos').remove([photo.storage_path])
    await admin.from('photos').delete().eq('id', photoId)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
