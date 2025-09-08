import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const c = cookies()
  const ok = c.get('dj_auth')?.value === '1'
  const weddingId = c.get('dj_wedding')?.value || null
  if (!ok || !weddingId) return NextResponse.json({ ok:false }, { status:401 })
  return NextResponse.json({ ok:true, weddingId })
}
