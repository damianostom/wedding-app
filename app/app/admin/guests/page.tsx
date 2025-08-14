'use client'

import { useEffect, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'

type Guest = { id: string; full_name: string; username: string | null; role: string; user_id: string | null; is_active: boolean }

export default function AdminGuests() {
  const supabase = supaClient()
  const [guests, setGuests] = useState<Guest[]>([])
  const [weddingId, setWeddingId] = useState('')
  const [fullName, setFullName] = useState('')

  const [firstName, setFirst] = useState('')
  const [lastName, setLast] = useState('')
  const [password, setPass] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)

  async function refresh() {
    setErr(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErr('Brak sesji.'); return }
    const { data: mine } = await supabase.from('guests').select('role,wedding_id,full_name').eq('user_id', user.id).maybeSingle()
    if (mine) { setIsOrganizer(mine.role === 'organizer'); setWeddingId(mine.wedding_id || ''); setFullName(mine.full_name || '') }
    const { data } = await supabase.from('guests').select('id,full_name,username,role,user_id,is_active').order('full_name')
    setGuests(data ?? [])
  }
  useEffect(() => { refresh().catch(setErr as any) }, [])

  async function linkMe(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setErr(null)
    const res = await fetch('/api/admin/link-self',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ weddingId, fullName }) })
    const j = await res.json().catch(()=>({}))
    if (!res.ok) { setErr(j.error || 'Błąd'); return }
    setMsg('Połączono Twoje konto z weselem.'); await refresh()
  }
  async function createGuest(e: React.FormEvent) {
    e.preventDefault(); setMsg(null); setErr(null)
    const res = await fetch('/api/admin/create-guest',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ firstName, lastName, password }) })
    const j = await res.json().catch(()=>({}))
    if (!res.ok) { setErr(j.error || 'Błąd'); return }
    setMsg(`Utworzono/ustawiono konto: ${j.username}`); setFirst(''); setLast(''); setPass(''); await refresh()
  }

  async function toggleActive(g: Guest) {
    const res = await fetch('/api/admin/toggle-active',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ guestId: g.id, isActive: !g.is_active }) })
    if (res.ok) { setGuests(prev => prev.map(x => x.id === g.id ? { ...x, is_active: !g.is_active } : x)) }
  }
  async function resetPassword(g: Guest) {
    const newPassword = prompt(`Nowe hasło dla: ${g.full_name}`)
    if (!newPassword) return
    const res = await fetch('/api/admin/reset-password',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: g.user_id, newPassword }) })
    const j = await res.json().catch(()=>({}))
    if (!res.ok) alert(j.error || 'Błąd resetu hasła'); else alert('Hasło zmienione.')
  }
  async function deleteUser(g: Guest) {
    if (!confirm(`Usunąć konto ${g.full_name}? (nieodwracalne)`)) return
    const res = await fetch('/api/admin/delete-user',{ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: g.user_id, guestId: g.id }) })
    const j = await res.json().catch(()=>({}))
    if (!res.ok) alert(j.error || 'Błąd usuwania'); else setGuests(prev => prev.filter(x => x.id !== g.id))
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin</h1>

      <form onSubmit={linkMe} className="grid gap-3 md:grid-cols-3 items-end">
        <div>
          <label className="text-sm font-medium">wedding_id</label>
          <input className="border rounded p-2 w-full" value={weddingId} onChange={(e)=>setWeddingId(e.target.value)} placeholder="UUID wesela" />
        </div>
        <div>
          <label className="text-sm font-medium">Twoje imię i nazwisko</label>
          <input className="border rounded p-2 w-full" value={fullName} onChange={(e)=>setFullName(e.target.value)} placeholder="np. Damian Tomczyk" />
        </div>
        <button className="btn">Połącz moje konto z weselem</button>
      </form>

      {!isOrganizer ? (
        <p className="text-slate-600">Sprawdzanie uprawnień…</p>
      ) : (
        <>
          <h2 className="text-lg font-semibold">Konta gości</h2>
          <form onSubmit={createGuest} className="grid gap-3 md:grid-cols-4">
            <input className="border rounded p-2" placeholder="Imię" value={firstName} onChange={(e)=>setFirst(e.target.value)} />
            <input className="border rounded p-2" placeholder="Nazwisko" value={lastName} onChange={(e)=>setLast(e.target.value)} />
            <input className="border rounded p-2" type="password" placeholder="Hasło" value={password} onChange={(e)=>setPass(e.target.value)} />
            <button className="btn">Utwórz konto gościa</button>
          </form>

          <ul className="divide-y">
            {guests.map(g => (
              <li key={g.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">{g.full_name}</div>
                  <div className="text-sm text-slate-600">{g.role}{g.username ? ` • ${g.username}` : ''}{!g.is_active ? ' • nieaktywne' : ''}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn" onClick={()=>toggleActive(g)}>{g.is_active ? 'Dezaktywuj' : 'Aktywuj'}</button>
                  <button className="btn" onClick={()=>resetPassword(g)} disabled={!g.user_id}>Zmień hasło</button>
                  <button className="btn" onClick={()=>deleteUser(g)}>Usuń</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {msg && <div className="text-green-700 text-sm">{msg}</div>}
      {err && <div className="text-red-600 text-sm">{err}</div>}
    </div>
  )
}
