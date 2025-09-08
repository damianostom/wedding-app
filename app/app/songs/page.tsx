'use client'

import { useEffect, useMemo, useState } from 'react'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'

type Req = {
  id: string
  title: string
  artist: string | null
  status: 'pending' | 'played' | 'rejected'
  created_at: string
  song_votes?: { count: number }[]
}

export default function SongsPage() {
  const supabase = supaClient()
  const [wid, setWid] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [list, setList] = useState<Req[]>([])
  const [mineVotes, setMineVotes] = useState<Set<string>>(new Set())
  const [err, setErr] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [isOrganizer, setIsOrganizer] = useState(false)

  useEffect(() => {
    ;(async () => {
      const w = await getMyWeddingId()
      setWid(w)
      await refresh(w)
      await refreshMyVotes()

      // rola (czy organizer)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: me } = await supabase
          .from('guests')
          .select('role')
          .eq('user_id', user.id)
          .maybeSingle()
        setIsOrganizer(me?.role === 'organizer')
      }
    })().catch(e => setErr(String(e)))
  }, [])

  async function refresh(w?: string | null) {
    const weddingId = w ?? wid
    if (!weddingId) return
    setErr(null)
    const { data, error } = await supabase
      .from('song_requests')
      .select('id,title,artist,status,created_at,song_votes(count)')
      .eq('wedding_id', weddingId)
      .order('created_at', { ascending: false })
    if (error) { setErr(error.message); return }
    setList((data ?? []) as any)
  }

  async function refreshMyVotes() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('song_votes')
      .select('request_id')
      .eq('user_id', user.id)
    setMineVotes(new Set((data ?? []).map((r: any) => r.request_id)))
  }

  const votesOf = (r: Req) => (r.song_votes?.[0]?.count ?? 0)
  const canVote = (r: Req) => r.status === 'pending' && !mineVotes.has(r.id)

  async function add() {
    if (!wid || !title.trim()) return
    setSending(true); setErr(null)
    try {
      const { error } = await supabase.from('song_requests').insert({
        wedding_id: wid,
        title: title.trim(),
        artist: artist.trim() || null,
        status: 'pending',
      })
      if (error) throw error
      setTitle(''); setArtist('')
      await refresh()
    } catch (e:any) {
      setErr(e?.message || 'Błąd dodawania prośby')
    } finally {
      setSending(false)
    }
  }

  async function vote(id: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('song_votes').insert({ request_id: id, user_id: user.id })
    if (!error) {
      setMineVotes(prev => new Set(prev).add(id))
      await refresh()
    }
  }

  // ——— USUŃ (organizator) ———
  async function removeReq(id: string) {
    if (!isOrganizer) return
    const res = await fetch('/api/admin/delete-song-request', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ id })
    })
    const j = await res.json().catch(()=>({}))
    if (!res.ok) { setErr(j.error || 'Nie udało się usunąć'); return }
    setList(prev => prev.filter(x => x.id !== id))
    setMineVotes(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const pending = useMemo(() => list.filter(r => r.status === 'pending'), [list])
  const others  = useMemo(() => list.filter(r => r.status !== 'pending'), [list])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Prośby o piosenki</h1>

      <div className="flex flex-wrap gap-3">
        <input className="border rounded p-2 flex-1 min-w-48" placeholder="Tytuł"
               value={title} onChange={e=>setTitle(e.target.value)} />
        <input className="border rounded p-2 flex-1 min-w-48" placeholder="Wykonawca (opcjonalnie)"
               value={artist} onChange={e=>setArtist(e.target.value)} />
        <button className="btn disabled:opacity-50" disabled={!title.trim() || sending} onClick={add}>
          {sending ? 'Dodaję…' : 'Zaproponuj'}
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {!pending.length && <p className="text-slate-600">Brak próśb – bądź pierwszy/a!</p>}
      <ul className="divide-y">
        {pending.map(r => (
          <li key={r.id} className="py-2 flex items-center justify-between gap-2">
            <div>
              <div className="font-medium">{r.title}</div>
              <div className="text-xs text-slate-600">{r.artist || ''}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm">👍 {votesOf(r)}</span>
              <button className="btn disabled:opacity-50" disabled={!canVote(r)} onClick={()=>vote(r.id)}>
                {mineVotes.has(r.id) ? 'Oddano głos' : 'Głosuj'}
              </button>
              {isOrganizer && (
                <button className="btn" onClick={()=>removeReq(r.id)}>Usuń</button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!!others.length && (
        <>
          <h2 className="text-lg font-semibold mt-6">Zamknięte</h2>
          <ul className="divide-y">
            {others.map(r => (
              <li key={r.id} className="py-2">
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-slate-600">
                  {r.artist || ''} • {r.status === 'played' ? 'zagrane' : 'odrzucone'} • 👍 {votesOf(r)}
                </div>
                {isOrganizer && (
                  <div className="mt-2">
                    <button className="btn" onClick={()=>removeReq(r.id)}>Usuń</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
