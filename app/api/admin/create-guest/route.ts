import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import type { User as SupaUser } from '@supabase/supabase-js'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function slugify(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function deriveGuestPassword(weddingId: string, username: string): string {
  const secret = process.env.SERVER_GUEST_SECRET || 'default-secret-change-me'
  return crypto.createHmac('sha256', secret).update(`${weddingId}:${username}`).digest('hex').slice(0, 32)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { firstName: string; lastName: string }
    const first = body.firstName?.trim()
    const last = body.lastName?.trim()
    if (!first || !last) {
      return NextResponse.json({ error: 'Podaj imię i nazwisko.' }, { status: 400 })
    }

    // Sesja i rola wywołującego (musi być organizer)
    const browser = createRouteHandlerClient({ cookies })
    const { data: { user } } = await browser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak sesji.' }, { status: 401 })

    const { data: me } = await browser
      .from('guests')
      .select('wedding_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!me || me.role !== 'organizer') {
      return NextResponse.json({ error: 'Tylko organizator może dodawać gości.' }, { status: 403 })
    }

    const username = `${slugify(first)}-${slugify(last)}`
    const email = `${username}@noemail.local`
    const password = deriveGuestPassword(me.wedding_id, username)

    const admin = getSupabaseAdmin()

    // Szukamy istniejącego usera po syntetycznym e-mailu
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 })
    if (list.error) return NextResponse.json({ error: list.error.message }, { status: 400 })

    let target = list.data.users.find(
      (u: SupaUser) => (u.email ?? '').toLowerCase() === email.toLowerCase()
    )

    if (!target) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: first, last_name: last },
      })
      if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 })
      target = created.data.user
    } else {
      const upd = await admin.auth.admin.updateUserById(target.id, { password })
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 })
    }

    // Rekord w guests (unikamy duplikatu po username + wedding_id)
    const full_name = `${first} ${last}`

    // Czy już istnieje?
    const { data: exists } = await admin
      .from('guests')
      .select('id')
      .eq('wedding_id', me.wedding_id)
      .eq('username', username)
      .maybeSingle()

    if (exists?.id) {
      const upd = await admin
        .from('guests')
        .update({ user_id: target!.id, full_name, role: 'guest', is_active: true })
        .eq('id', exists.id)
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 })
    } else {
      const ins = await admin
        .from('guests')
        .insert({ wedding_id: me.wedding_id, user_id: target!.id, full_name, role: 'guest', username, is_active: true })
        .select('id')
        .single()
      if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, username })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
