// lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
    if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
    _admin = createClient(url, key, { auth: { persistSession: false } })
  }
  return _admin
}
