// app/api/auth/token-login/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import type { User as SupaUser } from '@supabase/supabase-js'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function derivePassword(weddingId: string, token: string) {
  const secret = process.env.SERVER_GUEST_SECRET || 'change-me'
  return crypto.createHmac('sha256', secret).update(`dj:${weddingId}:${token}`).digest('hex').slice(0, 32)
}

export async function POST(req: Request) {
  try {
    const { token, weddingId } = await req.json() as { token?: string; weddingId?: string }
    if (!token || !weddingId) return NextResponse.json({ error: 'token & weddingId required' }, { status: 400 })

    const expected = process.env.DJ_STATIC_TOKEN
    if (!expected || token !== expected) {
      return NextResponse.json({ error: 'Nieprawidłowy token.' }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const email = `dj-${weddingId}@noemail.local`
    const password = derivePassword(weddingId, token)

    // znajdź lub utwórz konto auth
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 })
    if (list.error) return NextResponse.json({ error: list.error.message }, { status: 400 })
    let user: SupaUser | undefined = list.data.users.find(u => (u.email ?? '').toLowerCase() === email.toLowerCase())
    if (!user) {
      const created = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { role: 'dj', wedding_id: weddingId }
      })
      if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 })
      user = created.data.user
    } else {
      const upd = await admin.auth.admin.updateUserById(user.id, { password })
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 })
    }

    // dopnij do tabeli guests jako organizer (jeśli nie ma)
    const { data: exists } = await admin
      .from('guests')
      .select('id,role')
      .eq('user_id', user.id)
      .eq('wedding_id', weddingId)
      .maybeSingle()

    if (exists?.id) {
      if (exists.role !== 'organizer') {
        await admin.from('guests').update({ role: 'organizer', is_active: true }).eq('id', exists.id)
      }
    } else {
      await admin.from('guests').insert({
        wedding_id: weddingId, user_id: user.id, full_name: 'DJ', role: 'organizer', is_active: true
      })
    }

    // zaloguj i ustaw cookie
    const browser = createRouteHandlerClient({ cookies })
    const { error: signErr } = await browser.auth.signInWithPassword({ email, password })
    if (signErr) return NextResponse.json({ error: signErr.message }, { status: 401 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
