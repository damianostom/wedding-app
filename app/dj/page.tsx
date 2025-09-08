'use client'

import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'

type Req = { id: string; title: string; artist: string|null; status: 'pending'|'played'|'rejected'; votes: number }

export default function DjPage() {
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [pending, setPending]   = useState<Req[]>([])
  const [played, setPlayed]     = useState<Req[]>([])
  const [rejected, setRejected] = useState<Req[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      const j = await fetch('/api/dj/session').then(r=>r.json()).catch(()=>({ ok:false }))
      if (!j?.ok) { window.location.assign('/dj/login'); return }
      setWeddingId(j.weddingId as string)
      await refresh()
    })()
  }, [])

  async function refresh() {
    setErr(null)
    const res = await fetch('/api/dj/list')
    const j = await res.json().catch(()=>({}))
    if (!res.ok) { setErr(j.error || 'Błąd listy'); return }
    setPending(j.pending); setPlayed(j.played); setRejected(j.rejected)
  }

  async function setStatus(id: string, status: 'pending'|'played'|'rejected') {
    const res = await fetch('/api/dj/set-status', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id, status })
    })
    if (res.ok) await refresh()
  }

  async function clearPlayedToRejected() {
    const res = await fetch('/api/dj/clear-played', { method:'POST' })
    if (res.ok) await refresh()
  }

  const Box = ({title, items, actions}:{title:string; items:Req[]; actions:(r:Req)=>JSX.Element}) => (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {!items.length ? <p className="text-slate-600">Brak.</p> : (
        <ul className="divide-y">
          {items.map(r => (
            <li key={r.id} className="py-2 flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-slate-600">{r.artist || ''} • 👍 {r.votes}</div>
              </div>
              {actions(r)}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  if (!weddingId) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">DJ box – prośby o piosenki</h1>
        <div className="flex gap-2">
          <a className="btn" href="/app">Panel</a>
          <a className="btn" href="/dj/login">Wyloguj</a>
        </div>
      </div>

      <button className="btn" onClick={clearPlayedToRejected}>
        Wyczyść zagrane → odrzucone
      </button>

      {err && <p className="text-sm text-red-600">{err}</p>}

      <Box title="Oczekujące" items={pending}
           actions={(r)=>(
             <div className="flex gap-2">
               <button className="btn" onClick={()=>setStatus(r.id,'played')}>Oznacz: zagrane</button>
               <button className="btn" onClick={()=>setStatus(r.id,'rejected')}>Odrzuć</button>
             </div>
           )} />

      <Box title="Zagrane" items={played}
           actions={(r)=>(<button className="btn" onClick={()=>setStatus(r.id,'pending')}>Przywróć</button>)} />

      <Box title="Odrzucone" items={rejected}
           actions={(r)=>(<button className="btn" onClick={()=>setStatus(r.id,'pending')}>Przywróć</button>)} />
    </div>
  )
}
