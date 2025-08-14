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

  // moje uprawnienia / powiązanie
  const [isOrganizer, setIsOrganizer] = useState(false)
  const [weddingId, setWeddingId] = useState('')
  const [fullName, setFullName] = useState('')

  async function refresh() {
    setErr(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErr('Brak sesji.'); return }

    const { data: mine } = await supabase
      .from('guests')
      .select('role,wedding_id,full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    setIsOrganizer(mine?.role === 'organizer')
    setWeddingId(mine?.wedding_id || weddingId)
    setFullName(mine?.full_name || fullName)

    const { data } = await supabase.from('guests').select('id,full_name,username,role').order('full_name')
    setGuests(data ?? [])
  }

  useEffect(() => { refresh() }, [])

  async function linkMe(e: React.FormEvent) {
    e.preventDefault()
    setErr(null); setMsg(null)
    const res = await fetch('/api/admin/link-self', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weddingId, fullName })
    })
    const j = await res.json()
    if (!res.ok) { setErr(j.error || 'Błąd'); return }
    setMsg('Połączono Twoje konto z weselem.')
    await refresh()
  }

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
    await refresh()
  }

  return (
    <div className="space-y-6">
      <h1>Admin</h1>

      {/* Sekcja dostępna ZAWSZE – połączenie konta z weselem */}
      <form onSubmit={linkMe} className="grid gap-3 md:grid-cols-3 items-end">
        <div>
          <label className="text-sm font-medium">wedding_id</label>
          <input className="border rounded p-2 w-full" placeholder="UUID wesela"
                 value={weddingId} onChange={e=>setWeddingId(e.target.value)} />
        </div>
        <div>
          <label className="text-sm font-medium">Twoje imię i nazwisko</label>
          <input className="border rounded p-2 w-full" placeholder="np. Damian Tomczyk"
                 value={fullName} onChange={e=>setFullName(e.target.value)} />
        </div>
        <button className="btn">Połącz moje konto z weselem</button>
      </form>

      {!isOrganizer ? (
        <p className="text-slate-600">Sprawdzanie uprawnień… (zaloguj się jako organizator lub
          połącz konto powyżej)</p>
      ) : (
        <>
          <h2 className="text-lg font-semibold">Konta gości</h2>
          <form onSubmit={createGuest} className="grid gap-3 md:grid-cols-4">
            <input className="border rounded p-2" placeholder="Imię" value={firstName} onChange={e=>setFirst(e.target.value)} />
            <input className="border rounded p-2" placeholder="Nazwisko" value={lastName} onChange={e=>setLast(e.target.value)} />
            <input className="border rounded p-2" type="password" placeholder="Hasło" value={password} onChange={e=>setPass(e.target.value)} />
            <button className="btn">Utwórz konto gościa</button>
          </form>

          <div>
            <h3 className="text-lg font-semibold mb-2">Lista gości</h3>
            <ul className="divide-y">
              {guests.map(g => (
                <li key={g.id} className="py-2 flex justify-between">
                  <span>{g.full_name}</span>
                  <span className="text-sm text-slate-600">{g.role}{g.username ? ` • ${g.username}` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
