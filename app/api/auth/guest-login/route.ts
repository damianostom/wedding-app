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
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function deriveGuestPassword(weddingId: string, username: string) {
  const secret = process.env.SERVER_GUEST_SECRET || 'change-me'
  // deterministyczne hasło – używane tylko do auto-logowania
  return crypto.createHmac('sha256', secret).update(`${weddingId}:${username}`).digest('hex').slice(0, 32)
}

// nada unikalny username w ramach wesela (base, base-2, base-3, …)
async function ensureUniqueUsername(
  admin: ReturnType<typeof getSupabaseAdmin>,
  weddingId: string,
  base: string
) {
  const { data, error } = await admin
    .from('guests')
    .select('username')
    .eq('wedding_id', weddingId)
    .ilike('username', `${base}%`)
  if (error) throw new Error(error.message)
  const used = new Set<string>((data ?? []).map((r: any) => r.username))
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export async function POST(req: Request) {
  try {
    const { firstName, lastName } = (await req.json()) as { firstName?: string; lastName?: string }
    const first = (firstName || '').trim()
    const last = (lastName || '').trim()

    // ── WALIDACJA ────────────────────────────────────────────────────────────────
    if (first.length < 3 || last.length < 3) {
      return NextResponse.json({ error: 'Imię i nazwisko muszą mieć co najmniej 3 znaki.' }, { status: 400 })
    }

    const weddingId = process.env.PUBLIC_WEDDING_ID
    if (!weddingId) return NextResponse.json({ error: 'Brak PUBLIC_WEDDING_ID na serwerze.' }, { status: 500 })

    const fullName = `${first} ${last}`.replace(/\s+/g, ' ').trim()
    const baseUsername = `${slugify(first)}-${slugify(last)}`
    const admin = getSupabaseAdmin()

    // ── 1) SZUKAJ PO FULL_NAME (case-insensitive) W DANYM WESELU ────────────────
    const { data: foundByName, error: nameErr } = await admin
      .from('guests')
      .select('id, full_name, user_id, username, is_active')
      .eq('wedding_id', weddingId)
      .ilike('full_name', fullName) // dokładne porównanie bez wrażliwości na wielkość liter
      .limit(1)
      .maybeSingle()
    if (nameErr) return NextResponse.json({ error: nameErr.message }, { status: 400 })

    let username: string
    let authUserId: string
    let guestId: string | null = null

    // ── 2) Jeśli gość już istnieje → użyj jego konta ───────────────────────────
    if (foundByName) {
      if (foundByName.is_active === false) {
        return NextResponse.json({ error: 'To konto gościa jest nieaktywne.' }, { status: 403 })
      }

      guestId = foundByName.id
      // jeśli w bazie nie ma username – nadaj
      username = foundByName.username || (await ensureUniqueUsername(admin, weddingId, baseUsername))

      // upewnij się, że jest konto AUTH i że jest podpięte do guests.user_id
      const email = `${username}@noemail.local`
      const password = deriveGuestPassword(weddingId, username)

      const list = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 })
      if (list.error) return NextResponse.json({ error: list.error.message }, { status: 400 })

      let authUser: SupaUser | undefined = list.data.users.find(
        (u) => (u.email ?? '').toLowerCase() === email.toLowerCase()
      )
      if (!authUser) {
        const created = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { first_name: first, last_name: last, full_name: fullName },
        })
        if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 })
        authUser = created.data.user
      } else {
        // ustaw nasze deterministyczne hasło, żeby logowanie zawsze grało
        const upd = await admin.auth.admin.updateUserById(authUser.id, { password })
        if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 })
      }
      authUserId = authUser.id

      // zaktualizuj rekord gościa (dopnij user_id i username jeśli brak)
      const updGuest = await admin
        .from('guests')
        .update({ user_id: authUserId, username, full_name: fullName, is_active: true })
        .eq('id', guestId)
      if (updGuest.error) return NextResponse.json({ error: updGuest.error.message }, { status: 400 })

      // zaloguj
      const browser = createRouteHandlerClient({ cookies })
      const { error: signErr } = await browser.auth.signInWithPassword({ email, password })
      if (signErr) return NextResponse.json({ error: signErr.message }, { status: 401 })

      return NextResponse.json({ ok: true, username, reused: true })
    }

    // ── 3) Jeśli gościa brak → załóż nowe konto i rekord ───────────────────────
    username = await ensureUniqueUsername(admin, weddingId, baseUsername)
    const email = `${username}@noemail.local`
    const password = deriveGuestPassword(weddingId, username)

    // konto AUTH
    const list = await admin.auth.admin.listUsers({ page: 1, perPage: 2000 })
    if (list.error) return NextResponse.json({ error: list.error.message }, { status: 400 })
    let authUser: SupaUser | undefined = list.data.users.find(
      (u) => (u.email ?? '').toLowerCase() === email.toLowerCase()
    )
    if (!authUser) {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { first_name: first, last_name: last, full_name: fullName },
      })
      if (created.error) return NextResponse.json({ error: created.error.message }, { status: 400 })
      authUser = created.data.user
    } else {
      const upd = await admin.auth.admin.updateUserById(authUser.id, { password })
      if (upd.error) return NextResponse.json({ error: upd.error.message }, { status: 400 })
    }
    authUserId = authUser.id

    // rekord w guests (INSERT)
    const ins = await admin.from('guests').insert({
      wedding_id: weddingId,
      user_id: authUserId,
      full_name: fullName,
      role: 'guest',
      username,
      is_active: true,
    })
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 400 })

    // logowanie
    const browser = createRouteHandlerClient({ cookies })
    const { error: signErr } = await browser.auth.signInWithPassword({ email, password })
    if (signErr) return NextResponse.json({ error: signErr.message }, { status: 401 })

    return NextResponse.json({ ok: true, username, created: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
