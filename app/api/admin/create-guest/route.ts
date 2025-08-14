import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

function slugify(s: string) {
  return s
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { firstName: string; lastName: string; password: string }
    const first = body.firstName?.trim()
    const last = body.lastName?.trim()
    const password = body.password?.trim()
    if (!first || !last || !password) {
      return NextResponse.json({ error: 'Podaj imię, nazwisko i hasło.' }, { status: 400 })
    }

    // Sprawdź czy wywołujący to ORGANIZATOR i pobierz jego wedding_id
    const browser = createRouteHandlerClient({ cookies })
    const { data: { user } } = await browser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak sesji.' }, { status: 401 })

    const { data: me } = await browser
      .from('guests')
      .select('wedding_id, role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!me || me.role !== 'organizer')
      return NextResponse.json({ error: 'Tylko organizator może dodawać gości.' }, { status: 403 })

    const username = `${slugify(first)}-${slugify(last)}`
    const email = `${username}@noemail.local` // syntetyczny e-mail

    // 1) Utwórz użytkownika w Auth (hasło ustawione, e-mail potwierdzony)
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: first, last_name: last }
    })
    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })

    // 2) Dodaj rekord w guests (z username)
    const full_name = `${first} ${last}`
    const { error: insertErr } = await supabaseAdmin
      .from('guests')
      .insert({ wedding_id: me.wedding_id, user_id: created.user.id, full_name, role: 'guest', username })
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 400 })

    return NextResponse.json({ ok: true, username })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
