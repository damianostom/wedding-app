import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import type { User as SupaUser } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function slugify(s: string) {
  return s.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function POST(req: Request) {
  try {
    const { firstName, lastName, password } = await req.json() as {
      firstName: string; lastName: string; password: string
    }
    if (!firstName || !lastName || !password) {
      return NextResponse.json({ error: 'Podaj firstName, lastName, password' }, { status: 400 })
    }

    const username = `${slugify(firstName)}-${slugify(lastName)}`
    const syntheticEmail = `${username}@noemail.local`

    // 1) czy wywołujący to organizator
    const browser = createRouteHandlerClient({ cookies })
    const { data: { user } } = await browser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Brak sesji' }, { status: 401 })

    const { data: me } = await browser
      .from('guests')
      .select('id,wedding_id,full_name,role')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!me || me.role !== 'organizer') {
      return NextResponse.json({ error: 'Tylko organizator' }, { status: 403 })
    }

    const admin = getSupabaseAdmin()

    // 2) znajdź/utwórz użytkownika auth do logowania hasłem
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 })
    if (list.error) return NextResponse.json({ error: list.error.message }, { status: 400 })

    let target = list.data.users.find(
      (u: SupaUser) => (u.email ?? '').toLowerCase() === syntheticEmail.toLowerCase()
    )

    if (!target) {
      const created = await admin.auth.admin.createUser({
        email: syntheticEmail,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName }
      })
      if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 })
      target = created.data.user
    } else {
      const upd = await admin.auth.admin.updateUserById(target.id, { password })
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 })
    }

    // 3) podczep username + user_id do rekordu organizatora
    const upg = await admin.from('guests')
      .update({ username, user_id: target!.id })
      .eq('id', me.id)
    if (upg.error) return NextResponse.json({ error: upg.error.message }, { status: 400 })

    return NextResponse.json({ ok: true, username, email: syntheticEmail })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Unknown error' }, { status: 500 })
  }
}
