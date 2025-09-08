// app/dj/page.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Row = { id: string; title: string; artist: string | null; status: 'pending'|'played'|'rejected'; votes: number }

export default function DjBoxPage() {
  const router = useRouter()
  const [pending, setPending] = useState<Row[]>([])
  const [played, setPlayed]   = useState<Row[]>([])
  const [rejected, setRejected] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setErr(null)
    try {
      const res = await fetch('/api/dj/list', { cache: 'no-store' })
      if (res.status === 401) { router.replace('/dj/login'); return }
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Błąd pobierania')
      setPending(j.pending || []); setPlayed(j.played || []); setRejected(j.rejected || [])
    } catch (e: any) {
      setErr(e?.message || 'Błąd')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function setStatus(id: string, status: 'pending'|'played'|'rejected') {
    setErr(null)
    const res = await fetch('/api/dj/set-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    })
    const j = await res.json().catch(()=>({}))
    if (!res.ok) { setErr(j.error || 'Błąd zmiany statusu'); return }
    await load()
  }

  async function clearPlayed() {
    setErr(null)
    const res = await fetch('/api/dj/clear-played', { method: 'POST' })
    const j = await res.json().catch(()=>({}))
    if (!res.ok) { setErr(j.error || 'Błąd czyszczenia'); return }
    await load()
  }

  async function logout() {
    await fetch('/api/dj/logout', { method: 'POST' })
    router.replace('/dj/login')
  }

  const sortPending = useMemo(
    () => [...pending].sort((a,b) => (b.votes ?? 0) - (a.votes ?? 0)),
    [pending]
  )

  if (loading) return <p>Ładowanie…</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">DJ box – prośby o piosenki</h1>
        <div className="flex gap-2">
          <button className="btn" onClick={clearPlayed}>Wyczyść zagrane → odrzucone</button>
          <button className="btn" onClick={logout}>Wyloguj</button>
        </div>
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      {/* OCZEKUJĄCE */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Oczekujące</h2>
        {!sortPending.length && <p className="text-slate-600">Brak.</p>}
        <ul className="divide-y">
          {sortPending.map(r => (
            <li key={r.id} className="py-2 flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-slate-600">{r.artist || ''}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm">👍 {r.votes || 0}</span>
                <button className="btn" onClick={()=>setStatus(r.id,'played')}>Zagrane</button>
                <button className="btn" onClick={()=>setStatus(r.id,'rejected')}>Odrzuć</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ZAGRANE */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Zagrane</h2>
        {!played.length && <p className="text-slate-600">Brak.</p>}
        <ul className="divide-y">
          {played.map(r => (
            <li key={r.id} className="py-2 flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-slate-600">{r.artist || ''}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm">👍 {r.votes || 0}</span>
                <button className="btn" onClick={()=>setStatus(r.id,'pending')}>Cofnij</button>
                <button className="btn" onClick={()=>setStatus(r.id,'rejected')}>Odrzuć</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ODRZUCONE */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Odrzucone</h2>
        {!rejected.length && <p className="text-slate-600">Brak.</p>}
        <ul className="divide-y">
          {rejected.map(r => (
            <li key={r.id} className="py-2 flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-slate-600">{r.artist || ''}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm">👍 {r.votes || 0}</span>
                <button className="btn" onClick={()=>setStatus(r.id,'pending')}>Przywróć</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
