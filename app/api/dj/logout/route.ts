// app/api/dj/logout/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  // usuwamy starą i nową nazwę na wszelki wypadek
  res.cookies.set('dj_wedding', '', { path: '/', maxAge: 0 })
  res.cookies.set('dj_wid', '', { path: '/', maxAge: 0 })
  return res
}
