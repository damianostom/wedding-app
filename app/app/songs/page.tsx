// app/app/songs/page.tsx
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

export default function SongsPage() {
  const supabase = supaClient()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [meId, setMeId] = useState<string | null>(null)

  const [reqs, setReqs] = useState<RequestRow[]>([])         // ← pusta tablica (bez nulli)
  const [votes, setVotes] = useState<VoteRow[]>([])          // ← pusta tablica
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      setErr(null)
      const wid = await getMyWeddingId()
      setWeddingId(wid)

      const { data: { user } } = await supabase.auth.getUser()
      setMeId(user?.id ?? null)

      // pobierz prośby
      const { data: rs, error: er1 } = await supabase
        .from('song_requests')
        .select('id,title,artist,created_at,user_id,status')
        .eq('wedding_id', wid)
        .order('created_at', { ascending: false })
      if (er1) setErr(er1.message)
      setReqs(rs ?? [])

      // pobierz głosy dla tych próśb
      const ids = (rs ?? []).map(r => r.id)
      if (ids.length) {
        const { data: vs } = await supabase
          .from('song_votes')
          .select('request_id,user_id')
          .in('request_id', ids)
        setVotes(vs ?? [])
      } else {
        setVotes([])
      }

      setLoading(false)
    })().catch(e => { setErr(String(e)); setLoading(false) })
  }, [])

  const voteCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of votes) m.set(v.request_id, (m.get(v.request_id) ?? 0) + 1)
    return m
  }, [votes])

  const myVotes = useMemo(() => {
    const s = new Set<string>()
    for (const v of votes) if (v.user_id && v.user_id === meId) s.add(v.request_id)
    return s
  }, [votes, meId])

  async function addRequest(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!weddingId || !title.trim()) return
    const { data, error } = await supabase
      .from('song_requests')
      .insert({ wedding_id: weddingId, title: title.trim(), artist: artist.trim() || null })
      .select('id,title,artist,created_at,user_id,status')
      .single()
    if (error) { setErr(error.message); return }
    setReqs(prev => [data as RequestRow, ...prev])
    setTitle(''); setArtist('')
  }

  async function upvote(id: string) {
    setErr(null)
    // zakładamy RLS: user_id = auth.uid() jako DEFAULT, więc podajemy tylko request_id
    const { error } = await supabase.from('song_votes').insert({ request_id: id })
    if (error) {
      // jeśli constraint UNIQUE już jest, to zignoruj
      if (!/duplicate|unique/i.test(error.message)) setErr(error.message)
    } else {
      setVotes(prev => [...prev, { request_id: id, user_id: meId! }])
    }
  }

  const sorted = useMemo(() => {
    const list = [...reqs]
    list.sort((a, b) => {
      // pending na górze, reszta niżej
      const aw = a.status === 'pending' || a.status == null ? 0 : 1
      const bw = b.status === 'pending' || b.status == null ? 0 : 1
      if (aw !== bw) return aw - bw
      const av = voteCount.get(a.id) ?? 0
      const bv = voteCount.get(b.id) ?? 0
      if (av !== bv) return bv - av
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
    return list
  }, [reqs, voteCount])

  if (loading) return <p>Ładowanie…</p>

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Prośby o piosenki</h1>

      <form onSubmit={addRequest} className="grid gap-2 md:grid-cols-3">
        <input className="border rounded p-2" placeholder="Tytuł" value={title} onChange={e=>setTitle(e.target.value)} />
        <input className="border rounded p-2" placeholder="Wykonawca (opcjonalnie)" value={artist} onChange={e=>setArtist(e.target.value)} />
        <button className="btn disabled:opacity-50" disabled={!title.trim()}>Zaproponuj</button>
      </form>

      {err && <p className="text-red-600 text-sm">{err}</p>}

      {!sorted.length ? (
        <p className="text-slate-600">Brak próśb – bądź pierwszy/a!</p>
      ) : (
        <ul className="divide-y">
          {sorted.map(r => {
            const cnt = voteCount.get(r.id) ?? 0
            const mine = myVotes.has(r.id)
            const status = r.status ?? 'pending'
            return (
              <li key={r.id} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{r.title}{r.artist ? ` — ${r.artist}` : ''}</div>
                  <div className="text-xs text-slate-600">
                    {status === 'pending' ? 'oczekuje' : status === 'played' ? 'zagrane' : 'odrzucone'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">👍 {cnt}</span>
                  <button
                    className="btn disabled:opacity-50"
                    onClick={() => upvote(r.id)}
                    disabled={mine || status !== 'pending'}
                  >
                    {mine ? 'Zagłosowano' : 'Głosuj'}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
