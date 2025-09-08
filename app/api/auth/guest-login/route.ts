import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
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
  return crypto
    .createHmac('sha256', secret)
    .update(`${weddingId}:${username}`)
    .digest('hex')
    .slice(0, 32) // Supabase wymaga min. 6, 32 jest OK
}

export async function POST(req: Request) {
  try {
    const { firstName, lastName } = (await req.json()) as { firstName?: string; lastName?: string }
    const first = firstName?.trim()
    const last = lastName?.trim()
    if (!first || !last) {
      return NextResponse.json({ error: 'Podaj imię i nazwisko.' }, { status: 400 })
    }

    const username = `${slugify(first)}-${slugify(last)}`
    const admin = getSupabaseAdmin()

    // 1) znajdź gościa po username (musi być aktywny)
    const { data: guest } = await admin
      .from('guests')
      .select('id, user_id, wedding_id, is_active')
      .eq('username', username)
      .maybeSingle()

    if (!guest || !guest.is_active) {
      return NextResponse.json({ error: 'Nie znaleziono aktywnego gościa o podanych danych.' }, { status: 404 })
    }
    if (!guest.user_id || !guest.wedding_id) {
      return NextResponse.json({ error: 'Konto gościa jest niekompletne (brak powiązania).' }, { status: 409 })
    }

    // 2) deterministyczne hasło
    const password = deriveGuestPassword(guest.wedding_id, username)
    const email = `${username}@noemail.local`

    // 3) zaloguj przez Supabase (serwerowo – zapisze cookie)
    const supabase = createRouteHandlerClient({ cookies })
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Na wypadek, gdyby hasło kiedyś nie zostało zsynchronizowane
      // (np. gość utworzony dawniej ręcznie) spróbujmy je ustawić:
      const upd = await admin.auth.admin.updateUserById(guest.user_id, { password })
      if (upd.error) {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      const retry = await supabase.auth.signInWithPassword({ email, password })
      if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 401 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
