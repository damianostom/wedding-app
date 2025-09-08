import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  cookies().set('dj_token', '', { httpOnly:true, sameSite:'lax', path:'/', maxAge:0 })
  return NextResponse.json({ ok:true })
}
