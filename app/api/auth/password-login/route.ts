import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { email, password } = (await req.json()) as { email?: string; password?: string }
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'Podaj e-mail i hasło.' }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 })
    }

    // Supabase Helpers ustawią cookie sesji w tej odpowiedzi
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('password-login error:', e?.message || e)
    return NextResponse.json({ ok: false, error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
