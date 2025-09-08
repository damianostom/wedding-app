// app/api/auth/guest-login/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import type { User as SupaUser } from '@supabase/supabase-js'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function slugify(s: string) {
  return s.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function deriveGuestPassword(weddingId: string, username: string) {
  const secret = process.env.SERVER_GUEST_SECRET || 'change-me'
  return crypto.createHmac('sha256', secret)
    .update(`${weddingId}:${username}`)
    .digest('hex')
    .slice(0, 32)
}

// znajdź wolny username (base, base-2, base-3, ...)
async function ensureUniqueUsername(admin: ReturnType<typeof getSupabaseAdmin>, weddingId: string, base: string) {
  // wczytaj wszystkie zaczynające się od base (dla tego wesela)
  const { data, error } = await admin
    .from('guests')
    .select('username')
    .eq('wedding_id', weddingId)
    .ilike('username', `${base}%`)
  if (error) throw new Error(error.message)
  const used = new Set((data ?? []).map(r => (r as any).username as string))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export async function POST(req: Request) {
  try {
    const { firstName, lastName } = await req.json() as { firstName?: string; lastName?: string }
    const first = firstName?.trim(); const last = lastName?.trim()
    if (!first || !last) {
      return NextResponse.json({ error: 'Podaj imię i nazwisko.' }, { status: 400 })
    }

    const weddingId = process.env.PUBLIC_WEDDING_ID
    if (!weddingId) return NextResponse.json({ error: 'Brak PUBLIC_WEDDING_ID na serwerze.' }, { status: 500 })

    const fullName = `${first} ${last}`.replace(/\s+/g, ' ').trim()
    const baseUsername = `${slugify(first)}-${slugify(last)}`
    const admin = getSupabaseAdmin()

    // 1) przygotuj username (unikalny w ramach wesela)
    const username = await ensureUniqueUsername(admin, weddingId, baseUsername)

    // 2) utwórz/znajdź konto AUTH po e-mailu syntetycznym
    const email = `${username}@noemail.local`
    const password = deriveGuestPassword(weddingId, username)

    // spróbuj znaleźć istniejącego usera
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 })
    if (list.error) return NextResponse.json({ error: list.error.message }, { status: 400 })
    let authUser: SupaUser | undefined =
      list.data.users.find(u => (u.email ?? '').toLowerCase() === email.toLowerCase())

    if (!authUser) {
      const created = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { first_name: first, last_name: last, full_name: fullName }
      })
      if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 })
      authUser = created.data.user
    } else {
      // dla pewności ustaw nasze deterministyczne hasło
      const upd = await admin.auth.admin.updateUserById(authUser.id, { password })
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 })
    }

    // 3) wstaw/uzupełnij rekord w guests (bez żadnej weryfikacji listy)
    //    jeśli (wedding_id, username) istnieje – tylko podczep user_id i zaktualizuj full_name/is_active
    const upsert = await admin.from('guests')
      .upsert({
        wedding_id: weddingId,
        user_id: authUser.id,
        full_name: fullName,
        role: 'guest',
        username,
        is_active: true,
      }, { onConflict: 'wedding_id,username' })
    if (upsert.error) return NextResponse.json({ error: upsert.error.message }, { status: 400 })

    // 4) zaloguj i ustaw cookies sesji
    const browser = createRouteHandlerClient({ cookies })
    const { error: signErr } = await browser.auth.signInWithPassword({ email, password })
    if (signErr) return NextResponse.json({ error: signErr.message }, { status: 401 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
