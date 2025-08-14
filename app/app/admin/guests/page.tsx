'use client'
import { useEffect, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'

type Guest = { id: string; full_name: string; username: string | null; role: string }

export default function AdminGuests() {
  const supabase = supaClient()
  const [guests, setGuests] = useState<Guest[]>([])
  const [firstName, setFirst] = useState('')
  const [lastName, setLast] = useState('')
  const [password, setPass] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setErr('Brak sesji.'); return }
      const { data: mine } = await supabase.from('guests').select('role').eq('user_id', user.id).maybeSingle()
      const isOrg = mine?.role === 'organizer'
      setIsOrganizer(isOrg)
      if (!isOrg) { setErr('Tylko organizator ma dostęp.'); return }
      const { data } = await supabase.from('guests').select('id,full_name,username,role').order('full_name')
      setGuests(data ?? [])
    })()
  }, [])

  async function createGuest(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setMsg(null)
    const res = await fetch('/api/admin/create-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, password })
    })
    const j = await res.json()
    if (!res.ok) { setErr(j.error || 'Błąd'); return }
    setMsg(`Utworzono konto: ${j.username}`)
    setFirst(''); setLast(''); setPass('')

    const { data } = await supabase.from('guests').select('id,full_name,username,role').order('full_name')
    setGuests(data ?? [])
  }

  if (!isOrganizer) return <p>{err ?? 'Sprawdzanie uprawnień…'}</p>

  return (
    <div className="space-y-6">
      <h1>Admin • Konta gości</h1>

      <form onSubmit={createGuest} className="grid gap-3 md:grid-cols-4">
        <input className="border rounded p-2" placeholder="Imię" value={firstName} onChange={e=>setFirst(e.target.value)} />
        <input className="border rounded p-2" placeholder="Nazwisko" value={lastName} onChange={e=>setLast(e.target.value)} />
        <input className="border rounded p-2" placeholder="Hasło" type="password" value={password} onChange={e=>setPass(e.target.value)} />
        <button className="btn">Utwórz konto</button>
      </form>

      {msg && <div className="text-green-700 text-sm">{msg}</div>}
      {err && <div className="text-red-600 text-sm">{err}</div>}

      <div>
        <h2 className="text-lg font-semibold mb-2">Lista gości</h2>
        <ul className="divide-y">
          {guests.map(g => (
            <li key={g.id} className="py-2 flex justify-between">
              <span>{g.full_name}</span>
              <span className="text-sm text-slate-600">{g.role}{g.username ? ` • ${g.username}` : ''}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
