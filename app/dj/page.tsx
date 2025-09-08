'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type Row = { id: string; title: string; artist: string | null; status: 'pending'|'played'|'rejected'; votes: number }

export default function DjBoxPage() {
  const router = useRouter()
  const [pending, setPending] = useState<Row[]>([])
  const [played, setPlayed] = useState<Row[]>([])
  const [rejected, setRejected] = useState<Row[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  async function load() {
    setErr(null)
    try {
      const res = await fetch('/api/dj/list', { cache: 'no-store' })
      if (res.status === 401) { router.replace('/dj/login'); return }
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Błąd pobierania')
      setPending(j.pending || []); setPlayed(j.played || []); setRejected(j.rejected || [])
    } catch (e:any) {
      setErr(e?.message || 'Błąd')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // ====== OPTYMISTYCZNE PRZENOSZENIE ======
  function pullFromAll(id: string): { item: Row | null } {
    let item: Row | null = null
    const take = (list: Row[], setter: (x: Row[]) => void) => {
      if (item) return
      if (list.some(r => r.id === id)) {
        const idx = list.findIndex(r => r.id === id)
        item = list[idx]
        setter([...list.slice(0, idx), ...list.slice(idx + 1)])
      }
    }
    take(pending, setPending); take(played, setPlayed); take(rejected, setRejected)
    return { item }
  }

  function pushTo(status: Row['status'], row: Row) {
    const withStatus = { ...row, status }
    if (status === 'pending')  setPending(s => sortByVotes([withStatus, ...s]))
    if (status === 'played')   setPlayed(s => [withStatus, ...s])
    if (status === 'rejected') setRejected(s => [withStatus, ...s])
  }

  const sortByVotes = (xs: Row[]) => [...xs].sort((a,b) => (b.votes||0) - (a.votes||0))

  async function setStatus(id: string, status: Row['status']) {
    setErr(null)
    // optimistycznie przenieś
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
      // na wszelki wypadek lekki „re-sync” w tle (bez odczuwalnego laga)
      setTimeout(() => load(), 0)
    } catch (e:any) {
      setErr(e?.message || 'Błąd')
    } finally {
      setBusyIds(prev => { const n = new Set(prev); n.delete(id); return n })
    }
  }

  async function clearPlayed() {
    setErr(null)
    // optymistycznie przenieś wszystkie „played” do „rejected”
    const moved = played
    setRejected(s => [...moved.map(r => ({ ...r, status: 'rejected' as const })), ...s])
    setPlayed([])

    const res = await fetch('/api/dj/clear-played', { method: 'POST' })
    if (!res.ok) {
      // rollback
      setPlayed(moved)
      setRejected(s => s.slice(moved.length))
      const j = await res.json().catch(()=>({}))
      setErr(j.error || 'Błąd czyszczenia')
    } else {
      setTimeout(() => load(), 0)
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
              <Btn onClick={()=>setStatus(r.id,'pending')} disabled={busyIds.has(r.id)}>Przywróć</Btn>
            }/>
          ))}
        </ul>
      </section>
    </div>
  )
}
