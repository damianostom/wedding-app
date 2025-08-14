import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { email, password } = await req.json() as { email: string; password: string }
  if (!email || !password) return NextResponse.json({ error: 'Brak danych' }, { status: 400 })
  const supabase = createRouteHandlerClient({ cookies })
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return NextResponse.json({ error: error.message }, { status: 401 })
  // Auth Helpers zapiszą cookies w odpowiedzi:
  return NextResponse.json({ ok: true })
}
