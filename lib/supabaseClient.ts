import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export function supaClient() {
  return createClientComponentClient()
}
