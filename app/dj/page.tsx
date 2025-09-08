'use client'

import { useEffect, useState } from 'react'

type Req = {
  id: number
  title: string
  artist: string | null
  note: string | null
  status: 'queued' | 'played' | 'rejected'
  created_at: string
}
type ApiList = { ok: true; items: Req[]; votes: Record<number, number> }

export default function DJPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [token, setToken] = useState('')
  const [data, setData] = useState<ApiList | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function check() {
    setErr(null)
    const res = await fetch('/api/dj/requests/list', { cache: 'no-store' })
    if (res.status === 401) { setAuthed(false); setData(null); return }
    const j = await res.json()
    if (!res.ok) { setErr(j.error || 'Błąd'); setAuthed(false); return }
    setAuthed(true); setData(j)
  }

  useEffect(() => { check().catch(()=>{}) }, [])

  async function login(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setErr(null)
    const res = await fetch('/api/dj/login', {
      method: 'POST', headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ token })
    })
    const j = await res.json().catch(()=>({}))
    if (!res.ok) { setErr(j.error || 'Zły token'); setAuthed(false) }
    else { setToken(''); await check() }
    setLoading(false)
  }

  async function setStatus(id: number, status: Req['status']) {
    const res = await fetch('/api/dj/requests/update', {
      method: 'POST', headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id, status })
    })
    if (!res.ok) {
      const j = await res.json().catch(()=>({}))
      setErr(j.error || 'Nie udało się zmienić statusu')
    } else {
      await check()
    }
  }

  async function logout() {
    await fetch('/api/dj/logout', { method: 'POST' })
    setAuthed(false); setData(null)
  }

  if (authed === false) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Panel DJ/MC</h1>
        <form onSubmit={login} className="space-y-2">
          <input className="border rounded p-2 w-full" placeholder="Wpisz token" value={token} onChange={e=>setToken(e.target.value)} />
          <button className="btn w-full disabled:opacity-50" disabled={!token || loading}>
            {loading ? 'Sprawdzam…' : 'Zaloguj'}
          </button>
        </form>
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </div>
    )
  }

  if (authed && !data) return <div className="p-6">Ładowanie…</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel DJ/MC</h1>
        <button className="btn" onClick={logout}>Wyloguj</button>
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      <div className="text-sm text-slate-600">
        Kolejność: <em>W kolejce</em> (najpierw najwięcej głosów) → <em>Zagrane</em> → <em>Odrzucone</em>
        <button className="ml-3 underline" onClick={check}>Odśwież</button>
      </div>

      <ul className="divide-y">
        {data!.items.map(r => (
          <li key={r.id} className="py-3 flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold">{r.title}{r.artist ? ` — ${r.artist}` : ''}</div>
              {r.note && <div className="text-sm text-slate-600">{r.note}</div>}
              <div className="text-xs text-slate-500 mt-1">
                {r.status === 'queued' ? 'W kolejce' : r.status === 'played' ? 'Zagrane' : 'Odrzucone'}
                {typeof data!.votes[r.id] === 'number' && ` • głosy: ${data!.votes[r.id]}`}
                {' • '}{new Date(r.created_at).toLocaleString()}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded border" onClick={()=>setStatus(r.id, 'queued')}>Kolejka</button>
              <button className="px-3 py-1 rounded border" onClick={()=>setStatus(r.id, 'played')}>Zagrane</button>
              <button className="px-3 py-1 rounded border" onClick={()=>setStatus(r.id, 'rejected')}>Odrzuć</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
