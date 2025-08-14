'use client'
import { supaClient } from '@/lib/supabaseClient'
import { useEffect, useState } from 'react'

type Guest = { id: string; full_name: string; role: string; rsvp: string | null }

export default function GuestsPage() {
  const supabase = supaClient()
  const [guests, setGuests] = useState<Guest[]>([])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.from('guests').select('id,full_name,role,rsvp').order('full_name')
      setGuests(data ?? [])
    })()
  }, [])

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Lista gości</h1>
      <ul className="divide-y">
        {guests.map(g => (
          <li key={g.id} className="py-2 flex justify-between">
            <span>{g.full_name}</span>
            <span className="text-sm text-gray-600">{g.role}{g.rsvp ? `, RSVP: ${g.rsvp}` : ''}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
