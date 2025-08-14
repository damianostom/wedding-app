'use client'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'
import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

type Msg = {
  id: number | string
  content: string
  created_at: string
  user_id: string | null
  sender_name?: string
}

export default function ChatPage() {
  const supabase = supaClient()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const channelRef = useRef<RealtimeChannel | null>(null)
  const seen = useRef(new Set<string>())

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      setWeddingId(wid)
      if (!wid) {
        setErr('Brak powiązania z weselem — dodaj rekord w "guests" dla zalogowanego użytkownika.')
        return
      }

      // historia
      const { data, error } = await supabase
        .from('messages')
        .select('id,content,created_at,user_id')
        .eq('wedding_id', wid)
        .order('created_at', { ascending: true })
      if (error) setErr(error.message)
      for (const m of data ?? []) seen.current.add(`${m.id}|${m.created_at}`)
      setMsgs(data ?? [])

      // zbuduj mapkę user_id -> full_name
      const ids = Array.from(new Set((data ?? []).map(m => m.user_id).filter(Boolean))) as string[]
      if (ids.length) {
        const { data: gs } = await supabase
          .from('guests')
          .select('user_id,full_name')
          .in('user_id', ids)
        const m: Record<string, string> = {}
        for (const g of gs ?? []) m[g.user_id] = g.full_name
        setNames(m)
      }

      // realtime
      const ch = supabase.channel(`chat:${wid}`, { config: { broadcast: { ack: true } } })
      ch.on('broadcast', { event: 'new-message' }, payload => {
        const m = payload.payload as Msg
        const key = `${m.id}|${m.created_at}`
        if (seen.current.has(key)) return
        seen.current.add(key)
        setMsgs(prev => [...prev, m])
        if (m.user_id && m.sender_name) {
          setNames(prev => ({ ...prev, [m.user_id as string]: m.sender_name as string }))
        }
      })
      ch.on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `wedding_id=eq.${wid}` },
        (payload: any) => {
          const m = payload.new as Msg
          const key = `${m.id}|${m.created_at}`
          if (seen.current.has(key)) return
          seen.current.add(key)
          setMsgs(prev => [...prev, m])
        }
      )
      channelRef.current = ch.subscribe()
      return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
    })()
  }, [])

  async function send() {
    setErr(null)
    if (!text.trim() || !weddingId) return

    const { data: { user } } = await supabase.auth.getUser()
    let myName = 'Gość'
    let myId: string | null = null
    if (user?.id) {
      myId = user.id
      const { data: me } = await supabase
        .from('guests')
        .select('full_name')
        .eq('user_id', user.id)
        .maybeSingle()
      myName = me?.full_name || myName
    }

    // ⬇⬇⬇ KLUCZOWA ZMIANA: zapisujemy user_id do tabeli
    const { data, error } = await supabase
      .from('messages')
      .insert({ wedding_id: weddingId, content: text, user_id: myId })
      .select('id,content,created_at,user_id')
      .single()

    if (error) { setErr(error.message); return }

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'new-message',
        payload: { ...data, sender_name: myName } as Msg,
      })
    }

    setMsgs(prev => [...prev, { ...data, sender_name: myName } as Msg])
    if (data.user_id) setNames(prev => ({ ...prev, [data.user_id as string]: myName }))
    setText('')
  }

  function labelFor(m: Msg) {
    if (m.user_id && names[m.user_id]) return names[m.user_id]
    if (m.sender_name) return m.sender_name
    return 'Gość'
  }

  return (
    <div className="flex flex-col h-[70vh] border rounded bg-white">
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {msgs.map((m, i) => (
          <div key={`${m.id}-${i}`} className="rounded bg-gray-100 px-2 py-1">
            <div className="text-xs text-slate-600 mb-0.5"><strong>{labelFor(m)}</strong></div>
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
