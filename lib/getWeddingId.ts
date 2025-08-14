'use client'
import { supaClient } from '@/lib/supabaseClient'

export async function getMyWeddingId(): Promise<string | null> {
  const supabase = supaClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('guests')
    .select('wedding_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data?.wedding_id ?? null
}
