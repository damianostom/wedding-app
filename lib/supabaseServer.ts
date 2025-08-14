// Klient do Route Handlers (API) – jeśli kiedyś potrzebujesz
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export function supaServer() {
  return createRouteHandlerClient({ cookies })
}
