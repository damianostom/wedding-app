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
  const [nameByUserId, setNameByUserId] = useState<Record<string,string>>({})
  const [myId, setMyId] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const seen = useRef(new Set<string>())

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      setWeddingId(wid)

      const { data: { user } } = await supabase.auth.getUser()
      setMyId(user?.id ?? null)

      // mapa podpisów
      if (wid) {
        const { data: gs } = await supabase
          .from('guests').select('user_id,full_name').eq('wedding_id', wid)
        const map: Record<string,string> = {}
        for (const g of gs ?? []) if (g.user_id) map[g.user_id] = g.full_name
        setNameByUserId(map)
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

      // broadcast + (opcjonalnie) postgres_changes
      const ch = supabase.channel(`chat:${wid}`, { config: { broadcast: { ack: true } } })
      ch.on('broadcast', { event: 'new-message' }, payload => {
        const m = payload.payload as Msg
        const key = `${m.id}|${m.created_at}`; if (seen.current.has(key)) return
        seen.current.add(key); setMsgs(prev => [...prev, m])
      })
      ch.on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `wedding_id=eq.${wid}` },
        (payload: any) => {
          const m = payload.new as Msg
          const key = `${m.id}|${m.created_at}`; if (seen.current.has(key)) return
          seen.current.add(key); setMsgs(prev => [...prev, m])
        }
      )
      channelRef.current = ch.subscribe()
      return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
    })()
  }, [])

  async function send() {
    setErr(null)
    if (!text.trim() || !weddingId) return
    const { data, error } = await supabase
      .from('messages')
      .insert({ wedding_id: weddingId, content: text, user_id: myId })
      .select('id,content,created_at,user_id')
      .single()
    if (error) { setErr(error.message); return }

    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'new-message', payload: data as Msg })
    }
    setMsgs(prev => [...prev, data as Msg])
    setText('')
  }

  return (
    <div className="flex flex-col h-[70vh] border rounded">
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {msgs.map((m, i) => {
          const who = m.user_id === myId ? 'Ty' : (m.user_id ? (nameByUserId[m.user_id] || 'Gość') : 'Gość')
          return (
            <div key={`${m.id}-${i}`} className="rounded bg-gray-100 px-2 py-1">
              <span className="text-xs text-slate-500 mr-2">{who}:</span>{m.content}
            </div>
          )
        })}
      </div>
      <div className="border-t p-2 flex gap-2">
        <input className="flex-1 border rounded p-2"
               value={text} onChange={e=>setText(e.target.value)} placeholder="Napisz wiadomość..." />
        <button className="btn" onClick={send}>Wyślij</button>
      </div>
      {err && <div className="p-2 text-sm text-red-600">{err}</div>}
    </div>
  )
}
