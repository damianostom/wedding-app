'use client'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'
import { useEffect, useRef, useState, useMemo } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

type Msg = {
  id: number | string
  content: string
  created_at: string
  user_id: string | null
  is_highlighted?: boolean
  sender_name?: string
}

export default function ChatPage() {
  const supabase = supaClient()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [names, setNames] = useState<Record<string,string>>({})
  const [isOrganizer, setIsOrganizer] = useState(false)
  const chRef = useRef<RealtimeChannel | null>(null)
  const seen = useRef(new Set<string>())

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      setWeddingId(wid)
      if (!wid) { setErr('Brak powiązania z weselem.'); return }

      // rola (czy admin)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: me } = await supabase
          .from('guests').select('role').eq('user_id', user.id).maybeSingle()
        setIsOrganizer(me?.role === 'organizer')
      }

      // startowe wiadomości
      const { data, error } = await supabase
        .from('messages')
        .select('id,content,created_at,user_id,is_highlighted')
        .eq('wedding_id', wid)
        .order('created_at', { ascending: true })
      if (error) setErr(error.message)
      for (const m of data ?? []) seen.current.add(`${m.id}|${m.created_at}`)
      setMsgs(data ?? [])

      // podpisy
      const ids = Array.from(new Set((data ?? []).map(m => m.user_id).filter(Boolean))) as string[]
      if (ids.length) {
        const { data: gs } = await supabase.from('guests').select('user_id,full_name').in('user_id', ids)
        const map: Record<string,string> = {}
        for (const g of gs ?? []) map[g.user_id] = g.full_name
        setNames(map)
      }

      // realtime: własny broadcast + zmiany w DB (INSERT/UPDATE/DELETE)
      const ch = supabase.channel(`chat:${wid}`, { config: { broadcast: { ack: true } } })
      ch.on('broadcast',{ event:'new-message' }, payload => {
        const m = payload.payload as Msg
        const key = `${m.id}|${m.created_at}`; if (seen.current.has(key)) return
        seen.current.add(key); setMsgs(prev => [...prev, m])
        if (m.user_id && m.sender_name) setNames(prev => ({ ...prev, [m.user_id!]: m.sender_name! }))
      })
      ch.on('postgres_changes',
        { event:'INSERT', schema:'public', table:'messages', filter:`wedding_id=eq.${wid}`},
        (payload:any) => {
          const m = payload.new as Msg
          const key = `${m.id}|${m.created_at}`; if (seen.current.has(key)) return
          seen.current.add(key); setMsgs(prev => [...prev, m])
        })
      ch.on('postgres_changes',
        { event:'UPDATE', schema:'public', table:'messages', filter:`wedding_id=eq.${wid}`},
        (payload:any) => {
          const m = payload.new as Msg
          setMsgs(prev => prev.map(x => x.id === m.id ? { ...x, ...m } : x))
        })
      ch.on('postgres_changes',
        { event:'DELETE', schema:'public', table:'messages', filter:`wedding_id=eq.${wid}`},
        (payload:any) => {
          const oldId = payload.old.id as string | number
          setMsgs(prev => prev.filter(x => x.id !== oldId))
        })
      chRef.current = ch.subscribe()
      return () => { if (chRef.current) supabase.removeChannel(chRef.current) }
    })()
  }, [])

  async function send() {
    setErr(null)
    if (!text.trim() || !weddingId) return
    const { data: { user } } = await supabase.auth.getUser()
    let myName = 'Gość'
    if (user?.id) {
      const { data: me } = await supabase.from('guests').select('full_name').eq('user_id', user.id).maybeSingle()
      myName = me?.full_name || myName
    }
    const { data, error } = await supabase
      .from('messages')
      .insert({ wedding_id: weddingId, content: text, user_id: user?.id ?? null })
      .select('id,content,created_at,user_id,is_highlighted')
      .single()
    if (error) { setErr(error.message); return }
    chRef.current?.send({ type:'broadcast', event:'new-message', payload:{ ...data, sender_name: myName } as Msg })
    setMsgs(prev => [...prev, { ...data, sender_name: myName } as Msg])
    if (data.user_id) setNames(prev => ({ ...prev, [data.user_id!]: myName }))
    setText('')
  }

  async function deleteMsg(m: Msg) {
    if (!isOrganizer) return
    if (!confirm('Usunąć tę wiadomość?')) return
    const { error } = await supabase.from('messages').delete().eq('id', m.id)
    if (error) setErr(error.message)
    else setMsgs(prev => prev.filter(x => x.id !== m.id))
  }

  async function toggleHighlight(m: Msg) {
    if (!isOrganizer) return
    const { data, error } = await supabase
      .from('messages')
      .update({ is_highlighted: !m.is_highlighted })
      .eq('id', m.id)
      .select('id,is_highlighted')
      .single()
    if (error) setErr(error.message)
    else setMsgs(prev => prev.map(x => x.id === m.id ? { ...x, is_highlighted: data!.is_highlighted } : x))
  }

  const label = (m: Msg) => (m.user_id && names[m.user_id]) || m.sender_name || 'Gość'

  // wyróżnione na górze, potem chronologicznie
  const sorted = useMemo(() => {
    return [...msgs].sort((a, b) => {
      const ah = a.is_highlighted ? 1 : 0
      const bh = b.is_highlighted ? 1 : 0
      if (ah !== bh) return bh - ah
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
  }, [msgs])

  return (
    <div className="flex flex-col h-[70vh] border rounded bg-white">
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {sorted.map((m, i) => (
          <div
            key={`${m.id}-${i}`}
            className={`rounded px-2 py-1 border ${m.is_highlighted ? 'bg-amber-50 border-amber-300' : 'bg-gray-100 border-transparent'}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-600 mb-0.5">
                <strong>{label(m)}</strong>
                {m.is_highlighted && <span className="ml-2 text-amber-600">★ wyróżniona</span>}
              </div>
              {isOrganizer && (
                <div className="ml-3 flex gap-3 text-xs">
                  <button className="underline" onClick={() => toggleHighlight(m)}>
                    {m.is_highlighted ? 'Odznacz' : 'Wyróżnij'}
                  </button>
                  <button className="underline text-red-600" onClick={() => deleteMsg(m)}>Usuń</button>
                </div>
              )}
            </div>
            <div>{m.content}</div>
          </div>
        ))}
      </div>
      <div className="border-t p-2 flex gap-2">
        <input className="flex-1 border rounded p-2" value={text} onChange={e=>setText(e.target.value)} placeholder="Napisz wiadomość..." />
        <button className="btn" onClick={send}>Wyślij</button>
      </div>
      {err && <div className="p-2 text-sm text-red-600">{err}</div>}
    </div>
  )
}
