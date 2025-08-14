'use client'

import { useEffect, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'

type Guest = { id: string; full_name: string; username: string | null; role: string }

export default function AdminGuests() {
  const supabase = supaClient()

  // lista gości
  const [guests, setGuests] = useState<Guest[]>([])

  // formularz podpięcia siebie do wesela
  const [weddingId, setWeddingId] = useState('')
  const [fullName, setFullName] = useState('')

  // formularz tworzenia gościa (tylko organizer)
  const [firstName, setFirst] = useState('')
  const [lastName, setLast] = useState('')
  const [password, setPass] = useState('')

  const [isOrganizer, setIsOrganizer] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function refresh() {
    setErr(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErr('Brak sesji.'); return }

    // mój rekord w guests (jeśli jest)
    const { data: mine } = await supabase
      .from('guests')
      .select('role,wedding_id,full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (mine) {
      setIsOrganizer(mine.role === 'organizer')
      setWeddingId(mine.wedding_id || '')
      setFullName(mine.full_name || '')
    }

    // lista gości (jeśli polityki pozwalają)
    const { data } = await supabase
      .from('guests')
      .select('id,full_name,username,role')
      .order('full_name')
    setGuests(data ?? [])
  }

  useEffect(() => {
    // nie-inline, żeby nie zrobić niespodziewanej pętli
    refresh().catch(e => setErr(String(e)))
  }, []) // mount only

  async function linkMe(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null); setErr(null)
    const res = await fetch('/api/admin/link-self', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weddingId, fullName })
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(j.error || 'Błąd połączenia konta.'); return }
    setMsg('Połączono Twoje konto z weselem.')
    await refresh()
  }

  async function createGuest(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null); setErr(null)
    const res = await fetch('/api/admin/create-guest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, password })
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(j.error || 'Błąd tworzenia gościa.'); return }
    setMsg(`Utworzono/ustawiono konto: ${j.username}`)
    setFirst(''); setLast(''); setPass('')
    await refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      {/* Dostępne dla każdego — najpierw podepnij konto do wesela */}
      <form onSubmit={linkMe} className="grid gap-3 md:grid-cols-3 items-end">
        <div>
          <label className="text-sm font-medium">wedding_id</label>
          <input
            className="border rounded p-2 w-full"
            placeholder="UUID wesela"
            value={weddingId}
            onChange={(e) => setWeddingId(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Twoje imię i nazwisko</label>
          <input
            className="border rounded p-2 w-full"
            placeholder="np. Damian Tomczyk"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>
        <button className="btn">Połącz moje konto z weselem</button>
      </form>

      {!isOrganizer ? (
        <p className="text-slate-600">
          Sprawdzanie uprawnień… (jeśli nie widzisz listy gości powyżej, najpierw połącz konto z weselem).
        </p>
      ) : (
        <>
          <h2 className="text-lg font-semibold">Konta gości</h2>

          <form onSubmit={createGuest} className="grid gap-3 md:grid-cols-4">
            <input className="border rounded p-2" placeholder="Imię" value={firstName} onChange={(e) => setFirst(e.target.value)} />
            <input className="border rounded p-2" placeholder="Nazwisko" value={lastName} onChange={(e) => setLast(e.target.value)} />
            <input className="border rounded p-2" placeholder="Hasło" type="password" value={password} onChange={(e) => setPass(e.target.value)} />
            <button className="btn">Utwórz konto gościa</button>
          </form>

          <div>
            <h3 className="text-lg font-semibold mb-2">Lista gości</h3>
            <ul className="divide-y">
              {guests.map((g) => (
                <li key={g.id} className="py-2 flex justify-between">
                  <span>{g.full_name}</span>
                  <span className="text-sm text-slate-600">
                    {g.role}
                    {g.username ? ` • ${g.username}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}

      {msg && <div className="text-green-700 text-sm">{msg}</div>}
      {err && <div className="text-red-600 text-sm">{err}</div>}
    </div>
  )
}
