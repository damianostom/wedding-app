'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'
import type { RealtimeChannel } from '@supabase/supabase-js'

type Req = {
  id: number
  title: string
  artist: string | null
  note: string | null
  status: 'queued' | 'played' | 'rejected'
  created_at: string
}

export default function SongsPage() {
  const supabase = supaClient()
  const [wid, setWid] = useState<string | null>(null)
  const [meId, setMeId] = useState<string | null>(null)

  const [list, setList] = useState<Req[]>([])
  const [votes, setVotes] = useState<Record<number, number>>({})
  const [myVotes, setMyVotes] = useState<Set<number>>(new Set())

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)

  const chRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    ;(async () => {
      setErr(null)
      const w = await getMyWeddingId()
      if (!w) { setErr('Brak powiązania z weselem.'); return }
      setWid(w)

      const { data: { user } } = await supabase.auth.getUser()
      setMeId(user?.id ?? null)

      // pobierz requesty
      const { data: reqs, error: e1 } = await supabase
        .from('song_requests')
        .select('id,title,artist,note,status,created_at')
        .eq('wedding_id', w)
        .order('created_at', { ascending: false })
      if (e1) { setErr(e1.message); return }
      setList(reqs as Req[])

      // pobierz głosy dla tych requestów
      const ids = (reqs ?? []).map(r => r.id)
      if (ids.length) {
        const { data: vs } = await supabase
          .from('song_votes')
          .select('request_id, user_id')
          .in('request_id', ids)
        const counts: Record<number, number> = {}
        const mine = new Set<number>()
        for (const v of vs ?? []) {
          counts[v.request_id] = (counts[v.request_id] ?? 0) + 1
          if (v.user_id && v.user_id === user?.id) mine.add(v.request_id)
        }
        setVotes(counts)
        setMyVotes(mine)
      }

      // realtime
      const ch = supabase.channel(`songs:${w}`)
      ch.on('postgres_changes',
        { event: '*', schema: 'public', table: 'song_requests', filter: `wedding_id=eq.${w}` },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setList(prev => [payload.new as Req, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            const n = payload.new as Req
            setList(prev => prev.map(x => x.id === n.id ? { ...x, ...n } : x))
          } else if (payload.eventType === 'DELETE') {
            const id = payload.old.id as number
            setList(prev => prev.filter(x => x.id !== id))
            setVotes(prev => { const c = { ...prev }; delete c[id]; return c })
            setMyVotes(prev => { const s = new Set(prev); s.delete(id); return s })
          }
        })
      ch.on('postgres_changes',
        { event: '*', schema: 'public', table: 'song_votes' },
        (payload: any) => {
          const reqId = (payload.new?.request_id ?? payload.old?.request_id) as number
          if (!reqId) return
          if (payload.eventType === 'INSERT') {
            setVotes(prev => ({ ...prev, [reqId]: (prev[reqId] ?? 0) + 1 }))
            if (payload.new?.user_id === meId) setMyVotes(prev => new Set(prev).add(reqId))
          } else if (payload.eventType === 'DELETE') {
            setVotes(prev => ({ ...prev, [reqId]: Math.max(0, (prev[reqId] ?? 1) - 1) }))
            if (payload.old?.user_id === meId) setMyVotes(prev => {
              const s = new Set(prev); s.delete(reqId); return s
            })
          }
        })
      chRef.current = ch.subscribe()
      return () => { if (chRef.current) supabase.removeChannel(chRef.current) }
    })().catch(e => setErr(String(e)))
  }, [])

  async function addSong(e: React.FormEvent) {
    e.preventDefault(); setErr(null)
    if (!wid || !title.trim()) return
    const { data, error } = await supabase
      .from('song_requests')
      .insert({ wedding_id: wid, title: title.trim(), artist: artist.trim() || null, note: note.trim() || null })
      .select('id,title,artist,note,status,created_at').single()
    if (error) { setErr(error.message); return }
    setList(prev => [data as Req, ...prev])
    setTitle(''); setArtist(''); setNote('')
  }

  async function toggleVote(reqId: number) {
    if (!meId) return
    if (myVotes.has(reqId)) {
      // usuwam swój głos
      await supabase.from('song_votes').delete().eq('request_id', reqId)
    } else {
      const { error } = await supabase.from('song_votes').insert({ request_id: reqId })
      if (error) setErr(error.message)
    }
  }

  const sorted = useMemo(() => {
    const rank = (s: Req['status']) => (s === 'queued' ? 0 : s === 'played' ? 1 : 2)
    return [...list].sort((a, b) => {
      const ra = rank(a.status), rb = rank(b.status)
      if (ra !== rb) return ra - rb
      const va = votes[a.id] ?? 0, vb = votes[b.id] ?? 0
      if (va !== vb) return vb - va
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  }, [list, votes])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Prośby o piosenki</h1>

      <form onSubmit={addSong} className="grid gap-2 md:grid-cols-3">
        <input className="border rounded p-2" placeholder="Tytuł *" value={title} onChange={e=>setTitle(e.target.value)} />
        <input className="border rounded p-2" placeholder="Wykonawca" value={artist} onChange={e=>setArtist(e.target.value)} />
        <input className="border rounded p-2 md:col-span-1" placeholder="Dedykacja/uwagi" value={note} onChange={e=>setNote(e.target.value)} />
        <button className="btn md:col-span-3 disabled:opacity-50" disabled={!title.trim()}>Zaproponuj</button>
      </form>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      <ul className="divide-y">
        {sorted.map(r => (
          <li key={r.id} className="py-3 flex items-start justify-between gap-2">
            <div>
              <div className="font-medium">{r.title}{r.artist ? ` — ${r.artist}` : ''}</div>
              {r.note && <div className="text-sm text-slate-600">{r.note}</div>}
              <div className="text-xs text-slate-500 mt-1">
                {r.status === 'queued' ? 'W kolejce' : r.status === 'played' ? 'Zagrane' : 'Odrzucone'}
                {typeof votes[r.id] === 'number' && ` • głosy: ${votes[r.id]}`}
              </div>
            </div>
            <button
              className={`px-3 py-1 rounded text-sm border ${myVotes.has(r.id) ? 'bg-brand-100 text-brand-700' : 'bg-white'}`}
              onClick={()=>toggleVote(r.id)}
              title={myVotes.has(r.id) ? 'Cofnij głos' : 'Zagłosuj'}
            >
              ❤️ {votes[r.id] ?? 0}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
