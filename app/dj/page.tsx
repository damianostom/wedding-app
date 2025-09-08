// app/dj/page.tsx
'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'

type RequestRow = {
  id: string
  title: string
  artist: string | null
  created_at: string
  user_id: string | null
  status: 'pending' | 'played' | 'rejected' | null
}
type VoteRow = { request_id: string; user_id: string }

export default function DJPage() {
  const supabase = supaClient()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [isOrganizer, setIsOrganizer] = useState(false)

  const [reqs, setReqs] = useState<RequestRow[]>([])
  const [votes, setVotes] = useState<VoteRow[]>([])
  const [err, setErr] = useState<string | null>(null)

  // Formularz do logowania tokenem (gdy ktoś wejdzie bez sesji)
  const [token, setToken] = useState('')
  const [widInput, setWidInput] = useState('')

  async function loadAll() {
    setErr(null)
    const wid = await getMyWeddingId()
    setWeddingId(wid)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: me } = await supabase.from('guests').select('role').eq('user_id', user.id).maybeSingle()
      setIsOrganizer(me?.role === 'organizer')
    } else {
      setIsOrganizer(false)
    }

    // prośby
    const { data: rs, error: e1 } = await supabase
      .from('song_requests')
      .select('id,title,artist,created_at,user_id,status')
      .eq('wedding_id', wid)
      .order('created_at', { ascending: false })
    if (e1) setErr(e1.message)
    setReqs(rs ?? [])

    // głosy
    const ids = (rs ?? []).map(r => r.id)
    if (ids.length) {
      const { data: vs } = await supabase.from('song_votes')
        .select('request_id,user_id')
        .in('request_id', ids)
      setVotes(vs ?? [])
    } else {
      setVotes([])
    }
  }

  useEffect(() => { loadAll().catch(e => setErr(String(e))) }, [])

  const voteCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of votes) m.set(v.request_id, (m.get(v.request_id) ?? 0) + 1)
    return m
  }, [votes])

  const pending = useMemo(() => (reqs ?? []).filter(r => !r.status || r.status === 'pending'), [reqs])
  const played  = useMemo(() => (reqs ?? []).filter(r => r.status === 'played'), [reqs])
  const rejected= useMemo(() => (reqs ?? []).filter(r => r.status === 'rejected'), [reqs])

  async function setStatus(id: string, status: 'pending' | 'played' | 'rejected') {
    setErr(null)
    const { data, error } = await supabase
      .from('song_requests')
      .update({ status })
      .eq('id', id)
      .select('id,status')
      .single()
    if (error) { setErr(error.message); return }
    setReqs(prev => prev.map(r => r.id === id ? { ...r, status: data!.status } : r))
  }

  async function clearPlayed() {
    if (!confirm('Usunąć oznaczenie „zagrane” (albo przenieść wszystko do „odrzucone”)?')) return
    const { error } = await supabase
      .from('song_requests')
      .update({ status: 'rejected' })
      .eq('wedding_id', weddingId)
      .eq('status', 'played')
    if (error) { setErr(error.message); return }
    await loadAll()
  }

  async function tokenLogin(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const wid = widInput.trim()
    const res = await fetch('/api/auth/token-login', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ token: token.trim(), weddingId: wid })
    })
    const j = await res.json().catch(()=>({}))
    if (!res.ok) { setErr(j.error || 'Nie udało się zalogować.'); return }
    setToken(''); setWidInput('')
    await loadAll()
  }

  // jeśli brak uprawnień – pokaż logowanie tokenem
  if (!isOrganizer) {
    return (
      <div className="max-w-md mx-auto space-y-4">
        <h1 className="text-2xl font-bold">DJ box</h1>
        <p className="text-slate-600 text-sm">
          Wygląda na to, że nie masz uprawnień organizatora. Zaloguj się stałym tokenem.
        </p>
        <form onSubmit={tokenLogin} className="space-y-2">
          <input className="w-full border rounded p-2" placeholder="wedding_id" value={widInput} onChange={e=>setWidInput(e.target.value)} />
          <input className="w-full border rounded p-2" placeholder="Token dla DJ-a" value={token} onChange={e=>setToken(e.target.value)} />
          <button className="btn w-full">Zaloguj</button>
        </form>
        {err && <p className="text-red-600 text-sm">{err}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">DJ box – prośby o piosenki</h1>
        <button className="btn" onClick={clearPlayed}>Wyczyść zagrane → odrzucone</button>
      </div>
      {err && <p className="text-red-600 text-sm">{err}</p>}

      {/* Oczekujące */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Oczekujące</h2>
        {!pending.length ? <p className="text-slate-600">Brak.</p> : (
          <ul className="divide-y">
            {pending
              .slice()
              .sort((a,b)=>(voteCount.get(b.id) ?? 0)-(voteCount.get(a.id) ?? 0))
              .map(r => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{r.title}{r.artist ? ` — ${r.artist}` : ''}</div>
                  <div className="text-xs text-slate-600">👍 {voteCount.get(r.id) ?? 0}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn" onClick={()=>setStatus(r.id,'played')}>Zagrane</button>
                  <button className="btn" onClick={()=>setStatus(r.id,'rejected')}>Odrzuć</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Zagrane */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Zagrane</h2>
        {!played.length ? <p className="text-slate-600">Brak.</p> : (
          <ul className="divide-y">
            {played.map(r => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                <span>{r.title}{r.artist ? ` — ${r.artist}` : ''}</span>
                <button className="btn" onClick={()=>setStatus(r.id,'pending')}>Przywróć</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Odrzucone */}
      <section>
        <h2 className="text-lg font-semibold mb-2">Odrzucone</h2>
        {!rejected.length ? <p className="text-slate-600">Brak.</p> : (
          <ul className="divide-y">
            {rejected.map(r => (
              <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                <span>{r.title}{r.artist ? ` — ${r.artist}` : ''}</span>
                <button className="btn" onClick={()=>setStatus(r.id,'pending')}>Przywróć</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
