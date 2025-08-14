'use client'
import { useEffect, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'

type Guest = { id: string; full_name: string; role: string }

export default function GuestsPage() {
  const supabase = supaClient()
  const [guests, setGuests] = useState<Guest[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      if (!wid) { setErr('Brak powiązania z weselem.'); return }
      const { data, error } = await supabase
        .from('guests')
        .select('id,full_name,role')
        .eq('wedding_id', wid)
        .order('full_name')
      if (error) setErr(error.message)
      setGuests(data ?? [])
    })()
  }, [])

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Lista gości</h1>
      {err && <p className="text-red-600 text-sm">{err}</p>}
      <ul className="divide-y">
        {guests.map(g => (
          <li key={g.id} className="py-2 flex justify-between">
            <span>{g.full_name}</span>
            <span className="text-sm text-slate-600">{g.role}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
