import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supa = createMiddlewareClient({ req, res })
  const { data: { session } } = await supa.auth.getSession()

  const isApp = req.nextUrl.pathname.startsWith('/app')
  if (isApp && !session) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }
  return res
}

export const config = {
  matcher: ['/app/:path*'],
}
