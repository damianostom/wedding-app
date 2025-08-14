'use client'
import { supaClient } from '@/lib/supabaseClient'
import { getMyWeddingId } from '@/lib/getWeddingId'
import { useEffect, useRef, useState } from 'react'

type Msg = { id: number; content: string; created_at: string; user_id: string | null }

export default function ChatPage() {
  const supabase = supaClient()
  const [weddingId, setWeddingId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    ;(async () => {
      const wid = await getMyWeddingId()
      if (!wid) return
      setWeddingId(wid)
      const { data } = await supabase
        .from('messages').select('id,content,created_at,user_id')
        .eq('wedding_id', wid).order('created_at', { ascending: true })
      setMsgs(data ?? [])
      const channel = supabase.channel('chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `wedding_id=eq.${wid}` },
          payload => setMsgs(m => [...m, payload.new as any]))
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    })()
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  async function send() {
    if (!text.trim() || !weddingId) return
    const { error } = await supabase.from('messages').insert({ wedding_id: weddingId, content: text })
    if (!error) setText('')
  }

  return (
    <div className="flex flex-col h-[70vh] border rounded">
      <div className="flex-1 overflow-auto p-3 space-y-2">
        {msgs.map(m => <div key={m.id} className="rounded bg-gray-100 px-2 py-1">{m.content}</div>)}
        <div ref={bottomRef} />
      </div>
      <div className="border-t p-2 flex gap-2">
        <input className="flex-1 border rounded p-2" value={text} onChange={e=>setText(e.target.value)} placeholder="Napisz wiadomość..." />
        <button className="bg-black text-white px-4 rounded" onClick={send}>Wyślij</button>
      </div>
    </div>
  )
}
