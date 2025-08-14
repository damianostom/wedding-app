import { supaClient } from './supabaseClient'

export async function getMyWeddingId(): Promise<string | null> {
  const supabase = supaClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('guests')
    .select('wedding_id')
    .eq('user_id', user.id)
    .eq('is_active', true)   // ← nowość
    .limit(1)
    .maybeSingle()
  return data?.wedding_id ?? null
}
