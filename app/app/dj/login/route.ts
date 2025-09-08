import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}))
  if (!token || token !== process.env.DJ_STATIC_TOKEN) {
    return NextResponse.json({ ok:false, error:'Invalid token' }, { status: 401 })
  }
  cookies().set('dj_token', token, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7 // 7 dni
  })
  return NextResponse.json({ ok:true })
}
