'use client'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'
import { useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

type Msg = { id: number | string; content: string; created_at: string; user_id: string | null }

export default function ChatPage() {
  const supabase = supaClient()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // prosta deduplikacja po id+created_at
  const seen = useRef(new Set<string>())

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      setWeddingId(wid)
      if (!wid) { setErr('Brak powiązania z weselem — dodaj rekord w "guests" dla zalogowanego użytkownika.'); return }

      // 1) Historia z DB
      const { data, error } = await supabase
        .from('messages').select('id,content,created_at,user_id')
        .eq('wedding_id', wid).order('created_at', { ascending: true })
      if (error) setErr(error.message)
      for (const m of data ?? []) seen.current.add(`${m.id}|${m.created_at}`)
      setMsgs(data ?? [])

      // 2) Subskrypcja Broadcast (działa bez replication)
      const ch = supabase.channel(`chat:${wid}`, { config: { broadcast: { ack: true } } })

      ch.on('broadcast', { event: 'new-message' }, payload => {
        const m = payload.payload as Msg
        const key = `${m.id}|${m.created_at}`
        if (seen.current.has(key)) return
        seen.current.add(key)
        setMsgs(prev => [...prev, m])
      })

      // 3) (opcjonalnie) jeśli jednak publications działają – nasłuch INSERT
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

      channelRef.current = ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // ok
        }
      })

      return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
    })()
  }, [])

  async function send() {
    setErr(null)
    if (!text.trim() || !weddingId) return

    // najpierw zapisz w DB (trwałość)
    const { data, error } = await supabase
      .from('messages')
      .insert({ wedding_id: weddingId, content: text })
      .select('id,content,created_at,user_id')
      .single()

    if (error) { setErr(error.message); return }

    // wyślij broadcast (natychmiastowa aktualizacja u wszystkich)
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'new-message',
        payload: data as Msg,
      })
    }

    setMsgs(prev => [...prev, data as Msg]) // lokalnie też dodaj
    setText('')
  }

  return (
    <div className="flex flex-col h-[70vh] border rounded">
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {msgs.map((m, i) => <div key={`${m.id}-${i}`} className="rounded bg-gray-100 px-2 py-1">{m.content}</div>)}
      </div>
      <div className="border-t p-2 flex gap-2">
        <input className="flex-1 border rounded p-2" value={text} onChange={e=>setText(e.target.value)} placeholder="Napisz wiadomość..." />
        <button className="btn" onClick={send}>Wyślij</button>
      </div>
      {err && <div className="p-2 text-sm text-red-600">{err}</div>}
    </div>
  )
}
