'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Row = { id: string; title: string; artist: string | null; status: 'pending'|'played'|'rejected'; votes: number }

const REFRESH_MS = 300000

export default function DjBoxPage() {
  const router = useRouter()
  const [pending, setPending] = useState<Row[]>([])
  const [played, setPlayed] = useState<Row[]>([])
  const [rejected, setRejected] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  // ====== ładowanie listy ======
  async function load(silent = false) {
    if (!silent) setLoading(true)
    setErr(null)
    try {
      const res = await fetch('/api/dj/list', { cache: 'no-store' })
      if (res.status === 401) { router.replace('/dj/login'); return }
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Błąd pobierania')

      // nie nadpisuj pozycji, które są w trakcie zmiany (busy)
      const skip = (r: Row) => busyIds.has(r.id)
      setPending(j.pending.filter((r: Row) => !skip(r)))
      setPlayed(j.played.filter((r: Row) => !skip(r)))
      setRejected(j.rejected.filter((r: Row) => !skip(r)))
    } catch (e:any) {
      setErr(e?.message || 'Błąd')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ====== auto-refresh (pauza w tle) ======
  useEffect(() => {
    const tick = () => { if (!document.hidden) load(true) }
    const id = setInterval(tick, REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick) }
  }, [])

  // ====== optymistyczne przenoszenie ======
  function pullFromAll(id: string): { item: Row | null } {
    let item: Row | null = null
    const take = (list: Row[], setter: (x: Row[]) => void) => {
      if (item) return
      const i = list.findIndex(r => r.id === id)
      if (i >= 0) { item = list[i]; setter([...list.slice(0, i), ...list.slice(i + 1)]) }
    }
    take(pending, setPending); take(played, setPlayed); take(rejected, setRejected)
    return { item }
  }
  const sortByVotes = (xs: Row[]) => [...xs].sort((a,b) => (b.votes||0) - (a.votes||0))
  function pushTo(status: Row['status'], row: Row) {
    const r = { ...row, status }
    if (status === 'pending')  setPending(s => sortByVotes([r, ...s]))
    if (status === 'played')   setPlayed(s => [r, ...s])
    if (status === 'rejected') setRejected(s => [r, ...s])
  }

  async function setStatus(id: string, status: Row['status']) {
    setErr(null)
    const { item } = pullFromAll(id)
    if (!item) return
    pushTo(status, item)
    setBusyIds(prev => new Set(prev).add(id))

    try {
      const res = await fetch('/api/dj/set-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      })
      if (!res.ok) {
        // rollback
        pullFromAll(id)
        pushTo(item.status, item)
        const j = await res.json().catch(()=>({}))
        throw new Error(j.error || 'Błąd zmiany statusu')
      }
      // delikatny re-sync w tle
      setTimeout(() => load(true), 0)
    } catch (e:any) {
      setErr(e?.message || 'Błąd')
    } finally {
      setBusyIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  // ====== USUWANIE (DJ) ======
  async function removeReq(id: string) {
    setErr(null)
    const { item } = pullFromAll(id)  // optymistycznie z list
    if (!item) return
    setBusyIds(prev => new Set(prev).add(id))

    try {
      const res = await fetch('/api/dj/requests/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (!res.ok) {
        // rollback
        pushTo(item.status, item)
        const j = await res.json().catch(()=>({}))
        throw new Error(j.error || 'Nie udało się usunąć')
      }
      setTimeout(() => load(true), 0)
    } catch (e:any) {
      setErr(e?.message || 'Błąd usuwania')
    } finally {
      setBusyIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  async function clearPlayed() {
    setErr(null)
    const moved = played
    setRejected(s => [...moved.map(r => ({ ...r, status: 'rejected' as const })), ...s])
    setPlayed([])
    const res = await fetch('/api/dj/clear-played', { method: 'POST' })
    if (!res.ok) {
      setPlayed(moved)
      setRejected(s => s.slice(moved.length))
      const j = await res.json().catch(()=>({}))
      setErr(j.error || 'Błąd czyszczenia')
    } else {
      setTimeout(() => load(true), 0)
    }
  }

  async function logout() {
    await fetch('/api/dj/logout', { method: 'POST' })
    router.replace('/dj/login')
  }

  const pSorted = useMemo(() => sortByVotes(pending), [pending])

  if (loading) return <p>Ładowanie…</p>

  const Btn = ({ onClick, disabled, children }: any) => (
    <button className="btn disabled:opacity-50" onClick={onClick} disabled={disabled}>{children}</button>
  )
  const Line = ({ r, actions }: { r: Row; actions: React.ReactNode }) => (
    <li className="py-2 flex items-center justify-between gap-2">
      <div>
        <div className="font-medium">{r.title}</div>
        <div className="text-xs text-slate-600">{r.artist || ''}</div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm">👍 {r.votes || 0}</span>
        {actions}
      </div>
    </li>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">DJ box – prośby o piosenki</h1>
        <div className="flex gap-2">
          <Btn onClick={()=>load()}>Odśwież</Btn>
          <Btn onClick={clearPlayed}>Wyczyść zagrane → odrzucone</Btn>
          <Btn onClick={logout}>Wyloguj</Btn>
        </div>
      </div>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      <section>
        <h2 className="text-lg font-semibold mb-2">Oczekujące</h2>
        {!pSorted.length && <p className="text-slate-600">Brak.</p>}
        <ul className="divide-y">
          {pSorted.map(r => (
            <Line key={r.id} r={r} actions={
              <>
                <Btn onClick={()=>setStatus(r.id,'played')}   disabled={busyIds.has(r.id)}>Zagrane</Btn>
                <Btn onClick={()=>setStatus(r.id,'rejected')} disabled={busyIds.has(r.id)}>Odrzuć</Btn>
                <Btn onClick={()=>removeReq(r.id)}            disabled={busyIds.has(r.id)}>Usuń</Btn>
              </>
            }/>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Zagrane</h2>
        {!played.length && <p className="text-slate-600">Brak.</p>}
        <ul className="divide-y">
          {played.map(r => (
            <Line key={r.id} r={r} actions={
              <>
                <Btn onClick={()=>setStatus(r.id,'pending')}  disabled={busyIds.has(r.id)}>Cofnij</Btn>
                <Btn onClick={()=>setStatus(r.id,'rejected')} disabled={busyIds.has(r.id)}>Odrzuć</Btn>
                <Btn onClick={()=>removeReq(r.id)}            disabled={busyIds.has(r.id)}>Usuń</Btn>
              </>
            }/>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Odrzucone</h2>
        {!rejected.length && <p className="text-slate-600">Brak.</p>}
        <ul className="divide-y">
          {rejected.map(r => (
            <Line key={r.id} r={r} actions={
              <div className="flex gap-2">
                <Btn onClick={()=>setStatus(r.id,'pending')} disabled={busyIds.has(r.id)}>Przywróć</Btn>
                <Btn onClick={()=>removeReq(r.id)}          disabled={busyIds.has(r.id)}>Usuń</Btn>
              </div>
            }/>
          ))}
        </ul>
      </section>
    </div>
  )
}
